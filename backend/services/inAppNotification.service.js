/**
 * In-app notifications.
 *
 * Everything that affects a student or a teacher goes through `notify`, which
 * saves the notifications and pushes them to any open tab right away (see
 * realtime.service). Schedule events also send a `changed` signal so open
 * dashboards and timetables refetch without a reload.
 *
 * All helpers here are fire-and-forget from the controllers' point of view:
 * they log and swallow their own errors, so a notification problem never
 * fails the request that caused it.
 */

const Notification = require('../models/Notification.model');
const realtime = require('./realtime.service');
const { loadRoomsByRawValues, labelFor, looksLikeObjectId } = require('../utils/roomLabel');

const lazy = {
  get Schedule() { return require('../models/Schedule.model'); },
  get Student() { return require('../models/Student.model'); },
  get Faculty() { return require('../models/Faculty.model'); },
  get ClassSpace() { return require('../models/ClassSpace.model'); },
  get User() { return require('../models/User.model'); },
};

const uniqIds = (ids) => [...new Set((ids || []).filter(Boolean).map(String))];

/**
 * Save one notification per recipient and push it live.
 * @returns {{ success: boolean, count: number }}
 */
const notify = async (recipients, data) => {
  const ids = uniqIds(Array.isArray(recipients) ? recipients : [recipients]);
  if (!ids.length) return { success: true, count: 0 };
  try {
    const docs = await Notification.insertMany(ids.map((recipient) => ({ recipient, ...data })));
    docs.forEach((doc) => realtime.publish([doc.recipient], 'notification', doc.toObject()));
    return { success: true, count: docs.length };
  } catch (error) {
    console.error('Error creating notifications:', error.message);
    return { success: false, count: 0, error: error.message };
  }
};

// Kept for existing callers
const createNotification = notify;

/* ---------------- Who is affected ---------------- */

/** User ids of a section's students, plus anyone enrolled in these class spaces. */
const studentUsersFor = async ({ sectionCodes = [], scheduleIds = [] }) => {
  const [students, spaces] = await Promise.all([
    sectionCodes.length
      ? lazy.Student.find({ sectionCode: { $in: sectionCodes } }).select('user').lean()
      : [],
    scheduleIds.length
      ? lazy.ClassSpace.find({ schedule: { $in: scheduleIds } })
        .select('enrolledStudents.student')
        .populate({ path: 'enrolledStudents.student', select: 'user' })
        .lean()
      : [],
  ]);
  return uniqIds([
    ...students.map((s) => s.user),
    ...spaces.flatMap((cs) => (cs.enrolledStudents || []).map((e) => e.student?.user)),
  ]);
};

/** Faculty profile id(s) -> their user ids. */
const facultyUsersFor = async (facultyIds) => {
  const ids = uniqIds(facultyIds);
  if (!ids.length) return new Map();
  const list = await lazy.Faculty.find({ _id: { $in: ids } }).select('user').lean();
  return new Map(list.map((f) => [String(f._id), f.user ? String(f.user) : null]));
};

/** Admins and scheduling officers (and a program's manager, if given). */
const staffUsers = async (program) => {
  const users = await lazy.User.find({
    isActive: true,
    $or: [
      { role: { $in: ['admin', 'scheduling_officer'] } },
      ...(program ? [{ role: 'program_manager', program }] : []),
    ],
  }).select('_id').lean();
  return users.map((u) => String(u._id));
};

/** Refresh signal for open staff dashboards (the program's manager, or all). */
const tellStaff = (program, topics) => realtime.publishWhere(
  (c) => ['admin', 'scheduling_officer'].includes(c.role) || (c.role === 'program_manager' && (!program || c.program === program)),
  'changed',
  { topics: [].concat(topics) }
);

/* ---------------- Formatting ---------------- */

const fmtTime = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return `${(h % 12) || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const fmtSlots = (slots = []) => (slots.length
  ? slots.map((s) => `${String(s.day).slice(0, 3)} ${fmtTime(s.startTime)}-${fmtTime(s.endTime)}`).join(', ')
  : 'no meeting times');
const slotsKey = (slots = []) => slots.map((s) => `${s.day}${s.startTime}${s.endTime}`).sort().join('|');

const classSlug = (subjectCode, sectionCode) => [subjectCode || 'class', sectionCode || '']
  .filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const roomLabelOf = async (raw) => {
  if (!raw) return null;
  if (!looksLikeObjectId(String(raw))) return String(raw);
  const map = await loadRoomsByRawValues([String(raw)]);
  return labelFor(map.get(String(raw))) || null;
};

const facultyNameOf = async (facultyId) => {
  if (!facultyId) return null;
  const f = await lazy.Faculty.findById(facultyId).populate('user', 'firstName lastName').lean();
  return f?.user ? `${f.user.firstName} ${f.user.lastName}`.trim() : null;
};

/* ---------------- Schedule events ---------------- */

/** Snapshot of the fields people care about, taken before an update. */
const snapshotSchedule = (schedule) => ({
  timeSlots: (schedule.timeSlots || []).map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime })),
  room: schedule.room ? String(schedule.room) : null,
  faculty: schedule.faculty?._id ? String(schedule.faculty._id) : schedule.faculty ? String(schedule.faculty) : null,
});

/**
 * Tell the section's students and the teacher about one class.
 * kind: created | updated | removed | published
 * before: snapshotSchedule() taken before an update, to describe the change
 */
const notifyScheduleEvent = async (scheduleOrId, kind, { before, actor } = {}) => {
  try {
    const schedule = scheduleOrId?._id && scheduleOrId.timeSlots
      ? scheduleOrId
      : await lazy.Schedule.findById(scheduleOrId).lean();
    if (!schedule) return;

    const after = snapshotSchedule(schedule);
    const subject = schedule.subject?.subjectCode
      ? schedule.subject
      : await require('../models/Subject.model').findById(schedule.subject).select('subjectCode subjectName').lean();
    const code = subject?.subjectCode || 'A class';
    const section = schedule.sectionCode;

    const changes = [];
    let effectiveKind = kind;
    if (kind === 'updated' && before) {
      if (slotsKey(before.timeSlots) !== slotsKey(after.timeSlots)) {
        changes.push(`Time: ${fmtSlots(before.timeSlots)} → ${fmtSlots(after.timeSlots)}`);
      }
      if ((before.room || null) !== (after.room || null)) {
        const [from, to] = await Promise.all([roomLabelOf(before.room), roomLabelOf(after.room)]);
        changes.push(`Room: ${from || 'TBA'} → ${to || 'TBA'}`);
      }
      if ((before.faculty || null) !== (after.faculty || null)) {
        const [from, to] = await Promise.all([facultyNameOf(before.faculty), facultyNameOf(after.faculty)]);
        changes.push(`Instructor: ${from || 'none'} → ${to || 'none'}`);
        effectiveKind = 'reassigned';
      }
      // Nothing a student or teacher would notice (e.g. max students)
      if (!changes.length) return;
      if (effectiveKind === 'updated' && changes.length === 1 && changes[0].startsWith('Time')) effectiveKind = 'moved';
    }

    const room = await roomLabelOf(after.room);
    const when = fmtSlots(after.timeSlots);
    const facultyUsers = await facultyUsersFor([after.faculty, before?.faculty]);
    const teacherUser = after.faculty ? facultyUsers.get(after.faculty) : null;
    const oldTeacherUser = before?.faculty && before.faculty !== after.faculty ? facultyUsers.get(before.faculty) : null;
    const students = await studentUsersFor({ sectionCodes: section ? [section] : [], scheduleIds: [schedule._id] });

    const base = {
      type: 'schedule',
      relatedResource: { resourceType: 'Schedule', resourceId: schedule._id },
      actorName: actor || undefined,
      metadata: { kind: effectiveKind, subjectCode: code, className: subject?.subjectName || '', sectionCode: section, changes },
    };
    const classLink = kind === 'removed' ? '/schedules' : `/classes/${classSlug(code, section)}`;

    const text = {
      created: { title: `New class: ${code}`, message: `${code} was added to ${section}'s timetable: ${when}${room ? ` in ${room}` : ''}.` },
      moved: { title: `${code} moved`, message: `${code} (${section}) now meets ${when}${room ? ` in ${room}` : ''}.` },
      updated: { title: `${code} changed`, message: `${code} (${section}) was updated. Now ${when}${room ? ` in ${room}` : ''}.` },
      reassigned: { title: `${code} has a new instructor`, message: `${code} (${section}) instructor changed.` },
      removed: { title: `${code} removed`, message: `${code} was removed from ${section}'s timetable.` },
      published: { title: `${code} schedule published`, message: `${code} (${section}) is final: ${when}${room ? ` in ${room}` : ''}.` },
    }[effectiveKind] || { title: `${code} updated`, message: `${code} (${section}) was updated.` };

    await notify(students, { ...base, ...text, link: classLink });

    if (teacherUser) {
      const teacherText = {
        created: { title: `New class assigned: ${code}`, message: `You're teaching ${code} with ${section}: ${when}${room ? ` in ${room}` : ''}.` },
        reassigned: { title: `New class assigned: ${code}`, message: `You're now teaching ${code} with ${section}: ${when}${room ? ` in ${room}` : ''}.` },
        removed: { title: `${code} removed`, message: `${code} with ${section} was removed from your load.` },
      }[effectiveKind] || text;
      await notify([teacherUser], { ...base, ...teacherText, link: kind === 'removed' ? '/schedules' : classLink });
    }
    if (oldTeacherUser) {
      await notify([oldTeacherUser], {
        ...base,
        title: `${code} reassigned`,
        message: `${code} with ${section} was moved to another instructor and is no longer on your load.`,
        link: '/schedules',
      });
    }

    realtime.changed([...students, teacherUser, oldTeacherUser], ['schedule', 'classes']);
    tellStaff(schedule.program, ['schedule']);
  } catch (error) {
    console.error(`Schedule ${kind} notification failed:`, error.message);
  }
};

/**
 * Many classes saved at once (generate, bulk save, batch publish/delete).
 * One summary per student and per teacher instead of one per class.
 * kind: generated | published | removed
 */
const notifyTimetableBatch = async (schedules, kind) => {
  try {
    const list = (schedules || []).filter(Boolean);
    if (!list.length) return;

    const sections = uniqIds(list.map((s) => s.sectionCode));
    const facultyCount = new Map();
    list.forEach((s) => {
      const id = s.faculty?._id || s.faculty;
      if (id) facultyCount.set(String(id), (facultyCount.get(String(id)) || 0) + 1);
    });

    const verb = { generated: 'was updated', published: 'is now final', removed: 'had classes removed' }[kind] || 'changed';
    const kindTitle = { generated: 'Timetable updated', published: 'Timetable published', removed: 'Classes removed' }[kind] || 'Timetable changed';

    // Students: one per section
    for (const section of sections) {
      const inSection = list.filter((s) => s.sectionCode === section);
      const students = await studentUsersFor({ sectionCodes: [section], scheduleIds: inSection.map((s) => s._id) });
      await notify(students, {
        type: 'schedule',
        title: kindTitle,
        message: `${section}'s timetable ${verb} (${inSection.length} class${inSection.length === 1 ? '' : 'es'}).`,
        link: '/schedules',
        metadata: { kind, sectionCode: section },
      });
      realtime.changed(students, ['schedule', 'classes']);
    }

    // Teachers: one each
    const teacherUsers = await facultyUsersFor([...facultyCount.keys()]);
    for (const [facultyId, n] of facultyCount) {
      const user = teacherUsers.get(facultyId);
      if (!user) continue;
      await notify([user], {
        type: 'schedule',
        title: kind === 'removed' ? 'Classes removed from your load' : kind === 'published' ? 'Your schedule is published' : 'Your teaching schedule changed',
        message: kind === 'removed'
          ? `${n} of your classes ${n === 1 ? 'was' : 'were'} removed.`
          : `${n} class${n === 1 ? '' : 'es'} on your load ${kind === 'published' ? `${n === 1 ? 'is' : 'are'} now final` : `${n === 1 ? 'was' : 'were'} added or updated`}.`,
        link: '/schedules',
        metadata: { kind },
      });
      realtime.changed([user], ['schedule', 'classes']);
    }
    tellStaff(null, ['schedule']);
  } catch (error) {
    console.error(`Timetable ${kind} notification failed:`, error.message);
  }
};

/* ---------------- Class space posts ---------------- */

const notifyClassPost = async (classSpaceId, itemId, which) => {
  const classSpace = await lazy.ClassSpace.findById(classSpaceId)
    .populate('subject', 'subjectCode subjectName')
    .populate({ path: 'enrolledStudents.student', select: 'user' })
    .lean();
  if (!classSpace) throw new Error('Class space not found');

  const list = which === 'announcement' ? classSpace.announcements : classSpace.materials;
  const item = (list || []).find((x) => String(x._id) === String(itemId));
  if (!item) throw new Error(`${which} not found`);

  const recipients = uniqIds((classSpace.enrolledStudents || []).map((e) => e.student?.user));
  const code = classSpace.subject?.subjectCode || 'Class';
  const result = await notify(recipients, {
    type: which,
    title: which === 'announcement' ? `New announcement in ${code}` : `New material in ${code}`,
    message: item.title || (which === 'announcement' ? 'New announcement posted' : 'New material uploaded'),
    link: `/classes/${classSlug(code, classSpace.sectionCode)}`,
    metadata: { kind: which, subjectCode: code, className: classSpace.subject?.subjectName || '', sectionCode: classSpace.sectionCode },
    relatedResource: { resourceType: 'ClassSpace', resourceId: classSpaceId },
  });
  realtime.changed(recipients, ['classes']);
  return { success: true, recipients: result.count };
};

const notifyAnnouncementCreated = (classSpaceId, announcementId) => notifyClassPost(classSpaceId, announcementId, 'announcement');
const notifyMaterialUploaded = (classSpaceId, materialId) => notifyClassPost(classSpaceId, materialId, 'material');

/* ---------------- Enrollment and accounts ---------------- */

/** A student was put in (or taken out of) a section by staff. */
const notifySectionAssigned = async (student, { from, to }) => {
  try {
    if (!student?.user || (from || null) === (to || null)) return;
    await notify([student.user], {
      type: 'enrollment',
      title: to ? `You're in ${to}` : 'Removed from your section',
      message: to
        ? `The program office placed you in section ${to}${from ? ` (was ${from})` : ''}. Your classes and timetable are updated.`
        : `You were removed from ${from}. Contact your program office if this is unexpected.`,
      link: to ? '/classes' : '/dashboard',
      metadata: { kind: to ? 'assigned' : 'unassigned', sectionCode: to || from },
      relatedResource: { resourceType: 'Student', resourceId: student._id },
    });
    realtime.changed([student.user], ['schedule', 'classes', 'profile']);
    tellStaff(student.program, ['students']);
  } catch (error) {
    console.error('Section assignment notification failed:', error.message);
  }
};

/** Tell the scheduling office (and the program's manager) about a new faculty sign-up. */
const notifyFacultySignup = async (user, program) => {
  try {
    const staff = await staffUsers(program);
    await notify(staff, {
      type: 'account',
      title: 'Faculty sign-up to approve',
      message: `${user.firstName} ${user.lastName} (${user.email}) registered and is waiting for approval.`,
      link: '/faculty/approvals',
      metadata: { kind: 'signup' },
      relatedResource: { resourceType: 'User', resourceId: user._id },
    });
    realtime.changed(staff, ['approvals']);
  } catch (error) {
    console.error('Faculty sign-up notification failed:', error.message);
  }
};

const notifyAccountApproved = async (userId) => {
  try {
    await notify([userId], {
      type: 'account',
      title: 'Your account is approved',
      message: 'Welcome! Your faculty account is active. Your classes appear here once the scheduling office assigns them.',
      link: '/dashboard',
      metadata: { kind: 'approved' },
    });
  } catch (error) {
    console.error('Approval notification failed:', error.message);
  }
};

/** Kept for older callers: notify about a schedule by id. */
const notifyScheduleChange = (scheduleId, type) => notifyScheduleEvent(scheduleId, type === 'published' ? 'published' : 'updated');

module.exports = {
  notify,
  createNotification,
  snapshotSchedule,
  notifyScheduleEvent,
  notifyTimetableBatch,
  notifyScheduleChange,
  notifyAnnouncementCreated,
  notifyMaterialUploaded,
  notifySectionAssigned,
  notifyFacultySignup,
  notifyAccountApproved,
  staffUsers,
};
