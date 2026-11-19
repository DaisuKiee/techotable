/**
 * Appendix G — Integration tests (Table 41), batch 2: IT-05 to IT-18.
 *
 * Batch 1 (tests/appendixG.integration.test.js) covers login and RBAC,
 * IT-01..04. This file carries the rest: program isolation, generation,
 * conflict checking, publishing, enrolment over HTTP, class-space posting,
 * the chatbot endpoints, the AI fallback chain, and Excel import.
 *
 * A test-local Express app mounts the project's REAL routers against an
 * in-memory MongoDB, so every status code below is the system's own. The live
 * database is never touched, no mail leaves the process, and the AI providers
 * are stubbed - what is tested there is the controller's behaviour, not a
 * third party's.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';

/* ---------------------------------------------------- stubs and recorders */

// Mail is NOT stubbed here. With no SMTP credentials configured the project's
// own `emailService` runs in console mode and sends nothing, so stubbing the
// transport would only risk hiding real template errors - an earlier version
// of this file mocked `../services/mailer` with just `sendMail` and made the
// announcement template throw `logoAvailable is not a function`, which looked
// like a product defect and was purely the mock's doing.

// AI: capture what the controller handed over.
const aiCalls = [];
jest.mock('../services/gemini.service', () => ({
  generateChatResponse: jest.fn(async (message, context, history, options) => {
    aiCalls.push({ message, context, history, options });
    return { success: true, message: 'stubbed answer', keyUsed: 1, totalKeys: 1 };
  }),
  generateChatResponseStream: jest.fn(async (message, context, history, onChunk) => {
    aiCalls.push({ message, context, history, streamed: true });
    onChunk('stubbed');
    return { success: true, message: 'stubbed' };
  }),
}));

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Program = require('../models/Program.model');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Student = require('../models/Student.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Section = require('../models/Section.model');
const Schedule = require('../models/Schedule.model');
const ClassSpace = require('../models/ClassSpace.model');
const Notification = require('../models/Notification.model');

jest.setTimeout(300000);

const PASSWORD = 'Str0ng-Passphrase-123!';
const TERM = { academicYear: '2026-2027', semester: 1 };

let mem;
let app;
const ref = {};

/** Measured HTTP codes and timings, printed for the Appendix G tables. */
const measured = {};
const timed = async (id, fn) => {
  const started = Date.now();
  const res = await fn();
  measured[id] = { status: res.status, ms: Date.now() - started };
  return res;
};

const makeUser = async (tag, role, extra = {}) => {
  const user = await User.create({
    email: `${tag}@ctu.edu.ph`,
    password: PASSWORD,
    role,
    firstName: tag,
    lastName: 'Tester',
    isActive: true,
    isEmailVerified: true,
    ...extra,
  });
  ref[`${tag}Email`] = user.email;
  return user;
};

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (!res.body?.data?.token) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Wait for something the controller kicks off without awaiting.
 *
 * Announcements and materials deliberately answer the teacher straight away
 * and fan the notifications out afterwards, so the rows do not exist yet when
 * the response arrives. This polls for them rather than guessing a delay.
 */
const waitFor = async (predicate, { timeoutMs = 8000, everyMs = 50 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value && (!Array.isArray(value) || value.length > 0)) return value;
    if (Date.now() > deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
};

/**
 * A one-sheet workbook, as a buffer, for the import endpoints. Built with the
 * same `xlsx` library the importer parses with, so the fixture and the code
 * under test agree about the file format.
 */
const workbook = async (sheetName, columns, rows) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? '']))),
    { header: columns }
  );
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'appendixg_it2' });

  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });
  await Program.create({ code: 'BSHM', name: 'BS Hospitality Management', isActive: true });

  await makeUser('admin', 'admin');
  await makeUser('officer', 'scheduling_officer');
  await makeUser('bsitpm', 'program_manager', { program: 'BSIT' });
  await makeUser('bshmpm', 'program_manager', { program: 'BSHM' });

  // A teacher who can teach in BSIT.
  const facUser = await makeUser('teacher', 'faculty');
  ref.faculty = await Faculty.create({
    user: facUser._id, employeeId: 'IT2-1', position: 'Instructor',
    programs: ['BSIT'], maxTeachingUnits: 24,
  });
  // The real faculty-creation path links the account back to the profile
  // (faculty.controller.js). `resolveAccess` reads it to decide who may post
  // in a class space, so the fixture has to set it too.
  await User.updateOne({ _id: facUser._id }, { facultyProfile: ref.faculty._id });

  const sf = { semester: 1, yearLevel: 1, isActive: true };
  ref.subjIT = await Subject.create({
    subjectCode: 'CC 101', subjectName: 'Intro to Computing', program: 'BSIT',
    units: 3, lectureHours: 3, labHours: 0, ...sf,
  });
  ref.subjIT2 = await Subject.create({
    subjectCode: 'CC 102', subjectName: 'Programming 1', program: 'BSIT',
    units: 3, lectureHours: 3, labHours: 0, ...sf,
  });
  ref.subjHM = await Subject.create({
    subjectCode: 'HM 101', subjectName: 'Food Service', program: 'BSHM',
    units: 3, lectureHours: 3, labHours: 0, ...sf,
  });

  ref.room = await Room.create({
    roomCode: 'IT2-101', building: 'CoTE', roomType: 'Lecture Room', capacity: 40, isActive: true,
  });
  await Room.create({
    roomCode: 'IT2-LAB', building: 'CoTE', roomType: 'Computer Lab', capacity: 40, isActive: true,
  });

  ref.section = await Section.create({
    sectionCode: 'BSIT-1A-D', sectionLetter: 'A', enrollmentCode: 'ITTWOAAA',
    program: 'BSIT', yearLevel: 1, shift: 'Day', maxStudents: 40, currentStudents: 0,
    isActive: true, ...TERM,
  });

  // A BSHM class, for the program-isolation case.
  const hmFacUser = await makeUser('hmteacher', 'faculty');
  const hmFac = await Faculty.create({
    user: hmFacUser._id, employeeId: 'IT2-2', position: 'Instructor', programs: ['BSHM'],
  });
  await User.updateOne({ _id: hmFacUser._id }, { facultyProfile: hmFac._id });
  ref.bshmSchedule = await Schedule.create({
    subject: ref.subjHM._id, faculty: hmFac._id, room: String(ref.room._id),
    program: 'BSHM', yearLevel: 1, section: 'A', sectionCode: 'BSHM-1A-D', shift: 'Day',
    ...TERM, status: 'draft', isActive: true,
    timeSlots: [{ day: 'Tuesday', startTime: '08:00', endTime: '09:00' }],
  });

  // A student to enrol, and one to receive class-space notices.
  const stUser = await makeUser('learner', 'student', { program: 'BSIT' });
  ref.student = await Student.create({
    user: stUser._id, studentId: '82388001', program: 'BSIT', yearLevel: 1,
  });

  app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth.routes'));
  app.use('/api/schedules', require('../routes/schedule.routes'));
  app.use('/api/classSpaces', require('../routes/classSpace.routes'));
  app.use('/api/ai', require('../routes/aiChat.routes'));
  app.use('/api/import', require('../routes/import.routes'));
  app.use(require('../middleware/error.middleware').errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
  // eslint-disable-next-line no-console
  console.log('IT-05..18 measured:', JSON.stringify(measured, null, 2));
});

beforeEach(() => {
  aiCalls.length = 0;
});

/* ====================================================== IT-05  RBAC ===== */

describe('Appendix G — Table 41 (program isolation)', () => {
  test('IT-05 a BSIT manager editing a BSHM class is refused with 403', async () => {
    const token = await login(ref.bsitpmEmail);

    const res = await timed('IT-05', () => request(app)
      .put(`/api/schedules/${ref.bshmSchedule._id}`)
      .set(auth(token))
      .send({ timeSlots: [{ day: 'Wednesday', startTime: '10:00', endTime: '11:00' }] }));

    expect(res.status).toBe(403);

    // The class was not touched.
    const after = await Schedule.findById(ref.bshmSchedule._id).lean();
    expect(after.timeSlots[0].day).toBe('Tuesday');
  });

  test('IT-05a the BSHM manager may edit their own class', async () => {
    const token = await login(ref.bshmpmEmail);
    const res = await request(app)
      .put(`/api/schedules/${ref.bshmSchedule._id}`)
      .set(auth(token))
      .send({ maxStudents: 35 });

    expect(res.status).toBe(200);
  });

  test('IT-05b a BSIT manager cannot create a class in BSHM', async () => {
    const token = await login(ref.bsitpmEmail);
    const res = await request(app)
      .post('/api/schedules')
      .set(auth(token))
      .send({
        ...TERM, program: 'BSHM', yearLevel: 1, section: 'B', sectionCode: 'BSHM-1B-D',
        shift: 'Day', subject: String(ref.subjHM._id), faculty: String(ref.faculty._id),
        room: String(ref.room._id),
        timeSlots: [{ day: 'Friday', startTime: '08:00', endTime: '09:00' }],
      });

    expect(res.status).toBe(403);
  });
});

/* ========================================== IT-06..08  generate/publish = */

describe('Appendix G — Table 41 (generation, conflict check, publishing)', () => {
  test('IT-06 a valid preview returns a plan, and saving it stores drafts', async () => {
    const token = await login(ref.officerEmail);

    const preview = await timed('IT-06.preview', () => request(app)
      .post('/api/schedules/preview')
      .set(auth(token))
      .send({
        ...TERM, program: 'BSIT', yearLevel: 1, section: 'A', shift: 'Day',
        timeLimit: 20, method: 'builtin',
      }));

    expect(preview.status).toBe(200);
    // The controller flattens the preview into `data`, so the plan is at
    // `data.schedules` rather than `data.preview.schedules`.
    expect(preview.body.success).toBe(true);
    expect(preview.body.data.schedules.length).toBeGreaterThan(0);
    expect(preview.body.data.conflicts).toEqual([]);
    measured['IT-06.engineThatRan'] = preview.body.engine;

    const save = await timed('IT-06.save', () => request(app)
      .post('/api/schedules/save-preview')
      .set(auth(token))
      .send({ schedules: preview.body.data.schedules }));

    expect([200, 201]).toContain(save.status);

    const drafts = await Schedule.find({ program: 'BSIT', sectionCode: 'BSIT-1A-D', ...TERM }).lean();
    expect(drafts.length).toBeGreaterThan(0);
    for (const d of drafts) expect(d.status).toBe('draft');

    ref.draftIds = drafts.map((d) => String(d._id));
    measured['IT-06.draftsSaved'] = drafts.length;
  });

  test('IT-07 a batch conflict check on the saved drafts reports no conflicts', async () => {
    const token = await login(ref.officerEmail);

    const res = await timed('IT-07', () => request(app)
      .post('/api/schedules/check-conflicts')
      .set(auth(token))
      .send({ program: 'BSIT', yearLevel: 1, ...TERM }));

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.hasConflict).toBe(false);
    const details = body.details ?? body.conflicts ?? [];
    expect(details).toEqual([]);
  });

  test('IT-07a a manual overlap IS reported by the same endpoint', async () => {
    const token = await login(ref.officerEmail);
    const existing = await Schedule.findOne({ _id: { $in: ref.draftIds } }).lean();

    const res = await request(app)
      .post('/api/schedules/check-conflicts')
      .set(auth(token))
      .send({
        ...TERM,
        faculty: String(existing.faculty),
        room: String(existing.room),
        sectionCode: existing.sectionCode,
        subject: String(existing.subject),
        timeSlots: existing.timeSlots,
      });

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.hasConflict).toBe(true);
  });

  test('IT-08 publishing flips the classes and their class spaces to published', async () => {
    const token = await login(ref.officerEmail);

    // Spaces exist and start unpublished.
    const before = await ClassSpace.find({ schedule: { $in: ref.draftIds } }).lean();
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((s) => s.isPublished === false)).toBe(true);

    const res = await timed('IT-08', () => request(app)
      .post('/api/schedules/publish')
      .set(auth(token))
      .send({ ids: ref.draftIds }));

    expect(res.status).toBe(200);

    const after = await Schedule.find({ _id: { $in: ref.draftIds } }).lean();
    expect(after.every((s) => s.status === 'published')).toBe(true);

    const spaces = await ClassSpace.find({ schedule: { $in: ref.draftIds } }).lean();
    expect(spaces.every((s) => s.isPublished === true)).toBe(true);

    measured['IT-08.published'] = after.length;
    measured['IT-08.spacesPublished'] = spaces.length;
  });
});

/* ============================================ IT-09..11  enrolment HTTP = */

describe('Appendix G — Table 41 (enrolment over HTTP)', () => {
  test('IT-09 a valid section code enrols the student and claims a seat', async () => {
    const token = await login(ref.learnerEmail);

    const res = await timed('IT-09', () => request(app)
      .post('/api/classSpaces/join')
      .set(auth(token))
      .send({ code: 'ITTWOAAA' }));

    expect(res.status).toBe(200);
    expect(res.body.joined).toBe('section');

    const section = await Section.findById(ref.section._id).lean();
    expect(section.currentStudents).toBe(1);

    const spaces = await ClassSpace.find({ 'enrolledStudents.student': ref.student._id }).lean();
    expect(spaces.length).toBeGreaterThan(0);
    measured['IT-09.classesJoined'] = spaces.length;
  });

  test('IT-10 an invalid code is refused, and the exact status is recorded', async () => {
    const token = await login(ref.learnerEmail);

    const res = await timed('IT-10', () => request(app)
      .post('/api/classSpaces/join')
      .set(auth(token))
      .send({ code: 'NOSUCHCODE' }));

    // The controller answers 404 for an unknown section code.
    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  test('IT-11 a time-conflicting subject code is refused with 400', async () => {
    // Give the student an extra subject that overlaps one they already hold.
    const held = await ClassSpace.findOne({ 'enrolledStudents.student': ref.student._id })
      .populate('schedule', 'timeSlots')
      .lean();
    const slot = held.schedule.timeSlots[0];

    const clashSchedule = await Schedule.create({
      subject: ref.subjIT2._id, faculty: ref.faculty._id, room: String(ref.room._id),
      program: 'BSIT', yearLevel: 1, section: 'Z', sectionCode: 'BSIT-1Z-D', shift: 'Day',
      ...TERM, status: 'published', isActive: true,
      timeSlots: [{ day: slot.day, startTime: slot.startTime, endTime: slot.endTime }],
    });
    await ClassSpace.create({
      schedule: clashSchedule._id, subject: ref.subjIT2._id, sectionCode: 'BSIT-1Z-D',
      classCode: 'ITCLASHX', isActive: true, isPublished: true, enrolledStudents: [], ...TERM,
    });

    const token = await login(ref.learnerEmail);
    const res = await timed('IT-11', () => request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(auth(token))
      .send({ classCode: 'ITCLASHX' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/conflict/i);
  });
});

/* ======================================= IT-12..13  class-space posting = */

describe('Appendix G — Table 41 (class space posting notifies students)', () => {
  test('IT-13 an announcement from the assigned teacher notifies the enrolled students', async () => {
    const space = await ClassSpace.findOne({ 'enrolledStudents.student': ref.student._id }).lean();
    const token = await login(ref.teacherEmail);

    await Notification.deleteMany({});

    const res = await timed('IT-13', () => request(app)
      .post(`/api/classSpaces/${space._id}/announcements`)
      .set(auth(token))
      .send({ title: 'Quiz on Friday', content: 'Bring a calculator and a blue pen.' }));

    expect([200, 201]).toContain(res.status);

    const notices = await waitFor(() => Notification.find({ recipient: ref.student.user }).lean());
    expect(notices.length).toBeGreaterThan(0);
    measured['IT-13.notificationsCreated'] = notices.length;
  });

  test('IT-12 a material upload notifies the enrolled students too', async () => {
    const space = await ClassSpace.findOne({ 'enrolledStudents.student': ref.student._id }).lean();
    const token = await login(ref.teacherEmail);

    await Notification.deleteMany({});

    const res = await timed('IT-12', () => request(app)
      .post(`/api/classSpaces/${space._id}/materials`)
      .set(auth(token))
      .attach('file', Buffer.from('%PDF-1.4\n% a tiny handout\n'), {
        filename: 'handout.pdf',
        contentType: 'application/pdf',
      }));

    expect([200, 201]).toContain(res.status);

    const notices = await waitFor(() => Notification.find({ recipient: ref.student.user }).lean());
    expect(notices.length).toBeGreaterThan(0);
    measured['IT-12.notificationsCreated'] = notices.length;
  });

  test('IT-12a a teacher who is not assigned to the class cannot post to it', async () => {
    const space = await ClassSpace.findOne({ 'enrolledStudents.student': ref.student._id }).lean();
    const token = await login(ref.hmteacherEmail);

    const res = await request(app)
      .post(`/api/classSpaces/${space._id}/announcements`)
      .set(auth(token))
      .send({ title: 'Not mine', content: 'This should not be allowed.' });

    expect([400, 403]).toContain(res.status);
  });
});

/* ============================================ IT-14..16  chatbot and AI = */

describe('Appendix G — Table 41 (chatbot endpoints)', () => {
  test('IT-14 an officer’s question is answered with database context injected', async () => {
    const token = await login(ref.officerEmail);

    const res = await timed('IT-14', () => request(app)
      .post('/api/ai/chat')
      .set(auth(token))
      .send({ message: 'How many sections does BSIT have this term?' }));

    expect(res.status).toBe(200);
    expect(res.body.metadata.contextLoaded).toBe(true);
    expect(aiCalls).toHaveLength(1);

    const ctx = aiCalls[0].context;
    const records = Object.values(ctx).filter(Array.isArray).reduce((n, a) => n + a.length, 0);
    expect(records).toBeGreaterThan(0);
    measured['IT-14.recordsInContext'] = records;
  });

  test('IT-15 a student data probe returns the privacy notice with no records touched', async () => {
    const token = await login(ref.learnerEmail);

    const res = await timed('IT-15', () => request(app)
      .post('/api/ai/chat')
      .set(auth(token))
      .send({ message: 'List all students in BSIT with their emails' }));

    expect(res.status).toBe(200);
    expect(res.body.metadata.guarded).toBe(true);
    expect(res.body.message).toMatch(/Data Privacy Act of 2012/);
    // The model was never reached, so no context could have been built.
    expect(aiCalls).toHaveLength(0);
  });

  test('IT-16 the recommendation service answers without AI rather than failing', async () => {
    // With no provider key configured, `isAIAvailable()` is false and the
    // service must fall back to its own deterministic scoring. The endpoint
    // must not 500.
    const service = require('../services/aiRecommendation.service');
    expect(service.isAIAvailable()).toBe(false);

    const started = Date.now();
    const result = await service.recommendInstructorForSubject({
      subjectId: String(ref.subjIT._id), ...TERM, useAI: true,
    });
    measured['IT-16'] = { ms: Date.now() - started, usedAI: result.usedAI, success: result.success };

    expect(result.success).toBe(true);
    expect(result.usedAI).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Every score is a real number - this is what D-07 broke.
    for (const r of result.recommendations) {
      expect(Number.isFinite(r.score)).toBe(true);
      expect(Number.isFinite(r.availableLoad)).toBe(true);
    }
  });

  test('IT-16a the workload analysis reports real numbers, not NaN', async () => {
    const service = require('../services/aiRecommendation.service');
    const analysis = await service.analyzeWorkloadBalance(TERM);

    expect(analysis.statistics.totalFaculty).toBeGreaterThan(0);
    expect(analysis.statistics.averageUtilization).not.toMatch(/NaN/);
    for (const f of analysis.faculty) {
      expect(Number.isFinite(Number(f.utilizationRate))).toBe(true);
    }
  });
});

/* ============================================= IT-17..18  Excel import == */

describe('Appendix G — Table 41 (Excel import)', () => {
  test('IT-17 a valid workbook is accepted and the records are created', async () => {
    const token = await login(ref.officerEmail);

    const buffer = await workbook(
      'Students',
      ['studentId', 'email', 'firstName', 'lastName', 'program', 'yearLevel', 'section', 'shift', 'studentType'],
      [{
        studentId: '82399501', email: 'import.one@ctu.edu.ph', firstName: 'Imp', lastName: 'One',
        program: 'BSIT', yearLevel: 1, section: 'A', shift: 'Day', studentType: 'regular',
      }]
    );

    const res = await timed('IT-17', () => request(app)
      .post('/api/import/students')
      .set(auth(token))
      .attach('file', buffer, {
        filename: 'students.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));

    expect(res.status).toBe(200);

    const created = await Student.findOne({ studentId: '82399501' }).lean();
    expect(created).not.toBeNull();
    // D-05: the section has to land where the rest of the system looks for it.
    expect(created.sectionCode).toBe('BSIT-1A-D');

    const account = await User.findOne({ email: 'import.one@ctu.edu.ph' }).lean();
    expect(account.isEmailVerified).toBe(true);
  });

  test('IT-18 a workbook with the wrong columns is refused and saves nothing', async () => {
    const token = await login(ref.officerEmail);
    const countBefore = await Student.countDocuments();

    const buffer = await workbook(
      'Students',
      ['nickname', 'favouriteColour'],
      [{ nickname: 'Bogus', favouriteColour: 'green' }]
    );

    const res = await timed('IT-18', () => request(app)
      .post('/api/import/students')
      .set(auth(token))
      .attach('file', buffer, {
        filename: 'bad.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));

    // Either a 400, or a 200 whose report lists the row as failed. What must
    // not happen is a student being created from nonsense.
    const reportedFailure = res.status === 400
      || (res.body?.data?.failed?.length ?? 0) > 0
      || (res.body?.failed?.length ?? 0) > 0;
    expect(reportedFailure).toBe(true);

    expect(await Student.countDocuments()).toBe(countBefore);
  });

  test('IT-18a a file that is not a workbook at all is refused', async () => {
    const token = await login(ref.officerEmail);

    const res = await timed('IT-18a', () => request(app)
      .post('/api/import/students')
      .set(auth(token))
      .attach('file', Buffer.from('this is not a spreadsheet'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      }));

    expect([400, 415, 500]).toContain(res.status);
    expect(res.body.success).not.toBe(true);
  });

  test('IT-18b import is closed to anyone but the scheduling office', async () => {
    const token = await login(ref.learnerEmail);
    const buffer = await workbook('Students', ['studentId'], [{ studentId: '1' }]);

    const res = await request(app)
      .post('/api/import/students')
      .set(auth(token))
      .attach('file', buffer, {
        filename: 'students.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(res.status).toBe(403);
  });
});
