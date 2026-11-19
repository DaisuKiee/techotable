/**
 * Campus-wide schedule conflict scan.
 *
 * This powers `GET /api/schedules/conflicts` and the dashboard's conflict
 * badge. It answers "is anything wrong with what is already saved?", which is
 * the opposite direction from `schedule.controller.js::checkScheduleConflicts()`
 * - that one asks "may I place this one class here?". The two must agree about
 * what counts as a clash, so the rules below are kept in step with it.
 *
 * Three faults were found here during the Appendix G audit:
 *
 *   1. Room double-bookings could never be reported. The comparison was
 *      `schedule1.roomLabel === schedule2.roomLabel`, but `roomLabel` is a
 *      display field attached by `utils/roomLabel.attachScheduleRoomLabels()`,
 *      which this service never called - so both sides were `undefined`, the
 *      `&&` guard short-circuited, and the branch was dead code. Every
 *      conflict's `room` also came back `undefined` for the same reason.
 *      Comparison is now on the stored `room` value; labels are attached
 *      separately, for display only.
 *
 *   2. Schedules from different terms were compared with each other, so last
 *      year's class in a room appeared to clash with this year's. Pairs are
 *      now only compared within the same academic year and semester.
 *
 *   3. The combined-NSTP exception was missing. NSTP is one class taught to
 *      several first-year sections at once, so its teacher legitimately
 *      appears in two sections in the same hour.
 */

const Schedule = require('../models/Schedule.model');
const { attachScheduleRoomLabels } = require('../utils/roomLabel');

/**
 * Convert time string to minutes for comparison
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if two time ranges overlap
 */
const timesOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && s2 < e1;
};

/**
 * NSTP is a combined class: one instructor takes several first-year sections
 * in the same hour. Mirrors `mentionsNSTP` in schedule.controller.js.
 */
const mentionsNSTP = (schedule) =>
  /NSTP/i.test(`${schedule?.subject?.subjectCode || ''} ${schedule?.subject?.subjectName || ''}`);

/** Which term a saved class belongs to. Classes in different terms never clash. */
const termKey = (schedule) => `${schedule.academicYear || ''}|${schedule.semester ?? ''}`;

const facultyIdOf = (schedule) => {
  const raw = schedule.faculty?._id || schedule.faculty;
  return raw ? String(raw) : null;
};

const facultyNameOf = (schedule) => {
  const user = schedule.faculty?.user;
  if (!user) return 'N/A';
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
};

/**
 * Detect all schedule conflicts.
 *
 * @param {object} [filter] optional narrowing, e.g. `{ academicYear, semester, program }`.
 *   Whatever is passed is added to the query; term grouping happens either way.
 */
const detectAllConflicts = async (filter = {}) => {
  try {
    const query = { isActive: true };
    if (filter.academicYear) query.academicYear = filter.academicYear;
    if (filter.semester !== undefined && filter.semester !== null) {
      query.semester = filter.semester;
    }
    if (filter.program) query.program = filter.program;

    const schedules = await Schedule.find(query)
      .populate('subject', 'subjectCode subjectName')
      .populate({
        path: 'faculty',
        select: 'employeeId',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .lean();

    // `Schedule.room` stores a Room id in a String field, so it cannot be
    // populated. Resolve the display labels in one batched query; the clash
    // comparison below uses the stored value, not the label.
    await attachScheduleRoomLabels(schedules);

    const conflicts = [];
    const conflictMap = new Set();

    // Only compare classes that belong to the same term.
    const byTerm = new Map();
    for (const schedule of schedules) {
      if (!schedule.timeSlots || schedule.timeSlots.length === 0) continue;
      const key = termKey(schedule);
      if (!byTerm.has(key)) byTerm.set(key, []);
      byTerm.get(key).push(schedule);
    }

    const brief = (schedule, extra = {}) => ({
      id: schedule._id,
      subject: schedule.subject?.subjectCode || 'N/A',
      subjectName: schedule.subject?.subjectName || '',
      section: schedule.sectionCode,
      ...extra,
    });

    for (const group of byTerm.values()) {
      for (let i = 0; i < group.length; i++) {
        const schedule1 = group[i];

        for (let j = i + 1; j < group.length; j++) {
          const schedule2 = group[j];

          for (const slot1 of schedule1.timeSlots) {
            for (const slot2 of schedule2.timeSlots) {
              if (slot1.day !== slot2.day) continue;
              if (!timesOverlap(slot1.startTime, slot1.endTime, slot2.startTime, slot2.endTime)) {
                continue;
              }

              const when = {
                day: slot1.day,
                timeRange: `${slot1.startTime} - ${slot1.endTime}`,
              };
              const once = (key, build) => {
                if (conflictMap.has(key)) return;
                conflictMap.add(key);
                conflicts.push(build());
              };

              // --- Faculty double-booking -------------------------------
              const faculty1 = facultyIdOf(schedule1);
              const faculty2 = facultyIdOf(schedule2);
              const sameFaculty = faculty1 && faculty2 && faculty1 === faculty2;
              // NSTP is one combined class across sections: not a clash.
              const bothNSTP = mentionsNSTP(schedule1) && mentionsNSTP(schedule2);

              if (sameFaculty && !bothNSTP) {
                once(`faculty-${faculty1}-${slot1.day}-${slot1.startTime}`, () => ({
                  type: 'FACULTY_DOUBLE_BOOKING',
                  severity: 'high',
                  ...when,
                  faculty: {
                    id: faculty1,
                    name: facultyNameOf(schedule1),
                    employeeId: schedule1.faculty?.employeeId,
                  },
                  schedules: [
                    brief(schedule1, { room: schedule1.roomLabel ?? null }),
                    brief(schedule2, { room: schedule2.roomLabel ?? null }),
                  ],
                }));
              }

              // --- Room double-booking ----------------------------------
              // Compare the stored value. Two classes in the same room at the
              // same time are a clash whichever programs they belong to.
              const room1 = schedule1.room ? String(schedule1.room) : null;
              const room2 = schedule2.room ? String(schedule2.room) : null;

              if (room1 && room2 && room1 === room2) {
                once(`room-${room1}-${slot1.day}-${slot1.startTime}`, () => ({
                  type: 'ROOM_DOUBLE_BOOKING',
                  severity: 'high',
                  ...when,
                  room: schedule1.roomLabel ?? room1,
                  schedules: [
                    brief(schedule1, { faculty: facultyNameOf(schedule1) }),
                    brief(schedule2, { faculty: facultyNameOf(schedule2) }),
                  ],
                }));
              }

              // --- Section double-booking -------------------------------
              const section1 = schedule1.sectionCode;
              const section2 = schedule2.sectionCode;

              if (section1 && section2 && String(section1).toUpperCase() === String(section2).toUpperCase()) {
                once(`section-${String(section1).toUpperCase()}-${slot1.day}-${slot1.startTime}`, () => ({
                  type: 'SECTION_DOUBLE_BOOKING',
                  severity: 'medium',
                  ...when,
                  section: section1,
                  schedules: [
                    brief(schedule1, {
                      room: schedule1.roomLabel ?? null,
                      faculty: facultyNameOf(schedule1),
                    }),
                    brief(schedule2, {
                      room: schedule2.roomLabel ?? null,
                      faculty: facultyNameOf(schedule2),
                    }),
                  ],
                }));
              }
            }
          }
        }
      }
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    conflicts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      totalConflicts: conflicts.length,
      highSeverity: conflicts.filter((c) => c.severity === 'high').length,
      mediumSeverity: conflicts.filter((c) => c.severity === 'medium').length,
      lowSeverity: conflicts.filter((c) => c.severity === 'low').length,
      conflicts,
    };
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    throw error;
  }
};

/**
 * Get conflict summary for dashboard
 */
const getConflictSummary = async (filter = {}) => {
  try {
    const result = await detectAllConflicts(filter);

    return {
      hasConflicts: result.totalConflicts > 0,
      totalConflicts: result.totalConflicts,
      highSeverity: result.highSeverity,
      mediumSeverity: result.mediumSeverity,
      criticalConflicts: result.conflicts.filter((c) => c.severity === 'high').slice(0, 5), // Top 5 critical
    };
  } catch (error) {
    console.error('Error getting conflict summary:', error);
    throw error;
  }
};

module.exports = {
  detectAllConflicts,
  getConflictSummary,
  timesOverlap,
  timeToMinutes,
  __test__: { mentionsNSTP, termKey },
};
