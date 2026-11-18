/**
 * Who gets told when a class is published or changed.
 *
 * These guard a bug that made schedule emails silently reach nobody: the email
 * service looked for students with `isActive: true`, a matching year level,
 * semester and academic year. Student documents have no `isActive` field at
 * all, year level is routinely unset, and a student's academic year follows
 * their own enrolment rather than the term a class belongs to - so the query
 * matched zero students every time, for every class, while the in-app notices
 * (which matched on the section alone) went out normally.
 *
 * Runs against an in-memory MongoDB. Nothing is emailed and the live database
 * is never touched.
 */

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Program = require('../models/Program.model');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const ClassSpace = require('../models/ClassSpace.model');
const {
  studentsFor,
  studentUserIdsFor,
  emailableStudentsFor,
} = require('../utils/scheduleAudience');

jest.setTimeout(120000);

let mem;
const SECTION = 'BSIT-4A-D';
const SCHEDULE_ID = new mongoose.Types.ObjectId();

const ids = {};

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());

  // Student.program is validated against the active programs.
  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });

  const makeStudent = async (key, { studentId, sectionCode, extra = {} }) => {
    const user = await User.create({
      email: `${key}@ctu.edu.ph`,
      password: 'Str0ng-Passphrase-123!',
      role: 'student',
      firstName: key,
      lastName: 'Tester',
      isActive: true,
      isEmailVerified: true,
    });
    const student = await Student.create({
      user: user._id, studentId, program: 'BSIT', sectionCode, ...extra,
    });
    ids[key] = { user: String(user._id), student: String(student._id) };
    return student;
  };

  // The ordinary case: in the section, with the gaps real records have -
  // no year level, and an academic year of their own.
  await makeStudent('inSection', {
    studentId: '82300001', sectionCode: SECTION,
    extra: { academicYear: '2026-2027', semester: 1 },
  });
  // Same section, but every term field left at whatever the model defaults to.
  await makeStudent('sparse', { studentId: '82300002', sectionCode: SECTION });
  // No section at all - reachable only by having joined the class space.
  const joiner = await makeStudent('joiner', { studentId: '82300003', sectionCode: null });
  // Nothing to do with this class.
  await makeStudent('otherSection', { studentId: '82300004', sectionCode: 'BSIT-1A-D' });

  await ClassSpace.create({
    schedule: SCHEDULE_ID,
    subject: new mongoose.Types.ObjectId(),
    sectionCode: SECTION,
    academicYear: '2026-2027',
    semester: 1,
    enrolledStudents: [{ student: joiner._id }],
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

const key = (list) => list.map((s) => s.studentId).sort();

describe('scheduleAudience', () => {
  test('finds a section’s students even when year level and term are unset', async () => {
    const found = await studentsFor({ sectionCodes: [SECTION] });
    expect(key(found)).toEqual(['82300001', '82300002']);
  });

  test('includes someone who joined the class space without a section code', async () => {
    const found = await studentsFor({ sectionCodes: [SECTION], scheduleIds: [SCHEDULE_ID] });
    expect(key(found)).toEqual(['82300001', '82300002', '82300003']);
  });

  test('never counts the same student twice', async () => {
    // Put a student who is already in the section into the space as well.
    await ClassSpace.updateOne(
      { schedule: SCHEDULE_ID },
      { $push: { enrolledStudents: { student: ids.inSection.student } } }
    );
    const found = await studentsFor({ sectionCodes: [SECTION], scheduleIds: [SCHEDULE_ID] });
    expect(found).toHaveLength(3);
    expect(new Set(found.map((s) => String(s._id))).size).toBe(3);
  });

  test('leaves other sections alone', async () => {
    const found = await studentsFor({ sectionCodes: [SECTION], scheduleIds: [SCHEDULE_ID] });
    expect(found.map((s) => s.studentId)).not.toContain('82300004');
  });

  test('asks for nothing when there is nothing to ask about', async () => {
    expect(await studentsFor({})).toEqual([]);
    expect(await studentsFor({ sectionCodes: [], scheduleIds: [] })).toEqual([]);
  });

  test('the in-app and email audiences are the same people', async () => {
    const where = { sectionCodes: [SECTION], scheduleIds: [SCHEDULE_ID] };
    const userIds = await studentUserIdsFor(where);
    const emailable = await emailableStudentsFor(where);

    expect(userIds.sort()).toEqual(
      [ids.inSection.user, ids.sparse.user, ids.joiner.user].sort()
    );
    // Every one of them has an account with an address, so both lists match.
    expect(emailable).toHaveLength(userIds.length);
    expect(emailable.every((s) => s.user.email)).toBe(true);
  });

  test('skips a student whose account was removed', async () => {
    await User.deleteOne({ _id: ids.sparse.user });
    const emailable = await emailableStudentsFor({ sectionCodes: [SECTION] });
    expect(emailable.map((s) => s.studentId)).toEqual(['82300001']);
  });
});
