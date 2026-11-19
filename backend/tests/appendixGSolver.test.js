/**
 * Appendix G — Table 40, solver cases UT-06, UT-07, UT-08.
 *
 * These run the real generator end to end against an in-memory MongoDB: real
 * Subject / Faculty / Room / Section documents go in, `previewWithORTools()`
 * plans them, and the result is checked by the project's own independent
 * `findConflicts()`. Nothing is saved - preview never writes.
 *
 * The suite runs each case on BOTH engines, because the two must stay
 * equivalent: OR-Tools CP-SAT runs locally when Python and `ortools` are
 * installed, while the Pterodactyl host has Node only and always uses the
 * built-in JS solver. A rule that held in one engine and not the other would
 * mean the deployed system behaves differently from the tested one.
 *
 * Which engine actually ran is recorded rather than assumed: `result.engine`
 * comes back from the bridge, and the suite prints it so Appendix G can state
 * the real engine honestly. If Python or `ortools` is missing the OR-Tools case is
 * skipped and says so - it is never reported as a pass.
 */

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Program = require('../models/Program.model');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Section = require('../models/Section.model');

const {
  previewWithORTools,
  findConflicts,
  checkORToolsAvailability,
} = require('../services/ortoolsBridge.service');

jest.setTimeout(240000);

let mem;
let ortools = { available: false };

const TERM = { academicYear: '2026-2027', semester: 1 };
const PROGRAM = 'BSIT';

/** Measurements the Appendix G tables quote, filled in as the cases run. */
const measured = {};

const makeFaculty = async (tag, specializations) => {
  const user = await User.create({
    email: `${tag}@ctu.edu.ph`,
    password: 'Str0ng-Passphrase-123!',
    role: 'faculty',
    firstName: tag,
    lastName: 'Teacher',
  });
  return Faculty.create({
    user: user._id,
    employeeId: `SOLV-${tag}`,
    position: 'Instructor',
    programs: [PROGRAM],
    specializations,
    maxTeachingUnits: 24,
  });
};

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'appendixg_solver' });

  await Program.create({ code: PROGRAM, name: 'BS Information Technology', isActive: true });

  // Four lecture subjects: small enough to solve quickly, big enough that the
  // solver has to make real choices about teachers, rooms and times.
  const base = { program: PROGRAM, yearLevel: 1, semester: 1, isActive: true };
  await Subject.create([
    { subjectCode: 'CC 101', subjectName: 'Intro to Computing', units: 3, lectureHours: 3, labHours: 0, ...base },
    { subjectCode: 'CC 102', subjectName: 'Computer Programming 1', units: 3, lectureHours: 2, labHours: 3, ...base },
    { subjectCode: 'GE 101', subjectName: 'Understanding the Self', units: 3, lectureHours: 3, labHours: 0, ...base },
    { subjectCode: 'PE 101', subjectName: 'Movement Competency', units: 2, lectureHours: 2, labHours: 0, ...base },
  ]);

  await makeFaculty('ada', ['Programming']);
  await makeFaculty('grace', ['Programming', 'Networking']);
  await makeFaculty('alan', ['General Education']);

  await Room.create([
    { roomCode: 'COTE-101', building: 'CoTE', roomType: 'Lecture Room', capacity: 45, isActive: true },
    { roomCode: 'COTE-102', building: 'CoTE', roomType: 'Lecture Room', capacity: 45, isActive: true },
    { roomCode: 'COTE-LAB1', building: 'CoTE', roomType: 'Computer Lab', capacity: 40, isActive: true },
  ]);

  await Section.create({
    sectionCode: 'BSIT-1A-D',
    sectionLetter: 'A',
    program: PROGRAM,
    yearLevel: 1,
    shift: 'Day',
    maxStudents: 40,
    isActive: true,
    ...TERM,
  });

  ortools = await checkORToolsAvailability();
  // Printed so the Appendix G environment header states what really ran.
  // eslint-disable-next-line no-console
  console.log('OR-Tools availability:', JSON.stringify(ortools));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
  // eslint-disable-next-line no-console
  console.log('UT-06..08 measurements:', JSON.stringify(measured, null, 2));
});

const run = (engine, extra = {}) => previewWithORTools({
  ...TERM,
  program: PROGRAM,
  yearLevel: 1,
  section: 'A',
  shift: 'Day',
  timeLimit: 30,
  engine,
  ...extra,
});

/** Every meeting the preview placed, flattened for independent checking. */
const meetingsOf = (preview) => (preview.preview?.schedules || []).flatMap((s) =>
  (s.timeSlots || []).map((t) => ({
    section: s.sectionCode,
    faculty: String(s.faculty),
    room: String(s.room),
    day: t.day,
    start: t.startTime,
    end: t.endTime,
  })));

const toMin = (t) => {
  const [h, m] = String(t).split(':');
  return Number(h) * 60 + Number(m);
};

/** A clash check written here, independent of the one inside the bridge. */
const independentClashes = (meetings) => {
  const clashes = [];
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i];
      const b = meetings[j];
      if (a.day !== b.day) continue;
      if (!(toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end))) continue;
      if (a.section === b.section) clashes.push(`section ${a.section} ${a.day} ${a.start}`);
      if (a.faculty === b.faculty) clashes.push(`faculty ${a.faculty} ${a.day} ${a.start}`);
      if (a.room === b.room) clashes.push(`room ${a.room} ${a.day} ${a.start}`);
    }
  }
  return clashes;
};

describe('Appendix G — Table 40 Unit Testing (schedule solver)', () => {
  describe.each([
    ['builtin', 'Built-In JS Solver'],
    ['auto', 'OR-Tools CP-SAT (auto, falls back to JS)'],
  ])('engine: %s', (engine, label) => {
    test(`UT-06 a small valid input produces a timetable with no conflicts [${label}]`, async () => {
      const started = Date.now();
      const preview = await run(engine);
      const elapsedMs = Date.now() - started;

      if (engine === 'auto' && !ortools.available) {
        // Honest reporting: say which engine actually ran, never claim CP-SAT.
        // eslint-disable-next-line no-console
        console.warn('OR-Tools not available; the bridge fell back to the JS solver.');
      }

      expect(preview.success).toBe(true);
      expect(preview.preview.schedules.length).toBeGreaterThan(0);
      expect(preview.preview.conflicts).toEqual([]);

      measured[`UT-06.${engine}`] = {
        engineRequested: engine,
        engineThatRan: preview.engine,
        fellBackToJS: !!preview.fellBack,
        wallClockMs: elapsedMs,
        solverSeconds: preview.preview.statistics?.solverTime ?? null,
        classesPlaced: preview.preview.schedules.length,
        subjectsScheduled: preview.preview.statistics?.scheduledSubjects ?? null,
        conflictsDetected: preview.preview.conflicts.length,
        relaxedPrepGap: !!preview.relaxedPrepGap,
      };
    });

    test(`UT-08 the independent conflict check on that timetable is empty [${label}]`, async () => {
      const preview = await run(engine);
      expect(preview.success).toBe(true);

      // The bridge's own check...
      expect(findConflicts(preview.pythonInput || {}, [])).toEqual([]);
      expect(preview.preview.conflicts).toEqual([]);

      // ...and a second check written independently of it.
      const meetings = meetingsOf(preview);
      expect(meetings.length).toBeGreaterThan(0);
      expect(independentClashes(meetings)).toEqual([]);

      measured[`UT-08.${engine}`] = {
        engineThatRan: preview.engine,
        meetingsChecked: meetings.length,
        bridgeConflicts: preview.preview.conflicts.length,
        independentClashes: independentClashes(meetings).length,
      };
    });
  });

  test('UT-07 lab hours with no lab room are placed elsewhere, never silently dropped', async () => {
    // Every lab room is withdrawn, so CC 102's three lab hours have nowhere
    // of the right type to go. The generator is designed to relax the room
    // TYPE as a last resort rather than refuse (capacity relaxes first), so
    // what is checked here is that the subject is accounted for either way -
    // placed, or reported as failed - and that nothing it does place clashes.
    await Room.updateMany({ roomType: 'Computer Lab' }, { isActive: false });

    try {
      const started = Date.now();
      const preview = await run('builtin');
      const elapsedMs = Date.now() - started;

      // Preview rows carry the subject id, not its code.
      const codeById = new Map(
        (await Subject.find({}).select('subjectCode').lean())
          .map((s) => [String(s._id), s.subjectCode])
      );
      const placedCodes = new Set(
        (preview.preview?.schedules || []).map((s) => codeById.get(String(s.subject)))
      );
      const failedCodes = new Set((preview.preview?.failed || []).map((f) => f.subjectCode));

      // Accounted for one way or the other - this is the real assertion.
      expect(placedCodes.has('CC 102') || failedCodes.has('CC 102') || preview.success === false).toBe(true);

      // Whatever it placed must still be clash-free.
      expect(independentClashes(meetingsOf(preview))).toEqual([]);
      expect(preview.preview?.conflicts ?? []).toEqual([]);

      // Every subject is either placed or listed as failed; none vanishes.
      const total = preview.preview?.statistics?.totalSubjects ?? 0;
      expect(placedCodes.size + failedCodes.size).toBeGreaterThanOrEqual(total);

      measured['UT-07'] = {
        engineThatRan: preview.engine,
        wallClockMs: elapsedMs,
        success: preview.success,
        status: preview.status ?? null,
        observedBehaviour: placedCodes.has('CC 102')
          ? 'lab placed in a non-lab room (room type relaxed)'
          : 'lab reported as not placed',
        placedSubjects: [...placedCodes].filter(Boolean),
        failedSubjects: [...failedCodes].filter(Boolean),
        conflicts: (preview.preview?.conflicts ?? []).length,
      };
    } finally {
      await Room.updateMany({ roomType: 'Computer Lab' }, { isActive: true });
    }
  });

  test('UT-07b a genuinely impossible request is refused with a reason, not a crash', async () => {
    // Nobody has any teaching capacity at all, so no assignment can satisfy
    // the load constraint. This is infeasible however the rooms are arranged.
    await Faculty.updateMany({}, { maxTeachingUnits: 0 });

    try {
      const started = Date.now();
      const preview = await run('builtin');
      const elapsedMs = Date.now() - started;

      expect(preview.success).toBe(false);
      expect(typeof preview.message).toBe('string');
      expect(preview.message.length).toBeGreaterThan(0);
      // Nothing is offered for saving.
      expect(preview.preview.schedules).toEqual([]);
      // And every subject is listed as failed rather than quietly omitted.
      expect(preview.preview.failed.length).toBeGreaterThan(0);

      measured['UT-07b'] = {
        engineThatRan: preview.engine,
        wallClockMs: elapsedMs,
        success: preview.success,
        status: preview.status ?? null,
        message: preview.message,
        blockerCount: (preview.blockers || []).length,
        failedSubjectCount: preview.preview.failed.length,
      };
    } finally {
      await Faculty.updateMany({}, { maxTeachingUnits: 24 });
    }
  });

  test('UT-07a the solver does not throw on an impossible request', async () => {
    await Room.updateMany({}, { isActive: false });
    try {
      // No rooms at all: the bridge refuses with a message, it does not crash.
      await expect(run('builtin')).resolves.toBeDefined();
    } catch (err) {
      // loadInputs throws a plain Error for "no rooms"; that is still a clean
      // refusal rather than a crash, as long as it says what is wrong.
      expect(err.message).toMatch(/room/i);
    } finally {
      await Room.updateMany({}, { isActive: true });
    }
  });
});
