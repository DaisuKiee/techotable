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
  const subject = { subjectCode: 'CC 112', subjectName: 'Data Structures', requiredQualifications: ['Programming'], units: 3 };
  // Shaped like a real Faculty document. These fixtures used to carry
  // `currentLoad` / `maxTeachingLoad`, which are not fields on Faculty - so
  // the tests passed while the same code returned NaN for every real record
  // (D-07). Load now arrives as the third argument, measured from the saved
  // schedules by utils/facultyLoad, which is how the service calls it.
  const base = { qualifications: [{ degree: 'MS' }], teachingHistory: [] };
  const HALF = { used: 12, cap: 24 };

  test('UT-13 a specialization match scores higher than no match', () => {
    const match = calculateFacultyScore({ ...base, specializations: ['Programming'] }, subject, HALF);
    const noMatch = calculateFacultyScore({ ...base, specializations: ['Cookery'] }, subject, HALF);
    expect(match.breakdown.specialization).toBeGreaterThan(noMatch.breakdown.specialization);
    expect(match.total).toBeGreaterThan(noMatch.total);
  });

  test('UT-14 recent teaching history scores higher than history over five years old', () => {
    const hist = (year) => ({ ...base, specializations: ['Programming'],
      teachingHistory: [{ subjectCode: 'CC 112', subjectName: 'Data Structures', academicYear: year, semester: 1, program: 'BSIT' }] });
    const recent = calculateFacultyScore(hist('2025-2026'), subject, HALF);
    const old = calculateFacultyScore(hist('2019-2020'), subject, HALF);
    expect(recent.breakdown.history).toBeGreaterThan(old.breakdown.history);
  });

  test('UT-15 a maxed-out teacher scores lower than a lightly loaded one', () => {
    const who = { ...base, specializations: ['Programming'] };
    const maxed = calculateFacultyScore(who, subject, { used: 24, cap: 24 });
    const light = calculateFacultyScore(who, subject, { used: 0, cap: 24 });
    expect(maxed.breakdown.workload).toBe(0);
    expect(light.breakdown.workload).toBeGreaterThan(maxed.breakdown.workload);
    expect(maxed.total).toBeLessThan(light.total);
    // Neither score may be NaN, whatever the load looks like.
    for (const r of [maxed, light]) expect(Number.isFinite(r.total)).toBe(true);
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

  test('UT-28a class materials now accept video and audio, not just documents', async () => {
    for (const name of ['lecture.mp4', 'demo.webm', 'clip.mov', 'podcast.mp3', 'slides.pptx', 'photo.png']) {
      const r = await runFilter(name);
      expect(r.err).toBeFalsy();
      expect(r.ok).toBe(true);
    }
  });

  test('UT-28b the material size cap is larger than the avatar cap, for video', () => {
    const { MATERIAL_MAX_FILE_SIZE } = require('../middleware/upload.middleware');
    expect(MATERIAL_MAX_FILE_SIZE).toBeGreaterThan(MAX_FILE_SIZE);
    expect(MATERIAL_MAX_FILE_SIZE).toBeGreaterThanOrEqual(50 * 1024 * 1024);
  });
});

/* ------------------------------------------------------------------ *
 * UT-05  NSTP combined sections
 * ------------------------------------------------------------------ */

describe('Appendix G — Table 40 Unit Testing (NSTP combined sections)', () => {
  const Subject = require('../models/Subject.model');
  let nstp1, nstp2, ordinary, NSTP_FAC;

  beforeAll(async () => {
    const fields = { units: 3, program: 'BSIT', semester: 1, yearLevel: 1, lectureHours: 3, labHours: 0 };
    nstp1 = await Subject.create({ subjectCode: 'NSTP 1', subjectName: 'National Service Training Program 1', ...fields });
    nstp2 = await Subject.create({ subjectCode: 'NSTP 2', subjectName: 'National Service Training Program 2', ...fields });
    ordinary = await Subject.create({ subjectCode: 'GE 101', subjectName: 'Understanding the Self', ...fields });

    const user = await User.create({
      email: 'nstp.teacher@ctu.edu.ph', password: 'correct horse battery staple',
      role: 'faculty', firstName: 'Nestor', lastName: 'Pita',
    });
    const fac = await Faculty.create({ user: user._id, employeeId: 'T-NSTP', position: 'Instructor' });
    NSTP_FAC = fac._id;

    // The teacher already takes NSTP 1 for BSIT-1A-D on Saturday morning.
    await Schedule.create({
      subject: nstp1._id, faculty: NSTP_FAC, room: ROOM_X,
      program: 'BSIT', yearLevel: 1, section: 'A', sectionCode: 'BSIT-1A-D', shift: 'Day',
      ...TERM, status: 'published', isActive: true,
      timeSlots: [{ day: 'Saturday', startTime: '08:00', endTime: '11:00' }],
    });
  });

  // Callers pass the subject as a stored id, which is how the real routes do it.
  const placeNSTP = ({ subject, faculty = NSTP_FAC, sectionCode, startTime, endTime }) =>
    checkScheduleConflicts({
      subject, faculty, room: new mongoose.Types.ObjectId(), sectionCode,
      timeSlots: [{ day: 'Saturday', startTime, endTime }], ...TERM,
    });

  test('UT-05 the same teacher may take a second NSTP section in the same hour', async () => {
    const r = await placeNSTP({
      subject: nstp2._id, sectionCode: 'BSIT-1B-D', startTime: '08:00', endTime: '11:00',
    });
    expect(typesOf(r)).not.toContain('faculty');
    expect(typesOf(r)).not.toContain('faculty-gap');
  });

  test('UT-05a an ordinary subject in that same hour is still refused', async () => {
    const r = await placeNSTP({
      subject: ordinary._id, sectionCode: 'BSIT-1C-D', startTime: '08:00', endTime: '11:00',
    });
    expect(typesOf(r)).toContain('faculty');
  });

  test('UT-05b NSTP is also exempt from the preparation gap', async () => {
    // Starts the moment the first NSTP block ends: no hour between them.
    const r = await placeNSTP({
      subject: nstp2._id, sectionCode: 'BSIT-1D-D', startTime: '11:00', endTime: '12:00',
    });
    expect(typesOf(r)).not.toContain('faculty-gap');
  });

  test('UT-05c an ordinary subject right after NSTP still needs the gap', async () => {
    const r = await placeNSTP({
      subject: ordinary._id, sectionCode: 'BSIT-1E-D', startTime: '11:00', endTime: '12:00',
    });
    expect(typesOf(r)).toContain('faculty-gap');
  });
});

/* ------------------------------------------------------------------ *
 * UT-09..12  Faculty load status
 * ------------------------------------------------------------------ */

describe('Appendix G — Table 40 Unit Testing (faculty load)', () => {
  // `totalHours` and `loadStatus` are virtuals on the Faculty model, so they
  // are exercised through a real document rather than a copy of the rule.
  const facultyWith = ({ position = 'Instructor', teaching }) => new Faculty({
    user: new mongoose.Types.ObjectId(),
    employeeId: `LOAD-${position}-${teaching}`,
    position,
    currentTeachingHours: teaching,
  });

  test('UT-09 36 total hours is a normal load', () => {
    const f = facultyWith({ teaching: 36 });
    expect(f.totalHours).toBe(36);
    expect(f.loadStatus.status).toBe('normal');
  });

  test('UT-10 38 total hours is a warning, still within the 40-hour allowance', () => {
    const f = facultyWith({ teaching: 38 });
    expect(f.totalHours).toBe(38);
    expect(f.loadStatus.status).toBe('warning');
  });

  test('UT-11 41 total hours is an overload', () => {
    const f = facultyWith({ teaching: 41 });
    expect(f.totalHours).toBe(41);
    expect(f.loadStatus.status).toBe('overload');
  });

  test('UT-12 a Chairman’s 12-hour release plus 24 teaching hours totals 36', () => {
    const f = facultyWith({ position: 'Chairman', teaching: 24 });
    expect(f.positionHours).toBe(12);
    expect(f.totalHours).toBe(36);
    expect(f.loadStatus.status).toBe('normal');
  });

  test('UT-12a the 40-hour ceiling is the boundary between warning and overload', () => {
    expect(facultyWith({ teaching: 40 }).loadStatus.status).toBe('warning');
    expect(facultyWith({ teaching: 40.5 }).loadStatus.status).toBe('overload');
  });
});
