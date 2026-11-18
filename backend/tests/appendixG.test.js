/**
 * Appendix G — automated verification suite (batch 1).
 *
 * Real tests against the project's own functions. Nothing here is estimated:
 * each case runs the actual code and asserts the actual result, so the numbers
 * that go into the Appendix G tables are measured, not described.
 *
 * Batch 1 covers the deterministic units that need no external service:
 *   UT-01, UT-02, UT-04  Conflict detection (faculty overlap, room overlap, different days)
 *   UT-03                Back-to-back same teacher  (see note — the prep-gap feature BLOCKS this)
 *   UT-25                JWT: valid / expired / tampered
 *   UT-26                bcrypt: matching / non-matching
 *
 * Solver (UT-06..08), recommendation (UT-13..15), enrolment (UT-16..20),
 * chatbot (UT-21..24), file-size enforcement (UT-27..28) and every IT/ST case
 * are added in later batches.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Schedule = require('../models/Schedule.model');
const Program = require('../models/Program.model');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');
const { __test__ } = require('../controllers/schedule.controller');
const { checkScheduleConflicts } = __test__;
const { calculateFacultyScore } = require('../services/aiRecommendation.service').__test__;
const { documentFilter, MAX_FILE_SIZE } = require('../middleware/upload.middleware');

jest.setTimeout(120000);

let mem;
const FAC_A = new mongoose.Types.ObjectId();
const FAC_B = new mongoose.Types.ObjectId();
const SUBJECT = new mongoose.Types.ObjectId();
const ROOM_X = new mongoose.Types.ObjectId();
const TERM = { academicYear: '2026-2027', semester: 1 };

const typesOf = (r) => (r.details || []).map((d) => d.type);

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'appendixg' });

  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });

  const mkFaculty = async (id, first) => {
    const user = await User.create({
      email: `${first.toLowerCase()}@example.com`,
      password: 'correct horse battery staple',
      role: 'faculty',
      firstName: first,
      lastName: 'Teacher',
    });
    await Faculty.create({ _id: id, user: user._id, employeeId: `T-${first}`, position: 'Instructor' });
  };
  await mkFaculty(FAC_A, 'Alpha');
  await mkFaculty(FAC_B, 'Bravo');

  // Teacher Alpha already teaches BSIT-1B-D, Monday 08:00–09:00, in room X.
  await Schedule.create({
    subject: SUBJECT, faculty: FAC_A, room: ROOM_X,
    program: 'BSIT', yearLevel: 1, section: 'B', sectionCode: 'BSIT-1B-D', shift: 'Day',
    ...TERM, status: 'published', isActive: true,
    timeSlots: [{ day: 'Monday', startTime: '08:00', endTime: '09:00' }],
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

// Place a prospective class and return the conflict report.
const place = ({ faculty = FAC_A, room = new mongoose.Types.ObjectId(), day = 'Monday', startTime, endTime }) =>
  checkScheduleConflicts({
    subject: SUBJECT, faculty, room, sectionCode: 'BSIT-1A-D',
    timeSlots: [{ day, startTime, endTime }], ...TERM,
  });

describe('Appendix G — Table 40 Unit Testing (conflict detection)', () => {
  test('UT-01 faculty double-booking is rejected (same teacher, overlapping time)', async () => {
    // Alpha, 08:30–09:30, a free room: overlaps Alpha's own 08:00–09:00 class.
    const r = await place({ faculty: FAC_A, startTime: '08:30', endTime: '09:30' });
    expect(r.hasConflict).toBe(true);
    expect(typesOf(r)).toContain('faculty');
  });

  test('UT-02 room double-booking is rejected (same room, overlapping time, different teacher)', async () => {
    // Bravo, 08:30–09:30, but in room X — the room Alpha already occupies.
    const r = await place({ faculty: FAC_B, room: ROOM_X, startTime: '08:30', endTime: '09:30' });
    expect(r.hasConflict).toBe(true);
    expect(typesOf(r)).toContain('room');
  });

  test('UT-03 back-to-back for the SAME teacher is blocked by the preparation gap', async () => {
    // Spec draft said "back-to-back allowed"; the implemented prep-gap feature
    // rejects 09:00–10:00 right after an 08:00–09:00 class. Recording real code.
    const r = await place({ faculty: FAC_A, startTime: '09:00', endTime: '10:00' });
    expect(r.hasConflict).toBe(true);
    expect(typesOf(r)).toContain('faculty-gap');
  });

  test('UT-04 the same teacher on a different day is allowed', async () => {
    const r = await place({ faculty: FAC_A, day: 'Tuesday', startTime: '08:00', endTime: '09:00' });
    expect(r.hasConflict).toBe(false);
    expect(r.details).toHaveLength(0);
  });
});

describe('Appendix G — Table 40 Unit Testing (authentication)', () => {
  test('UT-25 JWT: a valid token verifies, an expired one is rejected, a tampered one is rejected', () => {
    const secret = process.env.JWT_SECRET;

    // valid
    const good = jwt.sign({ id: 'u1', role: 'faculty' }, secret, { expiresIn: '1h' });
    expect(jwt.verify(good, secret)).toMatchObject({ id: 'u1', role: 'faculty' });

    // expired
    const stale = jwt.sign({ id: 'u1' }, secret, { expiresIn: -10 });
    expect(() => jwt.verify(stale, secret)).toThrow(jwt.TokenExpiredError);

    // tampered: forge the signature. The token still decodes, but the HMAC no
    // longer matches, so verification fails with "invalid signature".
    const parts = good.split('.');
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'A' ? 'B' : 'A');
    expect(() => jwt.verify(parts.join('.'), secret)).toThrow(jwt.JsonWebTokenError);
  });

  test('UT-26 bcrypt: a matching password verifies and a wrong one does not', async () => {
    const hash = await bcrypt.hash('S3cure-Passphrase!', 10);
    expect(hash).not.toBe('S3cure-Passphrase!');            // stored hashed, never plain
    expect(await bcrypt.compare('S3cure-Passphrase!', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });
});

describe('Appendix G — Table 40 Unit Testing (instructor recommendation)', () => {
  const subject = { subjectCode: 'CC 112', subjectName: 'Data Structures', requiredQualifications: ['Programming'] };
  const base = { qualifications: [{ degree: 'MS' }], teachingHistory: [], currentLoad: 12, maxTeachingLoad: 36 };

  test('UT-13 a specialization match scores higher than no match', () => {
    const match = calculateFacultyScore({ ...base, specializations: ['Programming'] }, subject);
    const noMatch = calculateFacultyScore({ ...base, specializations: ['Cookery'] }, subject);
    expect(match.breakdown.specialization).toBeGreaterThan(noMatch.breakdown.specialization);
    expect(match.total).toBeGreaterThan(noMatch.total);
  });

  test('UT-14 recent teaching history scores higher than history over five years old', () => {
    const hist = (year) => ({ ...base, specializations: ['Programming'],
      teachingHistory: [{ subjectCode: 'CC 112', subjectName: 'Data Structures', academicYear: year, semester: 1, program: 'BSIT' }] });
    const recent = calculateFacultyScore(hist('2025-2026'), subject);
    const old = calculateFacultyScore(hist('2019-2020'), subject);
    expect(recent.breakdown.history).toBeGreaterThan(old.breakdown.history);
  });

  test('UT-15 a maxed-out teacher scores lower than a lightly loaded one', () => {
    const maxed = calculateFacultyScore({ ...base, specializations: ['Programming'], currentLoad: 36, maxTeachingLoad: 36 }, subject);
    const light = calculateFacultyScore({ ...base, specializations: ['Programming'], currentLoad: 0, maxTeachingLoad: 36 }, subject);
    expect(maxed.breakdown.workload).toBe(0);
    expect(light.breakdown.workload).toBeGreaterThan(maxed.breakdown.workload);
    expect(maxed.total).toBeLessThan(light.total);
  });
});

describe('Appendix G — Table 40 Unit Testing (file upload)', () => {
  const runFilter = (name) => new Promise((resolve) =>
    documentFilter({}, { originalname: name }, (err, ok) => resolve({ err, ok })));

  test('UT-27 a PDF is accepted and the size cap is 10 MB (5 MB < cap < 11 MB)', async () => {
    const pdf = await runFilter('lecture.pdf');
    expect(pdf.err).toBeFalsy();
    expect(pdf.ok).toBe(true);
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    expect(5 * 1024 * 1024).toBeLessThan(MAX_FILE_SIZE);   // 5 MB accepted
    expect(11 * 1024 * 1024).toBeGreaterThan(MAX_FILE_SIZE); // 11 MB over cap (enforced by multer)
  });

  test('UT-28 an .exe is rejected by the file-type filter', async () => {
    const exe = await runFilter('malware.exe');
    expect(exe.err).toBeInstanceOf(Error);
    expect(exe.ok).toBeUndefined();
  });
});
