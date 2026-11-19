/**
 * Appendix G — Defect Log (Table 46) proofs.
 *
 * Each test here was written to FAIL against the code as it stood, so the
 * defect is demonstrated rather than asserted, and then to pass once the root
 * cause is fixed. The first run's failure output is what Table 46 records.
 *
 * Everything runs against an in-memory MongoDB. The live database is never
 * touched and no mail is sent.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';

// D-12 needs to see exactly what the controller hands the external model, so
// the AI client is replaced by a recorder. `jest.requireActual` below still
// gives the test the REAL prompt builder, so the assertion is made against the
// genuine text that would have been transmitted.
const aiCalls = [];
jest.mock('../services/gemini.service', () => ({
  generateChatResponse: jest.fn(async (message, context) => {
    aiCalls.push({ message, context });
    return { success: true, message: 'stubbed', keyUsed: 1, totalKeys: 1 };
  }),
  generateChatResponseStream: jest.fn(async (message, context, history, onChunk) => {
    aiCalls.push({ message, context });
    onChunk('stubbed');
    return { success: true, message: 'stubbed' };
  }),
}));

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Program = require('../models/Program.model');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Student = require('../models/Student.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');

const { publicUser } = require('../utils/publicUser');
const { getUserActivitySummary } = require('../services/activityLogger.service');
const { detectAllConflicts } = require('../services/conflictDetection.service');
const { importStudents, importFaculty } = require('../services/excelImporter.service');

jest.setTimeout(120000);

let mem;
let app;

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'appendixg_defects' });

  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });

  app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth.routes'));
  app.use(require('../middleware/error.middleware').errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

/* ------------------------------------------------------------------ D-01 */

describe('D-01 self-registration as administrator', () => {
  test('an anonymous caller cannot create an admin account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'intruder@example.com',
      password: 'Str0ng-Passphrase-123!',
      firstName: 'In',
      lastName: 'Truder',
      role: 'admin',
    });

    // Anything in the 2xx range here means the endpoint minted the account.
    expect([401, 403, 404]).toContain(res.status);

    const created = await User.findOne({ email: 'intruder@example.com' }).lean();
    expect(created).toBeNull();
  });

  test('nor any other account, and no session token is handed out', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'walkup@example.com',
      password: 'Str0ng-Passphrase-123!',
      firstName: 'Walk',
      lastName: 'Up',
    });
    expect(res.status).not.toBe(201);
    expect(res.body && res.body.data && res.body.data.token).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ D-02 */

describe('D-02 activity summary under Mongoose 8', () => {
  test('a user activity summary is produced instead of throwing', async () => {
    const user = await User.create({
      email: 'summary@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'faculty',
      firstName: 'Sum',
      lastName: 'Mary',
    });

    const summary = await getUserActivitySummary(String(user._id));

    // The service catches and returns null on error, so a null here is the
    // TypeError being swallowed.
    expect(summary).not.toBeNull();
    expect(Array.isArray(summary.actionsSummary)).toBe(true);
    expect(Array.isArray(summary.resourcesSummary)).toBe(true);
  });
});

/* ------------------------------------------------------------------ D-03 */

describe('D-03 campus-wide conflict scan', () => {
  const TERM = { academicYear: '2026-2027', semester: 1 };
  let roomShared;

  beforeAll(async () => {
    const mkFac = async (tag) => {
      const u = await User.create({
        email: `${tag}@ctu.edu.ph`,
        password: 'Str0ng-Passphrase-123!',
        role: 'faculty',
        firstName: tag,
        lastName: 'Teacher',
      });
      return Faculty.create({ user: u._id, employeeId: `D3-${tag}`, position: 'Instructor' });
    };
    const facA = await mkFac('d3a');
    const facB = await mkFac('d3b');
    const facNstp = await mkFac('d3n');

    const f = { units: 3, program: 'BSIT', semester: 1, yearLevel: 1, lectureHours: 3, labHours: 0 };
    const subjA = await Subject.create({ subjectCode: 'D3 101', subjectName: 'Alpha', ...f });
    const subjB = await Subject.create({ subjectCode: 'D3 102', subjectName: 'Beta', ...f });
    const nstp = await Subject.create({ subjectCode: 'NSTP 1', subjectName: 'NSTP 1', ...f });

    roomShared = await Room.create({
      roomCode: 'D3-LAB', building: 'CoTE', roomType: 'Computer Lab', capacity: 40,
    });

    const base = { program: 'BSIT', yearLevel: 1, shift: 'Day', status: 'published', isActive: true };

    // Two different teachers, two different sections, ONE room, same hour.
    await Schedule.create({
      subject: subjA._id, faculty: facA._id, room: String(roomShared._id),
      section: 'A', sectionCode: 'BSIT-1A-D', ...base, ...TERM,
      timeSlots: [{ day: 'Tuesday', startTime: '13:00', endTime: '14:00' }],
    });
    await Schedule.create({
      subject: subjB._id, faculty: facB._id, room: String(roomShared._id),
      section: 'B', sectionCode: 'BSIT-1B-D', ...base, ...TERM,
      timeSlots: [{ day: 'Tuesday', startTime: '13:00', endTime: '14:00' }],
    });

    // Same room and hour, but a different school year: not a clash.
    await Schedule.create({
      subject: subjA._id, faculty: facA._id, room: String(roomShared._id),
      section: 'C', sectionCode: 'BSIT-1C-D', ...base,
      academicYear: '2024-2025', semester: 1,
      timeSlots: [{ day: 'Tuesday', startTime: '13:00', endTime: '14:00' }],
    });

    // One NSTP teacher taking two combined sections at once on Saturday.
    for (const section of ['A', 'B']) {
      await Schedule.create({
        subject: nstp._id, faculty: facNstp._id, room: String(roomShared._id),
        section, sectionCode: `BSIT-1${section}-D`, ...base, ...TERM,
        timeSlots: [{ day: 'Saturday', startTime: '08:00', endTime: '11:00' }],
      });
    }
  });

  const scan = () => detectAllConflicts({ academicYear: '2026-2027', semester: 1 });

  test('a room booked twice in the same hour is reported', async () => {
    const { conflicts } = await scan();
    const rooms = conflicts.filter((c) => c.type === 'ROOM_DOUBLE_BOOKING');
    expect(rooms.length).toBeGreaterThan(0);
    // and it names the room rather than a raw id
    expect(rooms[0].room).toBe('D3-LAB');
  });

  test('a clash is not invented across two different school years', async () => {
    const { conflicts } = await scan();
    const stale = conflicts.filter((c) => (c.schedules || []).some((s) => s.section === 'BSIT-1C-D'));
    expect(stale).toEqual([]);
  });

  test('combined NSTP sections are not reported against their own teacher', async () => {
    const { conflicts } = await scan();
    const nstpFaculty = conflicts.filter((c) => c.type === 'FACULTY_DOUBLE_BOOKING' && c.day === 'Saturday');
    expect(nstpFaculty).toEqual([]);
  });

  test('every reported conflict names a room instead of leaving it undefined', async () => {
    const { conflicts } = await scan();
    expect(conflicts.length).toBeGreaterThan(0);
    for (const c of conflicts) {
      for (const s of c.schedules || []) {
        if ('room' in s) expect(s.room).not.toBeUndefined();
      }
    }
  });
});

/* ------------------------------------------------------------------ D-04 */

describe('D-04 two-factor state in the serialised user', () => {
  test('an enrolled account is not reported as unprotected', async () => {
    const user = await User.create({
      email: 'twofa@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'admin',
      firstName: 'Two',
      lastName: 'Eff',
      twoFactorEnabled: true,
    });

    expect(publicUser(user, { self: true }).twoFactorEnabled).toBe(true);
    expect(publicUser(user).twoFactorEnabled).toBe(true);
  });

  test('an account with no second factor still reports false', async () => {
    const user = await User.create({
      email: 'nofa@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'admin',
      firstName: 'No',
      lastName: 'Eff',
    });
    expect(publicUser(user, { self: true }).twoFactorEnabled).toBe(false);
  });

  test('the secret behind it never leaves the server', async () => {
    const user = await User.create({
      email: 'secretfa@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'admin',
      firstName: 'Sec',
      lastName: 'Ret',
      twoFactorEnabled: true,
    });
    const out = publicUser(user, { self: true });
    expect(out.password).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Str0ng-Passphrase');
  });
});

/* ------------------------------------------------------------------ D-05 */

describe('D-05 Excel import against the real schemas', () => {
  test('an imported student lands in a section the rest of the system can find', async () => {
    const result = await importStudents([{
      studentId: '82399001',
      email: 'imported.student@ctu.edu.ph',
      firstName: 'Ima',
      lastName: 'Ported',
      program: 'BSIT',
      yearLevel: '4',
      section: 'BSIT-4A-D',
      studentType: 'regular',
    }]);

    expect(result.failed).toEqual([]);
    expect(result.success).toHaveLength(1);

    const student = await Student.findOne({ studentId: '82399001' }).lean();
    expect(student).not.toBeNull();
    // `section` is not a field on Student; the schedule notifier and the class
    // spaces both match on `sectionCode`.
    expect(student.sectionCode).toBe('BSIT-4A-D');

    const account = await User.findOne({ email: 'imported.student@ctu.edu.ph' }).lean();
    // A student whose address is unverified cannot log in at all.
    expect(account.isEmailVerified).toBe(true);
  });

  test('an imported teacher keeps the teaching-hour cap from the workbook', async () => {
    const result = await importFaculty([{
      employeeId: 'IMP-001',
      email: 'imported.teacher@ctu.edu.ph',
      firstName: 'Tea',
      lastName: 'Cher',
      department: 'CoTE',
      position: 'Instructor',
      specializations: 'Programming, Networking',
      maxTeachingLoad: '21',
      officeLocation: 'Room 201',
    }]);

    expect(result.failed).toEqual([]);
    const faculty = await Faculty.findOne({ employeeId: 'IMP-001' }).lean();
    expect(faculty).not.toBeNull();
    // The solver reads `maxTeachingHours`; `maxTeachingLoad` is not a field.
    expect(faculty.maxTeachingHours).toBe(21);
    expect(faculty.currentTeachingHours).toBe(0);
    expect(faculty.specializations).toEqual(['Programming', 'Networking']);
  });
});

/* ------------------------------------------------------------------ D-06 */

describe('D-06 the generator honours each teacher’s configured cap', () => {
  const { preparePythonInput } = require('../services/ortoolsBridge.service');

  const payloadFor = (facultyDocs, loads) => preparePythonInput({
    subjects: [], facultyDocs, rooms: [], sections: [], existing: [], loads,
    program: 'BSIT', yearLevel: 1, section: 'A', shift: 'Day',
    academicYear: '2026-2027', semester: 1, timeLimit: 5,
  });

  test('a raised cap reaches the solver instead of the hard-coded 24', () => {
    const generous = { _id: 'f1', employeeId: 'E1', maxTeachingUnits: 36 };
    const strict = { _id: 'f2', employeeId: 'E2', maxTeachingUnits: 12 };

    const { faculty } = payloadFor([generous, strict], new Map());
    const byId = Object.fromEntries(faculty.map((f) => [f._id, f]));

    expect(byId.f1.max_teaching_load).toBe(36);
    expect(byId.f2.max_teaching_load).toBe(12);
  });

  test('a teacher left at the default is still capped at 24, as before', () => {
    const { faculty } = payloadFor([{ _id: 'f3', employeeId: 'E3' }], new Map());
    expect(faculty[0].max_teaching_load).toBe(24);
  });

  test('the load already carried is measured, not read off the document', () => {
    const loads = new Map([['f4', { hours: 18, units: 15, classes: 5 }]]);
    const { faculty } = payloadFor([{ _id: 'f4', employeeId: 'E4', maxTeachingUnits: 24 }], loads);
    expect(faculty[0].current_load).toBe(15);
    // Both sides of the cap are the same currency, so the remaining room is real.
    expect(faculty[0].max_teaching_load - faculty[0].current_load).toBe(9);
  });
});

/* ------------------------------------------------------------------ D-07 */

describe('D-07 instructor recommendation against real documents', () => {
  const { __test__ } = require('../services/aiRecommendation.service');
  const { calculateFacultyScore } = __test__;

  const subject = {
    subjectCode: 'CC 112', subjectName: 'Data Structures',
    requiredQualifications: ['Programming'], units: 3,
  };
  // No `currentLoad` / `maxTeachingLoad`: a real Faculty document has neither.
  const real = { specializations: ['Programming'], qualifications: [{ degree: 'MS' }], teachingHistory: [] };

  test('a score is a number, not NaN', () => {
    const r = calculateFacultyScore(real, subject, { used: 6, cap: 24 });
    expect(Number.isFinite(r.total)).toBe(true);
    expect(Number.isFinite(r.breakdown.workload)).toBe(true);
  });

  test('a missing load does not poison the score', () => {
    const r = calculateFacultyScore(real, subject);
    expect(Number.isFinite(r.total)).toBe(true);
  });

  test('a cap of zero gives no Infinity and no NaN', () => {
    const r = calculateFacultyScore(real, subject, { used: 5, cap: 0 });
    expect(Number.isFinite(r.total)).toBe(true);
  });

  test('being over the cap scores zero rather than a negative number', () => {
    const over = calculateFacultyScore(real, subject, { used: 30, cap: 24 });
    const atCap = calculateFacultyScore(real, subject, { used: 24, cap: 24 });
    expect(over.breakdown.workload).toBe(0);
    expect(over.total).toBe(atCap.total);
  });

  test('a teacher with room is preferred over one who is full', () => {
    const free = calculateFacultyScore(real, subject, { used: 0, cap: 24 });
    const full = calculateFacultyScore(real, subject, { used: 24, cap: 24 });
    expect(free.total).toBeGreaterThan(full.total);
  });
});

/* ------------------------------------------------------------------ D-10 */

describe('D-10 program isolation on a single class', () => {
  const Section = require('../models/Section.model');
  const TERM = { academicYear: '2026-2027', semester: 1 };
  let bsitToken;
  let bshmSchedule;
  let scheduleApp;

  beforeAll(async () => {
    await Program.create({ code: 'BSHM', name: 'BS Hospitality Management', isActive: true });
    // Program codes are validated against a one-minute cache, so a program
    // added mid-run is invisible until the cache is cleared.
    require('../utils/programValidator').invalidateProgramCache();

    const mk = async (tag, role, extra = {}) => User.create({
      email: `${tag}@ctu.edu.ph`, password: 'Str0ng-Passphrase-123!', role,
      firstName: tag, lastName: 'Tester', isActive: true, isEmailVerified: true, ...extra,
    });
    await mk('d10pm', 'program_manager', { program: 'BSIT' });

    const hmUser = await mk('d10teacher', 'faculty');
    const hmFac = await Faculty.create({
      user: hmUser._id, employeeId: 'D10-1', position: 'Instructor', programs: ['BSHM'],
    });
    const hmSubject = await Subject.create({
      subjectCode: 'HM 201', subjectName: 'Culinary Arts', program: 'BSHM',
      units: 3, semester: 1, yearLevel: 2, lectureHours: 3, labHours: 0, isActive: true,
    });
    const room = await Room.create({
      roomCode: 'D10-101', building: 'CoTE', roomType: 'Lecture Room', capacity: 40, isActive: true,
    });

    bshmSchedule = await Schedule.create({
      subject: hmSubject._id, faculty: hmFac._id, room: String(room._id),
      program: 'BSHM', yearLevel: 2, section: 'A', sectionCode: 'BSHM-2A-D', shift: 'Day',
      ...TERM, status: 'draft', isActive: true,
      timeSlots: [{ day: 'Tuesday', startTime: '08:00', endTime: '09:00' }],
    });

    scheduleApp = express();
    scheduleApp.use(express.json());
    scheduleApp.use('/api/auth', require('../routes/auth.routes'));
    scheduleApp.use('/api/schedules', require('../routes/schedule.routes'));
    scheduleApp.use(require('../middleware/error.middleware').errorHandler);

    const res = await request(scheduleApp).post('/api/auth/login')
      .send({ email: 'd10pm@ctu.edu.ph', password: 'Str0ng-Passphrase-123!' });
    bsitToken = res.body.data.token;
    expect(bsitToken).toBeTruthy();
  });

  const as = () => ({ Authorization: `Bearer ${bsitToken}` });

  test('a manager cannot edit another program’s class', async () => {
    const res = await request(scheduleApp)
      .put(`/api/schedules/${bshmSchedule._id}`)
      .set(as())
      .send({ maxStudents: 99 });

    expect(res.status).toBe(403);

    const after = await Schedule.findById(bshmSchedule._id).lean();
    // Neither the field they tried to change...
    expect(after.maxStudents).not.toBe(99);
    // ...nor, crucially, the program the class belongs to. The middleware
    // auto-stamps `req.body.program` with the caller's own program, so an
    // accepted edit would have moved a BSHM class into BSIT.
    expect(after.program).toBe('BSHM');
  });

  test('a manager cannot read another program’s class by id', async () => {
    const res = await request(scheduleApp)
      .get(`/api/schedules/${bshmSchedule._id}`)
      .set(as());

    expect(res.status).toBe(403);
  });

  test('a manager cannot delete another program’s class', async () => {
    const res = await request(scheduleApp)
      .delete(`/api/schedules/${bshmSchedule._id}`)
      .set(as());

    expect(res.status).toBe(403);

    const after = await Schedule.findById(bshmSchedule._id).lean();
    expect(after.isActive).toBe(true);
  });

  test('a request for an id that does not exist is a 404, not a 403', async () => {
    const res = await request(scheduleApp)
      .get(`/api/schedules/${new mongoose.Types.ObjectId()}`)
      .set(as());

    expect(res.status).toBe(404);
  });

  test('routes whose first segment is not an id still work', async () => {
    // `/ortools-status` must not be mistaken for a class id.
    const res = await request(scheduleApp)
      .get('/api/schedules/ortools-status')
      .set(as());

    expect(res.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ D-12 */

describe('D-12 student personal data never reaches the external model', () => {
  // The real prompt builder, not the recorder mocked at the top of this file.
  const { __test__: realGemini } = jest.requireActual('../services/gemini.service');

  const Section = require('../models/Section.model');
  const Student = require('../models/Student.model');
  const jwt = require('jsonwebtoken');

  // Distinctive values: if any of these appear in the prompt, they can only
  // have come from a student record.
  const PII = {
    firstName: 'Zenaida',
    lastName: 'Quilantang',
    email: 'zenaida.quilantang.d12@ctu.edu.ph',
    studentId: '82312121',
    contactNumber: '09171234567',
    gpa: 1.75,
  };

  let chatApp;
  let officerToken;

  beforeAll(async () => {
    const officer = await User.create({
      email: 'd12officer@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'scheduling_officer',
      firstName: 'Dee',
      lastName: 'Twelve',
      isActive: true,
      isEmailVerified: true,
    });
    officerToken = jwt.sign({ id: String(officer._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await Section.create({
      sectionCode: 'BSIT-1D-D', sectionLetter: 'D', program: 'BSIT', yearLevel: 1,
      shift: 'Day', maxStudents: 40, isActive: true,
      academicYear: '2026-2027', semester: 1,
    });

    const studentUser = await User.create({
      email: PII.email,
      password: 'Str0ng-Passphrase-123!',
      role: 'student',
      firstName: PII.firstName,
      lastName: PII.lastName,
      isActive: true,
      isEmailVerified: true,
      program: 'BSIT',
    });
    await Student.create({
      user: studentUser._id,
      studentId: PII.studentId,
      program: 'BSIT',
      yearLevel: 1,
      sectionCode: 'BSIT-1D-D',
      studentType: 'irregular',
      enrollmentStatus: 'enrolled',
      contactNumber: PII.contactNumber,
      gpa: PII.gpa,
    });

    chatApp = express();
    chatApp.use(express.json());
    chatApp.use('/api/ai', require('../routes/aiChat.routes'));
    chatApp.use(require('../middleware/error.middleware').errorHandler);
  });

  beforeEach(() => { aiCalls.length = 0; });

  const askAsOfficer = async (message = 'How many students are in each section?') => {
    const res = await request(chatApp)
      .post('/api/ai/chat')
      .set({ Authorization: `Bearer ${officerToken}` })
      .send({ message });
    expect(res.status).toBe(200);
    expect(aiCalls).toHaveLength(1);
    return aiCalls[0].context;
  };

  test('the context handed over carries headcounts, not a student roster', async () => {
    const context = await askAsOfficer();

    // There is no roster at all any more.
    expect(context.students).toBeUndefined();
    expect(context.users).toBeUndefined();

    // What replaced it is a count, broken down the way a chairperson needs.
    expect(context.studentCounts.total).toBeGreaterThan(0);
    expect(context.studentCounts.byProgram.BSIT).toBeGreaterThan(0);
    expect(context.studentCounts.byYearLevel['1']).toBeGreaterThan(0);
    expect(context.studentCounts.bySection['BSIT-1D-D']).toBe(1);
    expect(context.studentCounts.byType.irregular).toBe(1);
  });

  test('no student name, email, number or grade appears anywhere in that context', async () => {
    const context = await askAsOfficer();
    const serialised = JSON.stringify(context);

    for (const value of Object.values(PII)) {
      expect(serialised).not.toContain(String(value));
    }
  });

  test('and none of it appears in the prompt actually sent to the model', async () => {
    const context = await askAsOfficer();

    // The genuine system prompt, built by the real service from that context.
    const prompt = realGemini.getSystemPrompt(context);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);

    for (const value of Object.values(PII)) {
      expect(prompt).not.toContain(String(value));
    }
    // The old wording is gone for good.
    expect(prompt).not.toContain('COMPLETE STUDENT DIRECTORY');
    expect(prompt).not.toMatch(/GPA:/);
  });

  test('the prompt still tells the chairperson how many students there are', async () => {
    const context = await askAsOfficer();
    const prompt = realGemini.getSystemPrompt(context);

    expect(prompt).toMatch(/STUDENT ENROLMENT NUMBERS/);
    expect(prompt).toContain('BSIT-1D-D = 1');
    // ...and instructs the model to refuse individual lookups.
    expect(prompt).toMatch(/individual student records are not available/i);
  });

  test('the timetabling data a chairperson does need is still there', async () => {
    const context = await askAsOfficer();

    // Removing the roster must not have gutted the useful context.
    expect(Array.isArray(context.subjects)).toBe(true);
    expect(Array.isArray(context.faculty)).toBe(true);
    expect(Array.isArray(context.rooms)).toBe(true);
    expect(Array.isArray(context.sections)).toBe(true);
    expect(context.stats.totalStudents).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ D-13 */

describe('D-13 the assistant can actually see the timetable', () => {
  const { __test__: realGemini } = jest.requireActual('../services/gemini.service');
  const Section = require('../models/Section.model');
  const Room = require('../models/Room.model');
  const jwt = require('jsonwebtoken');

  let app13;
  let token13;

  beforeAll(async () => {
    const officer = await User.create({
      email: 'd13officer@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'scheduling_officer',
      firstName: 'Dee',
      lastName: 'Thirteen',
      isActive: true,
      isEmailVerified: true,
    });
    token13 = jwt.sign({ id: String(officer._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const facUser = await User.create({
      email: 'd13teacher@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'faculty',
      firstName: 'Virgilio',
      lastName: 'Teachwell',
      isActive: true,
      isEmailVerified: true,
    });
    const fac = await Faculty.create({
      user: facUser._id, employeeId: 'D13-1', position: 'Instructor', programs: ['BSIT'],
    });
    const subject = await Subject.create({
      subjectCode: 'CC 4112', subjectName: 'Information Assurance', program: 'BSIT',
      units: 3, semester: 1, yearLevel: 4, lectureHours: 3, labHours: 0, isActive: true,
    });
    const room = await Room.create({
      roomCode: 'D13-LAB7', building: 'CoTE', roomType: 'Computer Lab', capacity: 40, isActive: true,
    });
    await Section.create({
      sectionCode: 'BSIT-4B-N', sectionLetter: 'B', program: 'BSIT', yearLevel: 4,
      shift: 'Night', maxStudents: 40, isActive: true,
      academicYear: '2026-2027', semester: 1,
    });
    await Schedule.create({
      subject: subject._id, faculty: fac._id, room: String(room._id),
      program: 'BSIT', yearLevel: 4, section: 'B', sectionCode: 'BSIT-4B-N', shift: 'Night',
      academicYear: '2026-2027', semester: 1, status: 'published', isActive: true,
      timeSlots: [{ day: 'Monday', startTime: '16:00', endTime: '18:00' }],
    });

    app13 = express();
    app13.use(express.json());
    app13.use('/api/ai', require('../routes/aiChat.routes'));
    app13.use(require('../middleware/error.middleware').errorHandler);
  });

  beforeEach(() => { aiCalls.length = 0; });

  const contextFor = async (message = 'Who teaches CC 4112 for BSIT-4B-N?') => {
    const res = await request(app13)
      .post('/api/ai/chat')
      .set({ Authorization: `Bearer ${token13}` })
      .send({ message });
    expect(res.status).toBe(200);
    expect(aiCalls).toHaveLength(1);
    return aiCalls[0].context;
  };

  test('each class carries its subject, teacher, section and room', async () => {
    const context = await contextFor();
    const row = (context.schedules || []).find((s) => s.sectionCode === 'BSIT-4B-N');
    expect(row).toBeDefined();

    // `.select()` used to omit the reference fields, so `.populate()` had
    // nothing to populate and every one of these was undefined.
    expect(row.subject?.subjectCode).toBe('CC 4112');
    expect(row.faculty?.user?.lastName).toBe('Teachwell');
    expect(row.sectionCode).toBe('BSIT-4B-N');
    // `Schedule.room` stores an id in a String field, so it needs the label
    // resolver rather than populate.
    expect(row.roomLabel).toBe('D13-LAB7');
  });

  test('rooms are named, not just counted', async () => {
    const context = await contextFor('Name one of the computer laboratories');
    const codes = (context.rooms || []).map((r) => r.roomCode);
    expect(codes).toContain('D13-LAB7');
  });

  test('the prompt sent to the model states who teaches that class', async () => {
    const context = await contextFor();
    const prompt = realGemini.getSystemPrompt(context);

    expect(prompt).toContain('CLASS SCHEDULE');
    const flat = prompt.replace(/\s+/g, ' ');
    expect(flat).toMatch(/CC 4112.*BSIT-4B-N.*Virgilio Teachwell.*D13-LAB7.*Monday 16:00-18:00/);
  });

  test('and still carries no student personal data', async () => {
    const context = await contextFor();
    const prompt = realGemini.getSystemPrompt(context);
    expect(prompt).not.toContain('COMPLETE STUDENT DIRECTORY');
    expect(prompt).not.toMatch(/GPA:/);
    expect(context.students).toBeUndefined();
  });
});
