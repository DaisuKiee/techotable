const Section = require('../models/Section.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const Student = require('../models/Student.model');
const { sendError } = require('../middleware/error.middleware');
const terms = require('../services/academicTerm.service');
const { loadRoomsByRawValues, labelFor, looksLikeObjectId } = require('../utils/roomLabel');

const LAB_TYPES = ['Laboratory', 'Computer Lab', 'Workshop'];

/**
 * @desc    Everything worth knowing about a section before generating its
 *          timetable: term, subjects to schedule (and which are done), who
 *          can teach each one, rooms, and problems that will stop the solver.
 *          Uses the same rules as the solver (services/ortoolsBridge loadInputs).
 * @route   GET /api/schedules/generation-info/:sectionId
 * @access  Private (staff)
 */
exports.getGenerationInfo = async (req, res) => {
  try {
    const section = await Section.findById(req.params.sectionId).lean();
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    if (req.user.role === 'program_manager' && section.program !== req.user.program) {
      return res.status(403).json({ success: false, message: 'This section belongs to another program' });
    }

    const { program, yearLevel, semester, academicYear, sectionCode } = section;

    const [subjects, faculty, rooms, existing, studentCount, current] = await Promise.all([
      Subject.find({ program, yearLevel, semester, isActive: true }).select('subjectCode subjectName units lectureHours labHours').sort({ subjectCode: 1 }).lean(),
      Faculty.find({
        isActive: true,
        $or: [{ programs: program }, { 'teachingHistory.program': program }, { programs: { $size: 0 } }],
      }).select('teachingHistory.subjectCode experiencedSubjects specializations maxTeachingHours').lean(),
      Room.find({ isActive: true }).select('roomType capacity').lean(),
      Schedule.find({ sectionCode, academicYear, semester, isActive: true }).populate('subject', 'subjectCode').select('subject timeSlots').lean(),
      Student.countDocuments({ sectionCode }),
      terms.getCurrentTerm(program),
    ]);

    // Who has taught each subject before (by code)
    const taught = new Map();
    faculty.forEach((f) => {
      const codes = new Set([
        ...(f.teachingHistory || []).map((h) => h.subjectCode),
        ...(f.experiencedSubjects || []).map((e) => e.subjectCode),
      ].filter(Boolean).map((c) => String(c).toUpperCase()));
      codes.forEach((c) => taught.set(c, (taught.get(c) || 0) + 1));
    });

    const scheduledCodes = new Set(existing.map((s) => String(s.subject?.subjectCode || '').toUpperCase()).filter(Boolean));
    const isNstp = (code) => /^NSTP/i.test(code || '');

    const subjectRows = subjects.map((s) => {
      const code = String(s.subjectCode || '').toUpperCase();
      const hours = (s.lectureHours || 0) + (s.labHours || 0) || s.units || 0;
      return {
        _id: s._id,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        units: s.units || 0,
        lectureHours: s.lectureHours || 0,
        labHours: s.labHours || 0,
        weeklyHours: hours,
        needsLab: (s.labHours || 0) > 0 && !isNstp(code),
        saturdayOnly: isNstp(code),
        scheduled: scheduledCodes.has(code),
        experiencedFaculty: taught.get(code) || 0,
      };
    });

    const toSchedule = subjectRows.filter((s) => !s.scheduled);
    const labRooms = rooms.filter((r) => LAB_TYPES.includes(r.roomType)).length;

    let homeRoom = null;
    if (section.room) {
      if (looksLikeObjectId(String(section.room))) {
        const map = await loadRoomsByRawValues([String(section.room)]);
        homeRoom = labelFor(map.get(String(section.room)));
      } else homeRoom = section.room;
    }

    // Things that will stop or weaken the run, most serious first
    const warnings = [];
    if (!subjects.length) warnings.push({ level: 'error', text: `No active subjects for ${program} year ${yearLevel}, semester ${semester}. Add them on the Subjects page first.` });
    if (!faculty.length) warnings.push({ level: 'error', text: `No active faculty are assigned to ${program}.` });
    if (subjects.length && !toSchedule.length) warnings.push({ level: 'info', text: 'Every subject is already scheduled for this section. Generating again only fills gaps.' });
    if (toSchedule.some((s) => s.needsLab) && !labRooms) warnings.push({ level: 'error', text: 'Some subjects need a laboratory, but there are no active lab rooms.' });
    const noExperience = toSchedule.filter((s) => !s.experiencedFaculty && !s.saturdayOnly);
    if (noExperience.length) {
      warnings.push({ level: 'warning', text: `No one has taught ${noExperience.map((s) => s.subjectCode).join(', ')} before; any qualified ${program} teacher can be assigned.` });
    }
    if (!homeRoom) warnings.push({ level: 'warning', text: 'This section has no home room, so lecture classes may land in different rooms. Set one on the Sections page.' });
    const behind = current && terms.termKey(academicYear, semester) < terms.termKey(current.academicYear, current.semester);
    if (behind) warnings.push({ level: 'warning', text: `This section is still on ${terms.termLabel(section)}, but the current term is ${terms.termLabel(current)}.` });

    res.json({
      success: true,
      data: {
        section: {
          _id: section._id,
          sectionCode,
          program,
          yearLevel,
          semester,
          academicYear,
          shift: section.shift,
          maxStudents: section.maxStudents,
          students: studentCount,
          homeRoom,
          termLabel: terms.termLabel(section),
        },
        currentTerm: current ? terms.describe(current) : null,
        isCurrentTerm: !!current && current.academicYear === academicYear && current.semester === semester,
        subjects: subjectRows,
        totals: {
          subjects: subjectRows.length,
          toSchedule: toSchedule.length,
          scheduled: subjectRows.length - toSchedule.length,
          units: toSchedule.reduce((n, s) => n + s.units, 0),
          weeklyHours: toSchedule.reduce((n, s) => n + s.weeklyHours, 0),
          allUnits: subjectRows.reduce((n, s) => n + s.units, 0),
          allWeeklyHours: subjectRows.reduce((n, s) => n + s.weeklyHours, 0),
          labSubjects: toSchedule.filter((s) => s.needsLab).length,
        },
        resources: {
          faculty: faculty.length,
          rooms: rooms.length,
          labRooms,
          lectureRooms: rooms.length - labRooms,
        },
        warnings,
      },
    });
  } catch (error) {
    sendError(res, error, 'Could not load section details');
  }
};
