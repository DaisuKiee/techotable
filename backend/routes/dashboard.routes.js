const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { sendError } = require('../middleware/error.middleware');

// Import models
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const Section = require('../models/Section.model');
const ClassSpace = require('../models/ClassSpace.model');
const Student = require('../models/Student.model');

const count = (Model, filter) => Model.countDocuments(filter);
const distinctCount = async (Model, field, filter) => (await Model.distinct(field, filter)).filter(Boolean).length;

/**
 * A short cache, keyed by scope.
 *
 * These counts take eighteen separate round trips to the database (one
 * `findOne` plus seventeen counts). They are already issued in parallel, so
 * the cost is not the work but the latency: against a remote Atlas cluster a
 * round trip measures ~59 ms here, and at thirty concurrent dashboards that is
 * ~540 queries in flight, which overruns the connection pool and queues. The
 * measured result was 1.4 s average at ten users and 3.6 s at thirty.
 *
 * Dashboard counts are a summary that nobody expects to be live to the second,
 * so one caller pays for the queries and everyone arriving in the next few
 * seconds is served from memory. A single in-flight promise per scope is kept
 * as well, so a burst of simultaneous first requests makes one trip to the
 * database between them rather than one each.
 *
 * Cache lifetime is deliberately short. Publishing a timetable changes these
 * numbers, and a chairperson refreshing the page should see that quickly.
 */
const STATS_TTL_MS = Number(process.env.DASHBOARD_STATS_TTL_MS || 15000);
const statsCache = new Map(); // scope -> { at, value } | { inFlight }

const cachedStats = async (scopeKey, build) => {
  const now = Date.now();
  const hit = statsCache.get(scopeKey);

  if (hit?.value && now - hit.at < STATS_TTL_MS) return hit.value;
  if (hit?.inFlight) return hit.inFlight;

  const inFlight = build()
    .then((value) => {
      statsCache.set(scopeKey, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      statsCache.delete(scopeKey);
      throw err;
    });

  statsCache.set(scopeKey, { inFlight, at: now, value: hit?.value });
  return inFlight;
};

// @route   GET /api/dashboard/stats
// @desc    Dashboard counts. Program managers get their own program only.
// @access  Private (Admin, Scheduling Officer, Program Manager)
//
// Several of these used to be wrong: schedules counted deleted ones (96 vs 37
// live), "published" queried an isPublished field that doesn't exist (always
// 0), and every program-manager figure came back 0 when program was missing.
router.get(
  '/stats',
  protect,
  authorize('admin', 'scheduling_officer', 'program_manager'),
  async (req, res) => {
    try {
      const program = req.user.role === 'program_manager' ? req.user.program || '__none__' : null;
      const byProgram = program ? { program } : {};
      const liveSchedules = { isActive: true, ...byProgram };

      const data = await cachedStats(program || '__all__', async () => {

      // Subject coverage only makes sense for the semester being scheduled;
      // counting both semesters' subjects reported half the catalogue as
      // "not scheduled". Use the term of the latest live schedule.
      const latest = await Schedule.findOne(liveSchedules).sort({ academicYear: -1, semester: -1 }).select('academicYear semester').lean();
      const term = latest ? { academicYear: latest.academicYear, semester: latest.semester } : null;

      const [
        totalUsers,
        activeUsers,
        pendingFaculty,
        totalFaculty,
        activeFaculty,
        teachingFaculty,
        totalSubjects,
        scheduledSubjects,
        totalRooms,
        totalSchedules,
        publishedSchedules,
        draftSchedules,
        totalSections,
        totalClasses,
        totalStudents,
        enrolledStudents,
        unassignedStudents,
      ] = await Promise.all([
        program ? 0 : count(User, {}),
        program ? 0 : count(User, { isActive: true }),
        program ? 0 : count(User, { role: 'faculty', isPending: true }),
        count(Faculty, program ? { programs: program } : {}),
        count(Faculty, { isActive: true, ...(program && { programs: program }) }),
        distinctCount(Schedule, 'faculty', liveSchedules),
        count(Subject, { isActive: { $ne: false }, ...byProgram, ...(term && { semester: term.semester }) }),
        distinctCount(Schedule, 'subject', { ...liveSchedules, ...(term && { semester: term.semester }) }),
        count(Room, { isActive: { $ne: false } }),
        count(Schedule, liveSchedules),
        count(Schedule, { ...liveSchedules, status: 'published' }),
        count(Schedule, { ...liveSchedules, status: 'draft' }),
        count(Section, { isActive: { $ne: false }, ...byProgram }),
        count(ClassSpace, { isActive: true, ...byProgram }),
        count(Student, byProgram),
        count(Student, { ...byProgram, enrollmentStatus: 'enrolled' }),
        count(Student, { ...byProgram, sectionCode: { $in: [null, ''] } }),
      ]);

      return {
        scope: program || 'all',
        term,
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        pendingFaculty,
        totalFaculty,
        activeFaculty,
        teachingFaculty,
        totalSubjects,
        scheduledSubjects,
        totalRooms,
        totalSchedules,
        publishedSchedules,
        draftSchedules,
        totalSections,
        totalClasses,
        totalStudents,
        enrolledStudents,
        unassignedStudents,
        // Older field names, kept for any screen still reading them
        programStudents: program ? totalStudents : 0,
        programSubjects: program ? totalSubjects : 0,
        programSchedules: program ? totalSchedules : 0,
      };
      });

      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to load dashboard statistics');
    }
  }
);

module.exports = router;
