/**
 * Appendix G — Table 40, two-tier enrolment cases UT-16 to UT-20.
 *
 * The campus runs two kinds of enrolment and they must not be confused:
 *
 *   regular students   join a SECTION with the section's `enrollmentCode`,
 *                      which pulls them into every class that section takes;
 *   irregular students join ONE subject with a `classCode` from the
 *                      instructor, which must not drag in anything else.
 *
 * These drive the real `classSpace` router over supertest against an
 * in-memory MongoDB, so the status codes and the stored enrolment rows are
 * the system's own.
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
const Student = require('../models/Student.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Section = require('../models/Section.model');
const Schedule = require('../models/Schedule.model');
const ClassSpace = require('../models/ClassSpace.model');

jest.setTimeout(180000);

let mem;
let app;

const TERM = { academicYear: '2026-2027', semester: 1 };
const PROGRAM = 'BSIT';
const SECTION_CODE = 'BSIT-1A-D';
const SECTION_ENROL_CODE = 'BSIT1AD01';
const PASSWORD = 'Str0ng-Passphrase-123!';

const ids = {};

const makeStudent = async (tag, { studentType = 'regular', sectionCode = null } = {}) => {
  const user = await User.create({
    email: `${tag}@ctu.edu.ph`,
    password: PASSWORD,
    role: 'student',
    firstName: tag,
    lastName: 'Student',
    isActive: true,
    isEmailVerified: true,
  });
  const student = await Student.create({
    user: user._id,
    studentId: `823${tag.length}${Math.floor(Math.random() * 90000) + 10000}`,
    program: PROGRAM,
    yearLevel: 1,
    studentType,
    sectionCode,
  });
  ids[tag] = { user: user._id, student: student._id, email: user.email };
  return student;
};

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (!res.body?.data?.token) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
};

const asStudent = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'appendixg_enrol' });

  await Program.create({ code: PROGRAM, name: 'BS Information Technology', isActive: true });

  const facUser = await User.create({
    email: 'enrol.teacher@ctu.edu.ph', password: PASSWORD, role: 'faculty',
    firstName: 'En', lastName: 'Rol', isEmailVerified: true,
  });
  const fac = await Faculty.create({
    user: facUser._id, employeeId: 'ENR-1', position: 'Instructor', programs: [PROGRAM],
  });

  const sf = { units: 3, program: PROGRAM, semester: 1, yearLevel: 1, lectureHours: 3, labHours: 0, isActive: true };
  const subjA = await Subject.create({ subjectCode: 'CC 101', subjectName: 'Intro to Computing', ...sf });
  const subjB = await Subject.create({ subjectCode: 'CC 102', subjectName: 'Programming 1', ...sf });
  const subjC = await Subject.create({ subjectCode: 'GE 101', subjectName: 'Understanding the Self', ...sf });

  const room = await Room.create({
    roomCode: 'ENR-101', building: 'CoTE', roomType: 'Lecture Room', capacity: 40, isActive: true,
  });

  await Section.create({
    sectionCode: SECTION_CODE,
    sectionLetter: 'A',
    enrollmentCode: SECTION_ENROL_CODE,
    program: PROGRAM,
    yearLevel: 1,
    shift: 'Day',
    maxStudents: 40,
    currentStudents: 0,
    isActive: true,
    ...TERM,
  });

  // Three published classes for that section, at three different hours.
  const mkSchedule = async (subject, startTime, endTime) => Schedule.create({
    subject: subject._id, faculty: fac._id, room: String(room._id),
    program: PROGRAM, yearLevel: 1, section: 'A', sectionCode: SECTION_CODE, shift: 'Day',
    ...TERM, status: 'published', isActive: true,
    timeSlots: [{ day: 'Monday', startTime, endTime }],
  });
  const schA = await mkSchedule(subjA, '08:00', '09:00');
  const schB = await mkSchedule(subjB, '10:00', '11:00');
  const schC = await mkSchedule(subjC, '13:00', '14:00');

  // Published class spaces, each with its own class code.
  const mkSpace = async (schedule, subject, classCode) => ClassSpace.create({
    schedule: schedule._id,
    subject: subject._id,
    sectionCode: SECTION_CODE,
    classCode,
    isActive: true,
    isPublished: true,
    enrolledStudents: [],
    ...TERM,
  });
  ids.spaceA = await mkSpace(schA, subjA, 'CLASSAAA');
  ids.spaceB = await mkSpace(schB, subjB, 'CLASSBBB');
  ids.spaceC = await mkSpace(schC, subjC, 'CLASSCCC');
  ids.subjects = { subjA, subjB, subjC };

  // An irregular student's subject that clashes with CC 101's 08:00-09:00.
  const subjClash = await Subject.create({ subjectCode: 'IT 999', subjectName: 'Clashing Elective', ...sf });
  const schClash = await mkSchedule(subjClash, '08:30', '09:30');
  ids.spaceClash = await mkSpace(schClash, subjClash, 'CLASHXXX');

  await makeStudent('regular');
  await makeStudent('irregular', { studentType: 'irregular' });
  await makeStudent('dupe', { studentType: 'irregular' });
  await makeStudent('bogus');

  app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth.routes'));
  app.use('/api/classSpaces', require('../routes/classSpace.routes'));
  app.use(require('../middleware/error.middleware').errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

describe('Appendix G — Table 40 Unit Testing (two-tier enrolment)', () => {
  test('UT-16 a regular student joining by section code lands in every class of that section', async () => {
    const token = await login(ids.regular.email);
    const res = await request(app)
      .post('/api/classSpaces/join')
      .set(asStudent(token))
      .send({ code: SECTION_ENROL_CODE });

    expect(res.status).toBe(200);
    expect(res.body.joined).toBe('section');
    expect(res.body.data.sectionCode).toBe(SECTION_CODE);

    // All four of that section's classes, and each row marked as a section join.
    const spaces = await ClassSpace.find({
      sectionCode: SECTION_CODE,
      'enrolledStudents.student': ids.regular.student,
    }).lean();
    expect(spaces.length).toBe(4);
    for (const space of spaces) {
      const row = space.enrolledStudents.find((e) => String(e.student) === String(ids.regular.student));
      expect(row.enrollmentType).toBe('section');
    }

    // The student's own record now points at the section and its classes.
    const student = await Student.findById(ids.regular.student).lean();
    expect(student.sectionCode).toBe(SECTION_CODE);
    expect(student.enrolledClasses.length).toBe(4);

    // And the section's seat count went up by exactly one.
    const section = await Section.findOne({ sectionCode: SECTION_CODE }).lean();
    expect(section.currentStudents).toBe(1);
  });

  test('UT-17 an irregular student joining by class code lands in exactly one class', async () => {
    const token = await login(ids.irregular.email);
    const res = await request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(asStudent(token))
      .send({ classCode: 'CLASSAAA' });

    expect(res.status).toBe(200);

    const spaces = await ClassSpace.find({
      'enrolledStudents.student': ids.irregular.student,
    }).lean();
    expect(spaces).toHaveLength(1);
    expect(String(spaces[0]._id)).toBe(String(ids.spaceA._id));

    const row = spaces[0].enrolledStudents.find((e) => String(e.student) === String(ids.irregular.student));
    expect(row.enrollmentType).toBe('subject');

    // Nothing else was dragged in, and no section was assigned.
    const student = await Student.findById(ids.irregular.student).lean();
    expect(student.sectionCode).toBeFalsy();
    expect(student.studentType).toBe('irregular');
  });

  test('UT-18 an invalid enrolment code is rejected', async () => {
    const token = await login(ids.bogus.email);

    const bySection = await request(app)
      .post('/api/classSpaces/join')
      .set(asStudent(token))
      .send({ code: 'XXXX0000' });
    expect([400, 404]).toContain(bySection.status);
    expect(bySection.body.success).toBe(false);

    const byClass = await request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(asStudent(token))
      .send({ classCode: 'XXXX0000' });
    expect([400, 404]).toContain(byClass.status);
    expect(byClass.body.success).toBe(false);

    // Nothing was created for them.
    const spaces = await ClassSpace.find({ 'enrolledStudents.student': ids.bogus.student }).lean();
    expect(spaces).toEqual([]);
  });

  test('UT-19 a subject whose time clashes with one already joined is refused', async () => {
    // The irregular student already holds CC 101 at 08:00-09:00 (UT-17).
    const token = await login(ids.irregular.email);
    const res = await request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(asStudent(token))
      .send({ classCode: 'CLASHXXX' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/conflict/i);

    // Still only the one class.
    const spaces = await ClassSpace.find({ 'enrolledStudents.student': ids.irregular.student }).lean();
    expect(spaces).toHaveLength(1);
  });

  test('UT-19a a subject at a free hour is accepted, so the clash check is not blanket', async () => {
    const token = await login(ids.irregular.email);
    const res = await request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(asStudent(token))
      .send({ classCode: 'CLASSCCC' }); // 13:00-14:00, nothing else there

    expect(res.status).toBe(200);
    const spaces = await ClassSpace.find({ 'enrolledStudents.student': ids.irregular.student }).lean();
    expect(spaces).toHaveLength(2);
  });

  test('UT-20 joining a class twice is refused and does not duplicate the row', async () => {
    const token = await login(ids.dupe.email);

    const first = await request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(asStudent(token))
      .send({ classCode: 'CLASSBBB' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/classSpaces/enroll-by-code')
      .set(asStudent(token))
      .send({ classCode: 'CLASSBBB' });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already enrolled/i);

    const space = await ClassSpace.findById(ids.spaceB._id).lean();
    const rows = space.enrolledStudents.filter((e) => String(e.student) === String(ids.dupe.student));
    expect(rows).toHaveLength(1);
  });

  test('UT-20a a regular student re-sending their own section code is refused', async () => {
    const token = await login(ids.regular.email);
    const res = await request(app)
      .post('/api/classSpaces/join')
      .set(asStudent(token))
      .send({ code: SECTION_ENROL_CODE });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already enrolled/i);

    // The seat count did not drift.
    const section = await Section.findOne({ sectionCode: SECTION_CODE }).lean();
    expect(section.currentStudents).toBe(1);
  });
});
