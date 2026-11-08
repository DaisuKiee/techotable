/**
 * Academic terms, per program: which semester is "now" for a program, and
 * moving that program into it.
 *
 * Each program (BSIT, BSIE, BSFI, BIT-AT, BIT-CT, BIT-ET, BSHM) has its own
 * terms, set by its program manager or the scheduling office. Starting a term
 * only ever touches that program's sections, schedules, class spaces and
 * students.
 *
 * - getCurrentTerm(program): the program's term whose dates cover today (or,
 *   between terms, the one that started most recently).
 * - getDefaultTerm(program): { academicYear, semester } for new records.
 * - applyTerm(term): the rollover. The program's sections from earlier terms
 *   are snapshotted to SectionArchive and moved in; its schedules and class
 *   spaces from earlier terms are archived; its students follow.
 * - autoApply(): applies every program's current term that hasn't been yet.
 *   Runs on start-up and every 30 minutes, so terms start on their own dates.
 */

const AcademicTerm = require('../models/AcademicTerm.model');
const SectionArchive = require('../models/SectionArchive.model');

const lazy = {
  get Section() { return require('../models/Section.model'); },
  get Schedule() { return require('../models/Schedule.model'); },
  get Student() { return require('../models/Student.model'); },
  get ClassSpace() { return require('../models/ClassSpace.model'); },
  get Program() { return require('../models/Program.model'); },
};

const DAY = 86400000;
const SEMESTER_LABEL = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };

/** Sortable number for a term: 2026-2027 sem 2 -> 20262 */
const termKey = (academicYear, semester) => {
  const start = parseInt(String(academicYear || '').split('-')[0], 10) || 0;
  return start * 10 + (Number(semester) || 0);
};

const termLabel = (t) => `${SEMESTER_LABEL[t.semester] || `Semester ${t.semester}`} · AY ${t.academicYear}`;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

/** Active program codes, for "all programs" set-ups. */
const activePrograms = async () => (await lazy.Program.find({ isActive: { $ne: false } }).select('code').lean())
  .map((p) => p.code).filter(Boolean).sort();

/** Add status, progress and day counts for display. */
const describe = (term, now = new Date()) => {
  const t = term.toObject ? term.toObject() : { ...term };
  const start = startOfDay(t.startDate).getTime();
  const end = endOfDay(t.endDate).getTime();
  const totalDays = Math.max(1, Math.round((end - start) / DAY));
  const status = now.getTime() < start ? 'upcoming' : now.getTime() > end ? 'ended' : 'current';
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((now.getTime() - start) / DAY)));
  return {
    ...t,
    label: termLabel(t),
    status,
    totalDays,
    months: Math.round((totalDays / 30.44) * 10) / 10,
    elapsedDays,
    daysLeft: status === 'ended' ? 0 : Math.max(0, Math.ceil((end - now.getTime()) / DAY)),
    daysUntilStart: status === 'upcoming' ? Math.ceil((start - now.getTime()) / DAY) : 0,
    progress: status === 'upcoming' ? 0 : status === 'ended' ? 100 : Math.round((elapsedDays / totalDays) * 100),
  };
};

// program -> { at, term }
const cache = new Map();

const getCurrentTerm = async (program, { fresh = false } = {}) => {
  if (!program) return null;
  const hit = cache.get(program);
  if (!fresh && hit && Date.now() - hit.at < 60000) return hit.term;
  const now = new Date();
  let term = await AcademicTerm.findOne({ program, startDate: { $lte: now }, endDate: { $gte: startOfDay(now) } }).sort({ startDate: -1 }).lean();
  // Between terms (break): the one that started most recently is still "the" term
  if (!term) term = await AcademicTerm.findOne({ program, startDate: { $lte: now } }).sort({ startDate: -1 }).lean();
  cache.set(program, { at: Date.now(), term: term || null });
  return term || null;
};

const clearCache = () => cache.clear();

/**
 * School year by the school's rule: this year - next year (2026-2027 in 2026).
 * Used for a program that has no terms set up yet.
 */
const calendarTerm = (now = new Date()) => {
  const year = now.getFullYear();
  return { academicYear: `${year}-${year + 1}`, semester: 1 };
};

/** The term new records of a program should use. */
const getDefaultTerm = async (program) => {
  let current = await getCurrentTerm(program);
  // Summer is calendar-only (sections, subjects and schedules only know
  // semesters 1 and 2), so during summer new records keep the last semester
  if (current?.semester === 3) {
    current = await AcademicTerm.findOne({ program, semester: { $ne: 3 }, startDate: { $lte: new Date() } }).sort({ startDate: -1 }).lean();
  }
  if (current) return { academicYear: current.academicYear, semester: current.semester };
  return calendarTerm();
};

/** The program's records older than `term`, as a Mongo $or on academicYear/semester. */
const olderThan = async (Model, term, filter = {}) => {
  const pairs = await Model.aggregate([
    { $match: { ...filter, program: term.program } },
    { $group: { _id: { academicYear: '$academicYear', semester: '$semester' } } },
  ]);
  const older = pairs
    .map((p) => p._id)
    .filter((p) => p.academicYear && termKey(p.academicYear, p.semester) < termKey(term.academicYear, term.semester));
  return older.length ? { $or: older.map((p) => ({ academicYear: p.academicYear, semester: p.semester })) } : null;
};

/** What applying a term would do to its program, without changing anything. */
const previewApply = async (term) => {
  if (Number(term.semester) === 3) return { sectionsToMove: 0, schedulesToArchive: 0, sectionsAlreadyInTerm: 0, calendarOnly: true };
  const { program } = term;
  const [sectionsOlder, schedulesOlder] = await Promise.all([
    olderThan(lazy.Section, term, { isActive: { $ne: false } }),
    olderThan(lazy.Schedule, term, { isActive: true }),
  ]);
  const [sections, schedules, alreadyIn] = await Promise.all([
    sectionsOlder ? lazy.Section.countDocuments({ program, isActive: { $ne: false }, ...sectionsOlder }) : 0,
    schedulesOlder ? lazy.Schedule.countDocuments({ program, isActive: true, ...schedulesOlder }) : 0,
    lazy.Section.countDocuments({ program, isActive: { $ne: false }, academicYear: term.academicYear, semester: term.semester }),
  ]);
  return { sectionsToMove: sections, schedulesToArchive: schedules, sectionsAlreadyInTerm: alreadyIn };
};

/**
 * Move the term's program into it. Safe to run more than once: sections
 * already in the term (or a later one) are left alone; snapshots are upserted.
 */
const applyTerm = async (termDoc, { actor } = {}) => {
  const term = termDoc.toObject ? termDoc.toObject() : termDoc;
  const { program } = term;
  const summary = { program, sectionsMoved: 0, sectionsArchived: 0, schedulesArchived: 0, classSpacesArchived: 0, studentsUpdated: 0 };
  if (!program) throw new Error('A term must belong to a program');

  // Summer term: dates only. Sections stay in 2nd semester until the next
  // 1st semester starts, which archives both.
  if (Number(term.semester) === 3) {
    await AcademicTerm.updateOne({ _id: term._id }, { $set: { appliedAt: new Date() } });
    clearCache();
    return { ...summary, calendarOnly: true };
  }

  // 1. The program's sections from earlier terms: snapshot, then move
  const sectionsOlder = await olderThan(lazy.Section, term, { isActive: { $ne: false } });
  const sections = sectionsOlder ? await lazy.Section.find({ program, isActive: { $ne: false }, ...sectionsOlder }) : [];

  for (const section of sections) {
    const [students, scheduleCount] = await Promise.all([
      lazy.Student.find({ sectionCode: section.sectionCode }).populate('user', 'firstName lastName').select('studentId user').lean(),
      lazy.Schedule.countDocuments({ sectionCode: section.sectionCode, academicYear: section.academicYear, semester: section.semester, isActive: true }),
    ]);
    await SectionArchive.updateOne(
      { section: section._id, academicYear: section.academicYear, semester: section.semester },
      {
        $set: {
          sectionCode: section.sectionCode,
          program: section.program,
          yearLevel: section.yearLevel,
          sectionLetter: section.sectionLetter,
          shift: section.shift,
          adviser: section.adviser || null,
          room: section.room || null,
          maxStudents: section.maxStudents,
          students: students.map((s) => ({
            student: s._id,
            studentId: s.studentId,
            name: s.user ? `${s.user.firstName} ${s.user.lastName}`.trim() : s.studentId,
          })),
          studentCount: students.length,
          scheduleCount,
          archivedAt: new Date(),
        },
      },
      { upsert: true }
    );
    summary.sectionsArchived += 1;

    section.academicYear = term.academicYear;
    section.semester = term.semester;
    await section.save();
    summary.sectionsMoved += 1;
  }

  // 2. The program's schedules (and class spaces) from earlier terms leave live views
  const schedulesOlder = await olderThan(lazy.Schedule, term, { isActive: true });
  if (schedulesOlder) {
    const old = await lazy.Schedule.find({ program, isActive: true, ...schedulesOlder }).select('_id').lean();
    const ids = old.map((s) => s._id);
    if (ids.length) {
      const r1 = await lazy.Schedule.updateMany({ _id: { $in: ids } }, { $set: { status: 'archived', isActive: false } });
      const r2 = await lazy.ClassSpace.updateMany({ schedule: { $in: ids }, isActive: true }, { $set: { isActive: false } });
      summary.schedulesArchived = r1.modifiedCount || 0;
      summary.classSpacesArchived = r2.modifiedCount || 0;
    }
  }

  // 3. The program's students follow the term (graduated/dropped stay as they were)
  const studentsOlder = await olderThan(lazy.Student, term, { enrollmentStatus: { $nin: ['graduated', 'dropped'] } });
  if (studentsOlder) {
    const r = await lazy.Student.updateMany(
      { program, enrollmentStatus: { $nin: ['graduated', 'dropped'] }, ...studentsOlder },
      { $set: { academicYear: term.academicYear, semester: term.semester, enrolledClasses: [] } }
    );
    summary.studentsUpdated = r.modifiedCount || 0;
  }

  await AcademicTerm.updateOne({ _id: term._id }, { $set: { appliedAt: new Date() } });
  clearCache();

  // Open pages refetch; the program's staff get a note of what happened
  try {
    const realtime = require('./realtime.service');
    realtime.publishWhere((c) => c.role !== 'program_manager' || c.program === program, 'changed', {
      topics: ['schedule', 'classes', 'profile', 'students', 'term'],
    });
    const { notify, staffUsers } = require('./inAppNotification.service');
    const staff = await staffUsers(program);
    await notify(staff, {
      type: 'system',
      title: `${program}: ${termLabel(term)} has started`,
      message: `${summary.sectionsMoved} ${program} section${summary.sectionsMoved === 1 ? '' : 's'} moved into the new term; `
        + `${summary.schedulesArchived} schedule${summary.schedulesArchived === 1 ? '' : 's'} from earlier terms archived.`,
      link: '/semesters',
      metadata: { kind: 'term-started' },
      actorName: actor || undefined,
    });
  } catch (_) { /* notifications are best effort */ }

  console.log(`📅 Applied ${program} ${termLabel(term)}:`, summary);
  return summary;
};

let applying = null;

/** Apply every program's current term that hasn't been applied yet. */
const autoApply = async () => {
  if (applying) return applying;
  applying = (async () => {
    try {
      const now = new Date();
      const due = await AcademicTerm.find({ appliedAt: null, startDate: { $lte: now }, endDate: { $gte: startOfDay(now) } }).lean();
      const results = [];
      for (const term of due) results.push(await applyTerm(term));
      return results;
    } catch (error) {
      console.error('Term auto-apply failed:', error.message);
      return null;
    } finally {
      applying = null;
    }
  })();
  return applying;
};

/**
 * Terms saved before semesters were per program have no `program`. Give them
 * one: the creator's program when a program manager made them, otherwise a
 * copy for every program (campus-wide was the intent at the time).
 */
const migrateCampusTerms = async () => {
  const User = require('../models/User.model');
  const legacy = await AcademicTerm.collection.find({ $or: [{ program: { $exists: false } }, { program: null }] }).toArray();
  if (!legacy.length) return 0;
  const programs = await activePrograms();
  for (const term of legacy) {
    const creator = term.createdBy ? await User.findById(term.createdBy).select('role program').lean() : null;
    if (creator?.role === 'program_manager' && creator.program) {
      await AcademicTerm.collection.updateOne({ _id: term._id }, { $set: { program: creator.program } });
      continue;
    }
    const { _id, ...rest } = term;
    for (const program of programs) {
      const exists = await AcademicTerm.collection.findOne({ program, academicYear: term.academicYear, semester: term.semester });
      if (!exists) await AcademicTerm.collection.insertOne({ ...rest, program });
    }
    await AcademicTerm.collection.deleteOne({ _id });
  }
  clearCache();
  console.log(`📅 Gave ${legacy.length} older term(s) a program`);
  return legacy.length;
};

const startTermWatcher = () => {
  // Terms used to be campus-wide with a unique (academicYear, semester)
  // index; per-program terms need that index gone, and older terms a program
  (async () => {
    try {
      await AcademicTerm.collection.dropIndex('academicYear_1_semester_1').catch(() => {});
      await migrateCampusTerms();
      await AcademicTerm.syncIndexes();
    } catch (e) {
      console.error('AcademicTerm migration failed:', e.message);
    }
  })();
  setTimeout(autoApply, 15000);
  return setInterval(autoApply, 30 * 60 * 1000);
};

module.exports = {
  SEMESTER_LABEL,
  termKey,
  termLabel,
  describe,
  activePrograms,
  getCurrentTerm,
  getDefaultTerm,
  calendarTerm,
  clearCache,
  previewApply,
  applyTerm,
  autoApply,
  startTermWatcher,
};
