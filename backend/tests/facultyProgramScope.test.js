/**
 * Program isolation for one teacher's profile.
 *
 * A program manager sees borrowed teachers in their faculty list - that is the
 * "Cross Referenced" feature - but the detail route used the same strict guard
 * as the write routes, so opening one of those people answered 403 and the
 * drawer fell back to "Couldn't load the full profile". The list offered a
 * person the detail route refused.
 *
 * Reading a borrowed teacher is now allowed; changing them still is not.
 * Runs against an in-memory MongoDB.
 */

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Program = require('../models/Program.model');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Schedule = require('../models/Schedule.model');
const { facultyProgramGuard, facultyReadGuard } = require('../utils/programScope');

jest.setTimeout(120000);

let mem;
const F = {};

/** Minimal fake req/res so the middleware can be driven directly. */
const run = async (guard, { role, program, id }) => {
  const req = { user: { role, program }, params: { id: String(id) } };
  let status = null;
  let body = null;
  const res = {
    status(code) { status = code; return this; },
    json(payload) { body = payload; return this; },
  };
  let nexted = false;
  let nextErr = null;
  await guard(req, res, (err) => { nexted = true; nextErr = err || null; });
  if (nextErr) throw nextErr;
  return { allowed: nexted, status, code: body?.code };
};

const makeFaculty = async (key, { employeeId, programs }) => {
  const user = await User.create({
    email: `${key}@ctu.edu.ph`, password: 'Str0ng-Passphrase-123!', role: 'faculty',
    firstName: key, lastName: 'Teacher', isActive: true, isEmailVerified: true,
  });
  const faculty = await Faculty.create({
    user: user._id, employeeId, department: 'CoTE', programs, position: 'Instructor',
    specializations: ['Something'],
  });
  F[key] = faculty._id;
  return faculty;
};

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());

  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });
  await Program.create({ code: 'BSHM', name: 'BS Hospitality Management', isActive: true });

  await makeFaculty('native', { employeeId: 'FAC-BSIT-001', programs: ['BSIT'] });
  await makeFaculty('borrowed', { employeeId: 'FAC-BSHM-006', programs: ['BSHM'] });
  await makeFaculty('stranger', { employeeId: 'FAC-BSHM-007', programs: ['BSHM'] });
  await makeFaculty('draftOnly', { employeeId: 'FAC-BSHM-008', programs: ['BSHM'] });

  // Written straight to the collection: the guard only reads faculty/program/
  // status/isActive, and a valid Schedule needs a subject, room and slots that
  // have nothing to do with what is being tested here.
  await Schedule.collection.insertMany([
    { faculty: F.borrowed, program: 'BSIT', status: 'published', isActive: true },
    // Borrowed but not published yet - must NOT open the profile up.
    { faculty: F.draftOnly, program: 'BSIT', status: 'draft', isActive: true },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

const asBsitManager = (id) => ({ role: 'program_manager', program: 'BSIT', id });

describe('facultyReadGuard', () => {
  test('a manager reads their own program’s teacher', async () => {
    expect(await run(facultyReadGuard, asBsitManager(F.native))).toMatchObject({ allowed: true });
  });

  test('a manager reads a teacher borrowed into their program', async () => {
    expect(await run(facultyReadGuard, asBsitManager(F.borrowed))).toMatchObject({ allowed: true });
  });

  test('a teacher from another program is still refused', async () => {
    expect(await run(facultyReadGuard, asBsitManager(F.stranger)))
      .toMatchObject({ allowed: false, status: 403, code: 'OTHER_PROGRAM' });
  });

  test('a borrowed assignment that is still a draft does not open the profile', async () => {
    expect(await run(facultyReadGuard, asBsitManager(F.draftOnly)))
      .toMatchObject({ allowed: false, status: 403 });
  });

  test('admins and the scheduling office are not scoped at all', async () => {
    for (const role of ['admin', 'scheduling_officer']) {
      expect(await run(facultyReadGuard, { role, program: null, id: F.stranger }))
        .toMatchObject({ allowed: true });
    }
  });

  test('a missing teacher is a 404, not a 403', async () => {
    const gone = new mongoose.Types.ObjectId();
    expect(await run(facultyReadGuard, asBsitManager(gone))).toMatchObject({ allowed: false, status: 404 });
  });
});

describe('facultyProgramGuard still protects writes', () => {
  test('a borrowed teacher may be read but not changed', async () => {
    expect(await run(facultyReadGuard, asBsitManager(F.borrowed))).toMatchObject({ allowed: true });
    expect(await run(facultyProgramGuard, asBsitManager(F.borrowed)))
      .toMatchObject({ allowed: false, status: 403, code: 'OTHER_PROGRAM' });
  });

  test('their own program’s teacher is still editable', async () => {
    expect(await run(facultyProgramGuard, asBsitManager(F.native))).toMatchObject({ allowed: true });
  });
});
