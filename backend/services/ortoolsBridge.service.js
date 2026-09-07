/**
 * OR-Tools Bridge Service
 *
 * Feeds the CP-SAT solver in python/ortools_scheduler.py and maps its output
 * back onto Schedule documents.
 *
 * What the solver is given, beyond subjects/faculty/rooms:
 *  - the REAL Section documents, so generated classes carry the section code
 *    students actually joined with (a fabricated code produces class spaces
 *    nobody is enrolled in);
 *  - schedules that are already saved for the term, as immovable blocks, so a
 *    generated timetable cannot land on top of a published one;
 *  - each teacher's recency-weighted experience with each subject, so the
 *    solver prefers whoever has actually taught it - the same rule the faculty
 *    recommender uses;
 *  - declared unavailability and existing teaching load.
 */

const { spawn } = require('child_process');
const path = require('path');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Section = require('../models/Section.model');
const Schedule = require('../models/Schedule.model');
require('../models/User.model');
const { summarizeSubjectExperience } = require('../utils/teachingExperience');

const PYTHON_SCRIPT = path.join(__dirname, '../python/ortools_scheduler.py');

/**
 * Python interpreters to try, in order.
 *
 * Hardcoding `python` broke on hosts where only `python3` exists (most Linux
 * images, including Render), and the failure surfaced as an unhelpful
 * "exited with code 1".
 */
const pythonCandidates = () => {
  const configured = process.env.PYTHON_BIN;
  return configured ? [configured] : ['python', 'python3', 'py'];
};

/** Day-shift grid: 07:00-17:00 with a marked lunch break (matches CTU Program by Section timetable grid). */
function generateDayTimeSlots() {
  return [
    { start: '07:00', end: '08:00' },
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    // Flagged lunch break slot (12:00 - 1:00 PM)
    { start: '12:00', end: '13:00', is_break: true },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
  ];
}

/** Night-shift grid: 16:00-22:00. */
function generateNightTimeSlots() {
  return [
    { start: '16:00', end: '17:00' },
    { start: '17:00', end: '18:00' },
    { start: '18:00', end: '19:00' },
    { start: '19:00', end: '20:00' },
    { start: '20:00', end: '21:00' },
    { start: '21:00', end: '22:00' },
  ];
}

/**
 * A teacher's affinity for a subject, 0-100, from their teaching history.
 *
 * Recency-weighted so someone who taught it last year outranks someone who
 * taught it five years ago. Only the experience signal is passed to the solver;
 * specialization, workload and qualifications are modelled there directly, so
 * folding them in here would double-count them.
 */
function experienceScore(facultyDoc, subject) {
  const exp = summarizeSubjectExperience(facultyDoc, subject);
  if (!exp.timesTaught) return 0;

  const base = Math.min(90, Math.round(exp.weightedExperience * 25));
  const ratingBonus = exp.avgRating ? Math.round((exp.avgRating / 5) * 10) : 0;
  return Math.min(100, base + ratingBonus);
}

/**
 * Load everything the solver needs for one generation run.
 */
async function loadInputs({ academicYear, semester, program, yearLevel, section, shift }) {
  const [subjects, facultyDocs, rooms, sections] = await Promise.all([
    Subject.find({ program, yearLevel, semester, isActive: true }).lean(),

    // Restrict to faculty who can teach in this program, the same rule the
    // recommender applies. Passing all 70 faculty made the model far larger and
    // let the solver assign teachers from unrelated programs.
    Faculty.find({
      isActive: true,
      $or: [
        { programs: program },
        { 'teachingHistory.program': program },
        { programs: { $size: 0 } },
      ],
    }).populate('user', 'firstName lastName').lean(),

    Room.find({ isActive: true }).lean(),

    Section.find({
      program,
      yearLevel,
      semester,
      academicYear,
      ...(shift ? { shift } : {}),
      ...(section ? { sectionLetter: String(section).toUpperCase() } : {}),
      isActive: true,
    }).lean(),
  ]);

  if (subjects.length === 0) {
    throw new Error(
      `No active subjects found for ${program} year ${yearLevel} semester ${semester}.`
    );
  }
  if (facultyDocs.length === 0) {
    throw new Error(`No active faculty are assigned to ${program}.`);
  }
  if (rooms.length === 0) {
    throw new Error('No active rooms available.');
  }

  // Existing classes for this term become immovable blocks
  const existing = await Schedule.find({
    academicYear,
    semester,
    isActive: true,
  }).select('faculty room sectionCode subject timeSlots').lean();

  return { subjects, facultyDocs, rooms, sections, existing };
}

/**
 * Shape the payload for the Python solver.
 */
function preparePythonInput(data) {
  const {
    subjects, facultyDocs, rooms, sections, existing,
    section, timeLimit, shift, academicYear, semester, program, yearLevel, weights,
  } = data;

  const preparedSubjects = subjects.map(subj => ({
    _id: subj._id.toString(),
    subject_code: subj.subjectCode,
    subject_name: subj.subjectName,
    units: subj.units,
    lecture_hours: subj.lectureHours || 0,
    lab_hours: subj.labHours || 0,
    needs_lab: (subj.labHours || 0) > 0,
    required_qualifications: subj.requiredQualifications || [],
    program: subj.program,
    year_level: subj.yearLevel,
  }));

  const preparedFaculty = facultyDocs.map(fac => {
    // subject id -> 0-100 affinity, consumed by the solver's objective
    const experience = {};
    for (const subj of subjects) {
      const score = experienceScore(fac, subj);
      if (score > 0) experience[subj._id.toString()] = score;
    }

    return {
      _id: fac._id.toString(),
      employee_id: fac.employeeId,
      name: `${fac.user?.firstName || ''} ${fac.user?.lastName || ''}`.trim() || fac.employeeId,
      user_id: fac.user?._id?.toString(),
      specializations: fac.specializations || [],
      max_teaching_load: fac.maxTeachingLoad || 24,
      current_load: fac.currentLoad || 0,
      qualifications: (fac.qualifications || []).map(q => ({ degree: q.degree, field: q.field })),
      unavailable: (fac.unavailableTimeSlots || []).map(u => ({
        day: u.day, start: u.startTime, end: u.endTime,
      })),
      experience,
    };
  });

  const preparedRooms = rooms.map(room => ({
    _id: room._id.toString(),
    room_code: room.roomCode,
    room_number: room.roomNumber,
    room_type: room.roomType,
    capacity: room.capacity,
    building: room.building || 'Main',
    facilities: room.facilities || [],
  }));

  // Prefer real sections. Only fall back to a synthetic one when the section
  // record does not exist yet, and keep the app's own code format.
  const preparedSections = sections.length > 0
    ? sections.map(s => ({
        code: s.sectionCode,
        letter: s.sectionLetter,
        max_students: s.maxStudents || 40,
      }))
    : [{
        code: `${program}-${yearLevel}${String(section || 'A').toUpperCase()}-${(shift || 'Day')[0]}`,
        letter: String(section || 'A').toUpperCase(),
        max_students: 40,
      }];

  const timeSlots = shift === 'Night' ? generateNightTimeSlots() : generateDayTimeSlots();
  const slotStarts = new Set(timeSlots.map(s => s.start));
  const sectionCodes = new Set(preparedSections.map(s => s.code));

  // Flatten saved schedules into per-meeting busy blocks. Only meetings that
  // land on this shift's grid can constrain it.
  const preparedExisting = [];
  // Subjects the target sections already have, so the solver fills gaps instead
  // of generating a second offering of the same subject.
  const alreadyScheduled = {};

  for (const row of existing) {
    if (sectionCodes.has(row.sectionCode) && row.subject) {
      (alreadyScheduled[row.sectionCode] ||= []).push(String(row.subject));
    }
    for (const slot of row.timeSlots || []) {
      if (!slotStarts.has(slot.startTime)) continue;
      preparedExisting.push({
        faculty_id: row.faculty ? String(row.faculty) : null,
        room_id: row.room ? String(row.room) : null,
        section_code: sectionCodes.has(row.sectionCode) ? row.sectionCode : null,
        day: slot.day,
        start_time: slot.startTime,
        end_time: slot.endTime,
      });
    }
  }

  return {
    subjects: preparedSubjects,
    faculty: preparedFaculty,
    rooms: preparedRooms,
    sections: preparedSections,
    existing: preparedExisting,
    already_scheduled: alreadyScheduled,
    time_limit: timeLimit,
    shift,
    // Sunday was previously included, so the solver could place classes on it
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    time_slots: timeSlots,
    options: {
      max_block_hours: 3,
      workers: 8,
      ...(weights ? { weights } : {}),
    },
    parameters: {
      academic_year: academicYear,
      semester,
      program,
      year_level: yearLevel,
    },
  };
}

/**
 * Run the solver, trying each candidate interpreter until one starts.
 */
function callPythonOptimizer(inputData, timeoutSeconds) {
  const payload = JSON.stringify(inputData);

  const attempt = (bins) => new Promise((resolve, reject) => {
    const [bin, ...rest] = bins;
    if (!bin) {
      reject(new Error(
        'Python was not found. Install Python 3 with `pip install ortools`, '
        + 'or set PYTHON_BIN to the interpreter path.'
      ));
      return;
    }

    let child;
    try {
      child = spawn(bin, [PYTHON_SCRIPT]);
    } catch (err) {
      resolve(attempt(rest));
      return;
    }

    let out = '';
    let errOut = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`The solver exceeded its ${timeoutSeconds}s time budget.`));
    }, timeoutSeconds * 1000);

    child.on('error', () => {
      // Interpreter missing: fall through to the next candidate
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve(attempt(rest));
    });

    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { errOut += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (code !== 0) {
        // A missing ortools package is the common case here, so name it
        const hint = /ModuleNotFoundError|No module named/.test(errOut)
          ? ' Install the solver with `pip install ortools`.'
          : '';
        reject(new Error(`Solver process failed (exit ${code}).${hint} ${errOut.trim().slice(-500)}`));
        return;
      }

      try {
        resolve(JSON.parse(out));
      } catch (err) {
        reject(new Error(
          `Could not read the solver output: ${err.message}. `
          + `Output: ${out.slice(0, 400)}`
        ));
      }
    });

    child.stdin.on('error', () => {});
    child.stdin.write(payload);
    child.stdin.end();
  });

  return attempt(pythonCandidates());
}

/**
 * Map solver output onto Schedule documents.
 */
function transformOptimizedSchedule(optimizerResult, params) {
  if (!optimizerResult.success || !optimizerResult.schedules) return [];

  const { academicYear, semester, program, yearLevel, shift } = params;

  return optimizerResult.schedules.map(schedule => ({
    academicYear,
    semester,
    program,
    yearLevel,
    section: schedule.section,
    // The solver returns the real section code; only fall back if it had none
    sectionCode: schedule.section_code
      || `${program}-${yearLevel}${schedule.section}-${(shift || 'Day')[0]}`,
    shift: shift || 'Day',
    subject: schedule.subject._id,
    faculty: schedule.faculty?._id || null,
    // Schedule.room is a String holding a Room _id. This used to write
    // room_code, which the room-label resolver could not look up, so every
    // generated class rendered its room as TBA.
    room: schedule.room?._id || null,
    timeSlots: (schedule.time_slots || []).map(slot => ({
      day: slot.day,
      startTime: slot.start_time,
      endTime: slot.end_time,
    })),
    maxStudents: schedule.room?.capacity || 40,
    status: 'draft',
    // Must be one of the model's enum values: manual | ai | constraint_solver.
    // This previously read 'ortools_cps at_solver', which failed validation, so
    // no OR-Tools schedule could ever be saved.
    generatedBy: 'constraint_solver',
    // The preview UI reads units, roomName and roomCapacity; without them it
    // rendered "undefined (Cap: undefined)" and a blank units badge.
    metadata: {
      subjectCode: schedule.subject.subject_code,
      subjectName: schedule.subject.subject_name,
      units: schedule.subject.units,
      facultyName: schedule.faculty?.name || 'Unassigned',
      facultyExperience: schedule.faculty
        ? (schedule.faculty.experience || {})[String(schedule.subject._id)] || 0
        : 0,
      roomName: schedule.room?.room_code || schedule.room?.room_number || 'TBA',
      roomNumber: schedule.room?.room_number || schedule.room?.room_code || 'TBA',
      roomCapacity: schedule.room?.capacity || null,
      totalHours: (schedule.time_slots || []).reduce((n, s) => n + (s.hours || 0), 0),
    },
  }));
}

/**
 * Build and solve, without touching the database.
 * @returns {Promise<{result, schedules, inputs}>}
 */
async function runSolver(params) {
  const {
    academicYear, semester, program, yearLevel,
    section, timeLimit = 60, shift = 'Day', weights,
  } = params;

  const inputs = await loadInputs({
    academicYear, semester, program, yearLevel, section, shift,
  });

  const pythonInput = preparePythonInput({
    ...inputs,
    section,
    timeLimit,
    shift,
    academicYear,
    semester,
    program,
    yearLevel,
    weights,
  });

  const result = await callPythonOptimizer(pythonInput, timeLimit + 15);
  const schedules = transformOptimizedSchedule(result, {
    academicYear, semester, program, yearLevel, shift,
  });

  return { result, schedules, inputs, pythonInput };
}

/** Shared statistics block for both generate and preview. */
function buildStatistics(result, inputs, pythonInput, schedules) {
  return {
    totalSubjects: inputs.subjects.length,
    scheduledSubjects: result.statistics?.subjects_scheduled || schedules.length,
    solverTime: result.statistics?.solver_time || 0,
    sections: pythonInput.sections.length,
    facultyConsidered: inputs.facultyDocs.length,
    busiestFacultyUnits: result.statistics?.busiest_faculty_units || 0,
    assignmentsWithExperience: result.statistics?.assignments_with_experience || 0,
    facultyLoad: result.statistics?.faculty_load || {},
    existingBlocksRespected: pythonInput.existing.length,
    // Tells the UI the result is a good timetable rather than a proven-optimal
    // one, so it can offer a longer budget.
    hitTimeLimit: !!result.statistics?.hit_time_limit,
  };
}

/**
 * Generate a schedule with CP-SAT. Does not persist; the caller saves.
 */
async function generateWithORTools(params) {
  try {
    const { result, schedules, inputs, pythonInput } = await runSolver(params);

    if (!result.success) {
      return {
        success: false,
        method: 'OR-Tools CP-SAT',
        status: result.status,
        error: result.error || 'The solver could not build a timetable.',
        blockers: result.blockers || [],
        diagnostics: result.diagnostics || [],
        schedules: [],
        statistics: {},
      };
    }

    return {
      success: true,
      method: 'OR-Tools CP-SAT',
      status: result.status,
      schedules,
      diagnostics: result.diagnostics || [],
      statistics: buildStatistics(result, inputs, pythonInput, schedules),
    };
  } catch (error) {
    console.error('OR-Tools generation error:', error.message);
    return {
      success: false,
      method: 'OR-Tools CP-SAT',
      error: error.message,
      schedules: [],
      statistics: {},
    };
  }
}

/**
 * Same solve, returned as a preview for review before saving.
 *
 * This used to be a stub that always answered "not yet implemented", so the
 * OR-Tools option in the preview dialog never did anything.
 */
async function previewWithORTools(params) {
  try {
    const { result, schedules, inputs, pythonInput } = await runSolver(params);

    if (!result.success) {
      return {
        success: false,
        method: 'OR-Tools CP-SAT',
        status: result.status,
        message: result.error || 'The solver could not build a timetable.',
        blockers: result.blockers || [],
        preview: {
          schedules: [],
          failed: inputs.subjects.map(s => ({
            subjectCode: s.subjectCode,
            reason: result.error || 'Not scheduled',
          })),
          conflicts: [],
          statistics: {
            totalSubjects: inputs.subjects.length,
            scheduledSubjects: 0,
            failedSubjects: inputs.subjects.length,
            conflictsDetected: 0,
          },
        },
      };
    }

    const scheduledSubjectIds = new Set(schedules.map(s => String(s.subject)));
    const skippedCodes = new Set((result.skipped || []).map(s => s.subject_code));
    const failed = inputs.subjects
      .filter(s => !scheduledSubjectIds.has(String(s._id)) && !skippedCodes.has(s.subjectCode))
      .map(s => ({ subjectCode: s.subjectCode, reason: 'Not placed by the solver' }));

    const skippedNote = skippedCodes.size > 0
      ? ` ${skippedCodes.size} subject(s) already scheduled and left untouched.`
      : '';

    return {
      success: true,
      method: 'OR-Tools CP-SAT',
      status: result.status,
      message: schedules.length === 0 && skippedCodes.size > 0
        ? 'Every subject for this section already has a schedule. Nothing to generate.'
        : `Solved in ${result.statistics?.solver_time || 0}s (${result.status}).${skippedNote}`,
      diagnostics: result.diagnostics || [],
      skipped: result.skipped || [],
      preview: {
        schedules,
        failed,
        // CP-SAT only returns feasible timetables, so a successful solve has no
        // clashes by construction.
        conflicts: [],
        statistics: {
          ...buildStatistics(result, inputs, pythonInput, schedules),
          failedSubjects: failed.length,
          conflictsDetected: 0,
        },
      },
    };
  } catch (error) {
    console.error('OR-Tools preview error:', error.message);
    return {
      success: false,
      method: 'OR-Tools CP-SAT',
      message: error.message,
      preview: {
        schedules: [], failed: [], conflicts: [],
        statistics: {
          totalSubjects: 0, scheduledSubjects: 0, failedSubjects: 0, conflictsDetected: 0,
        },
      },
    };
  }
}

/**
 * Is the solver usable on this host? Reports which interpreter answered.
 */
async function checkORToolsAvailability() {
  const probe = (bin) => new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, ['-c', 'import ortools; print(ortools.__version__)']);
    } catch (err) {
      resolve(null);
      return;
    }

    let out = '';
    let errOut = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 8000);

    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { errOut += d.toString(); });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { bin, version: out.trim() } : { bin, error: errOut.trim() });
    });
  });

  for (const bin of pythonCandidates()) {
    const found = await probe(bin);
    if (found?.version) {
      return {
        available: true,
        pythonFound: true,
        python: found.bin,
        ortoolsVersion: found.version,
        scriptPath: PYTHON_SCRIPT,
      };
    }
    if (found?.error) {
      return {
        available: false,
        pythonFound: true,
        python: found.bin,
        error: /No module named/.test(found.error)
          ? 'Python is installed but the ortools package is missing. Run `pip install ortools`.'
          : found.error.slice(-300),
        scriptPath: PYTHON_SCRIPT,
      };
    }
  }

  return {
    available: false,
    pythonFound: false,
    error: 'No Python interpreter found. Set PYTHON_BIN to its path.',
    scriptPath: PYTHON_SCRIPT,
  };
}

module.exports = {
  generateWithORTools,
  previewWithORTools,
  checkORToolsAvailability,
  // exported for tests
  preparePythonInput,
  transformOptimizedSchedule,
  experienceScore,
};
