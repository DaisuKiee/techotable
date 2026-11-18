/**
 * Appendix G — Integration tests (Table 41), batch 1: Login + RBAC.
 *
 * A test-local Express app mounts the project's REAL routers (auth, schedules)
 * and runs them against an in-memory MongoDB. Nothing touches the live database
 * or the running server. Requests go through the real protect/authorize
 * middleware and the real controllers, so the status codes are the system's own.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Program = require('../models/Program.model');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');

jest.setTimeout(120000);

let mem;
let app;
let FAC_ID, SUBJ2_ID, ROOM2_ID;
const TERM = { academicYear: '2026-2027', semester: 1 };

async function makeUser({ email, role, program, verified = true }) {
  return User.create({
    email, password: 'Str0ng-Passphrase-123!', role,
    firstName: role, lastName: 'Tester',
    isActive: true, isEmailVerified: verified,
    ...(program ? { program } : {}),
  });
}

const login = (email, password = 'Str0ng-Passphrase-123!') =>
  request(app).post('/api/auth/login').send({ email, password });

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'appendixg_it' });

  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });
  await Program.create({ code: 'BSHM', name: 'BS Hospitality Management', isActive: true });

  await makeUser({ email: 'officer@ctu.edu', role: 'scheduling_officer' });
  await makeUser({ email: 'pm.bsit@ctu.edu', role: 'program_manager', program: 'BSIT' });
  await makeUser({ email: 'student@ctu.edu', role: 'student', program: 'BSIT' });

  // Seed the pieces a manual schedule needs: a teacher, a second subject and a
  // free room, plus an existing class to clash with.
  const facUser = await makeUser({ email: 'teacher@ctu.edu', role: 'faculty' });
  const fac = await Faculty.create({ user: facUser._id, employeeId: 'EMP-1', position: 'Instructor' });
  FAC_ID = fac._id;
  const subjFields = { units: 3, program: 'BSIT', semester: 1, yearLevel: 1, lectureHours: 3, labHours: 0 };
  const subj1 = await Subject.create({ subjectCode: 'CC 101', subjectName: 'Intro to Computing', ...subjFields });
  const subj2 = await Subject.create({ subjectCode: 'CC 102', subjectName: 'Programming 1', ...subjFields });
  SUBJ2_ID = subj2._id;
  const room1 = await Room.create({ roomCode: 'COTE-01', building: 'CoTE', roomType: 'Lecture Room', capacity: 40 });
  const room2 = await Room.create({ roomCode: 'COTE-02', building: 'CoTE', roomType: 'Lecture Room', capacity: 40 });
  ROOM2_ID = room2._id;

  // Teacher already teaches CC 101 for BSIT-1A-D, Monday 08:00–09:00.
  await Schedule.create({
    subject: subj1._id, faculty: fac._id, room: room1._id,
    program: 'BSIT', yearLevel: 1, section: 'A', sectionCode: 'BSIT-1A-D', shift: 'Day',
    ...TERM, status: 'published', isActive: true,
    timeSlots: [{ day: 'Monday', startTime: '08:00', endTime: '09:00' }],
  });

  // Real routers on a bare app — the same middleware stack each route declares.
  app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth.routes'));
  app.use('/api/schedules', require('../routes/schedule.routes'));
  app.use(require('../middleware/error.middleware').errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

describe('Appendix G — Table 41 Integration (Login + RBAC)', () => {
  test('IT-01 correct credentials return 200 and a JWT', async () => {
    const res = await login('officer@ctu.edu');
    expect(res.status).toBe(200);
    expect(res.body?.data?.token).toEqual(expect.any(String));
    expect(res.body.data.token.split('.')).toHaveLength(3); // header.payload.signature
  });

  test('IT-02 a wrong password returns 401', async () => {
    const res = await login('officer@ctu.edu', 'definitely-the-wrong-password');
    expect(res.status).toBe(401);
    expect(res.body?.data?.token).toBeUndefined();
  });

  test('IT-03 a protected route with no token returns 401', async () => {
    const res = await request(app).get('/api/schedules');
    expect(res.status).toBe(401);
  });

  test('IT-04 a student calling schedule generation is forbidden (403)', async () => {
    const token = (await login('student@ctu.edu')).body.data.token;
    const res = await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ program: 'BSIT', academicYear: '2026-2027', semester: 1, yearLevel: 1, section: 'A' });
    expect(res.status).toBe(403);
  });
});

describe('Appendix G — Table 48 Release checks (RC)', () => {
  test('RC-06 an overlapping manual schedule is rejected with HTTP 400 (not 409)', async () => {
    // Note: the manuscript draft said "409 Conflict"; the code returns 400.
    // The test records the real status so the document matches the system.
    const token = (await login('officer@ctu.edu')).body.data.token;
    const res = await request(app)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...TERM, program: 'BSIT', yearLevel: 2, section: 'A', sectionCode: 'BSIT-2A-D', shift: 'Day',
        subject: String(SUBJ2_ID), faculty: String(FAC_ID), room: String(ROOM2_ID),
        timeSlots: [{ day: 'Monday', startTime: '08:30', endTime: '09:30' }], // clashes with the teacher's 08:00–09:00
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).toMatch(/conflict|clash|already|prepare/i);
  });
});
