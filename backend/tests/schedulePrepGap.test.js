/**
 * The faculty preparation gap, enforced when a class is placed by hand.
 *
 * The solver already keeps an hour between a teacher's classes; this is the
 * guard that catches the same thing when someone drops a class on the builder
 * grid or creates one directly. The bug it fixes: the old check only flagged a
 * clash when two classes overlapped, so a back-to-back class (8–9 then 9–10)
 * slipped through.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Schedule = require('../models/Schedule.model');
const Program = require('../models/Program.model');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');
const { __test__ } = require('../controllers/schedule.controller');
const { checkScheduleConflicts } = __test__;

jest.setTimeout(120000);

let mem;
const FACULTY = new mongoose.Types.ObjectId();
const OTHER_FACULTY = new mongoose.Types.ObjectId();
const SUBJECT = new mongoose.Types.ObjectId();
const ROOM = new mongoose.Types.ObjectId();
const TERM = { academicYear: '2026-2027', semester: 1 };

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'prepgap' });

  // The Schedule model validates `program` against an active Program.
  await Program.create({ code: 'BSIT', name: 'BS Information Technology', isActive: true });

  // Real Faculty documents, so the conflict checker's populate resolves the
  // teacher (a bare id would populate to null and match nobody).
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
  await mkFaculty(FACULTY, 'Alpha');
  await mkFaculty(OTHER_FACULTY, 'Bravo');

  // The teacher already has BSIT-1B-D on Monday 08:00–09:00.
  await Schedule.create({
    subject: SUBJECT,
    faculty: FACULTY,
    room: ROOM,
    program: 'BSIT',
    yearLevel: 1,
    section: 'B',
    sectionCode: 'BSIT-1B-D',
    shift: 'Day',
    ...TERM,
    status: 'published',
    isActive: true,
    timeSlots: [{ day: 'Monday', startTime: '08:00', endTime: '09:00' }],
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

const place = (startTime, endTime, faculty = FACULTY) => checkScheduleConflicts({
  subject: SUBJECT,
  faculty,
  room: new mongoose.Types.ObjectId(), // a free room, so only the teacher is in question
  sectionCode: 'BSIT-1A-D',
  timeSlots: [{ day: 'Monday', startTime, endTime }],
  ...TERM,
});

const gapHits = (details) => details.filter((d) => d.type === 'faculty-gap');

describe('faculty preparation gap on manual placement', () => {
  it('refuses a class that starts right as the last one ends (the reported bug)', async () => {
    const result = await place('09:00', '10:00');
    expect(result.hasConflict).toBe(true);
    expect(gapHits(result.details)).toHaveLength(1);
    expect(gapHits(result.details)[0].message).toMatch(/prepare/i);
  });

  it('refuses a class less than an hour after the previous one', async () => {
    // 09:30–10:30 leaves only 30 minutes after the 09:00 end
    const result = await place('09:30', '10:30');
    expect(gapHits(result.details)).toHaveLength(1);
  });

  it('allows a class a full hour after the previous one', async () => {
    const result = await place('10:00', '11:00');
    expect(gapHits(result.details)).toHaveLength(0);
    expect(result.hasConflict).toBe(false);
  });

  it('also guards the gap before an existing class', async () => {
    // 07:00–07:30 ends 30 minutes before the 08:00 class starts
    const result = await place('07:00', '07:30');
    expect(gapHits(result.details)).toHaveLength(1);
  });

  it('leaves a different teacher alone', async () => {
    const result = await place('09:00', '10:00', OTHER_FACULTY);
    expect(gapHits(result.details)).toHaveLength(0);
  });

  it('still reports a straight double-booking as an overlap, not a gap', async () => {
    const result = await place('08:00', '09:00');
    expect(result.hasConflict).toBe(true);
    expect(result.details.some((d) => d.type === 'faculty')).toBe(true);
  });
});
