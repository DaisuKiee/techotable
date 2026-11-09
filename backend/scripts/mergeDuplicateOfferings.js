/**
 * Merge duplicate subject offerings.
 *
 * The schedule builder used to save one Schedule document per dropped grid
 * block, and there is exactly one ClassSpace per Schedule, so a subject placed
 * across several blocks turned into several classes: "My Classes" showed the
 * same subject three or four times, each with a single hour on it.
 *
 * The write paths now fold blocks into one offering (see
 * services/scheduleOffering.service.js). This repairs the rows written before
 * that, collapsing each group of duplicates into one Schedule that carries all
 * the meeting times, and one ClassSpace that carries all the announcements,
 * materials and enrolled students.
 *
 * Reports only by default. Pass --apply to write:
 *   node scripts/mergeDuplicateOfferings.js
 *   node scripts/mergeDuplicateOfferings.js --apply
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Schedule = require('../models/Schedule.model');
const ClassSpace = require('../models/ClassSpace.model');
const Student = require('../models/Student.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const { offeringKey, mergeTimeSlots } = require('../services/scheduleOffering.service');

const APPLY = process.argv.includes('--apply');

const refId = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);
const describeSlots = (slots = []) =>
  slots.map(s => `${s.day.slice(0, 3)} ${s.startTime}-${s.endTime}`).join(', ') || 'none';

/**
 * Fold the duplicates' class spaces into the keeper's.
 *
 * Content is unioned rather than dropped: an announcement posted in what turned
 * out to be a duplicate space is still an announcement the students should see.
 */
const mergeClassSpaces = async (keeperSchedule, duplicateSchedules, stats) => {
  const allIds = [keeperSchedule._id, ...duplicateSchedules.map(s => s._id)];
  const spaces = await ClassSpace.find({ schedule: { $in: allIds } });
  if (spaces.length === 0) return;

  // Prefer the space already attached to the schedule we are keeping, so its
  // classCode (which students may have joined with) survives.
  let keeper = spaces.find(s => String(s.schedule) === String(keeperSchedule._id));
  if (!keeper) {
    keeper = spaces[0];
    keeper.schedule = keeperSchedule._id;
  }

  const others = spaces.filter(s => String(s._id) !== String(keeper._id));
  if (others.length === 0) return;

  const seenStudents = new Set(keeper.enrolledStudents.map(e => refId(e.student)));

  for (const other of others) {
    for (const a of other.announcements) keeper.announcements.push(a);
    for (const m of other.materials) keeper.materials.push(m);
    for (const e of other.enrolledStudents) {
      const id = refId(e.student);
      if (!id || seenStudents.has(id)) continue;
      seenStudents.add(id);
      keeper.enrolledStudents.push(e);
    }
  }

  stats.announcementsMoved += others.reduce((n, s) => n + s.announcements.length, 0);
  stats.materialsMoved += others.reduce((n, s) => n + s.materials.length, 0);
  stats.spacesRemoved += others.length;

  if (!APPLY) return;

  await keeper.save();

  const staleIds = others.map(s => s._id);
  // Students point at class spaces directly, so the dead ids have to be swapped
  // for the survivor or "My Classes" would keep loading nothing for them.
  await Student.updateMany(
    { enrolledClasses: { $in: staleIds } },
    { $pull: { enrolledClasses: { $in: staleIds } } }
  );
  await Student.updateMany(
    { _id: { $in: [...seenStudents] } },
    { $addToSet: { enrolledClasses: keeper._id } }
  );
  await ClassSpace.deleteMany({ _id: { $in: staleIds } });
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`);

  const schedules = await Schedule.find({ isActive: true }).sort({ createdAt: 1 });
  const subjects = await Subject.find().select('subjectCode subjectName units').lean();
  const subjectById = new Map(subjects.map(s => [String(s._id), s]));

  const groups = new Map();
  for (const s of schedules) {
    const key = offeringKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const duplicated = [...groups.values()].filter(g => g.length > 1);

  const stats = {
    schedulesBefore: schedules.length,
    schedulesRemoved: 0,
    spacesRemoved: 0,
    announcementsMoved: 0,
    materialsMoved: 0,
    loadCorrections: 0,
    mismatched: 0,
  };

  if (duplicated.length === 0) {
    console.log('No duplicate offerings found. Nothing to do.');
  }

  for (const group of duplicated) {
    const [keeper, ...dups] = group;
    const subject = subjectById.get(String(keeper.subject));
    const label = subject ? subject.subjectCode : String(keeper.subject);

    console.log(`${label} | ${keeper.sectionCode} | ${keeper.academicYear} sem ${keeper.semester}`);
    console.log(`  ${group.length} rows -> 1`);

    // Faculty or room disagreeing means a real data error, not just fragments.
    // Keep the oldest row's choice and say which one was dropped, rather than
    // guessing silently.
    for (const d of dups) {
      if (String(d.faculty) !== String(keeper.faculty)) {
        stats.mismatched++;
        console.log(`  ! different instructor on a duplicate row; keeping the oldest (${keeper.faculty})`);
      }
      if (String(d.room) !== String(keeper.room)) {
        stats.mismatched++;
        console.log(`  ! different room on a duplicate row; keeping the oldest (${keeper.room})`);
      }
    }

    const before = describeSlots(keeper.timeSlots);
    const merged = mergeTimeSlots(...group.map(s => s.timeSlots));
    console.log(`  slots: ${before}  ->  ${describeSlots(merged)}`);

    await mergeClassSpaces(keeper, dups, stats);

    if (APPLY) {
      keeper.timeSlots = merged;
      await keeper.save();

      // Each duplicate row added the subject's units to its teacher's load, so
      // removing them has to give that load back or every teacher stays
      // permanently over-allocated.
      for (const d of dups) {
        const units = subjectById.get(String(d.subject))?.units;
        if (units && d.faculty) {
          await Faculty.findByIdAndUpdate(d.faculty, { $inc: { currentLoad: -units } });
          stats.loadCorrections++;
        }
      }

      await Schedule.deleteMany({ _id: { $in: dups.map(d => d._id) } });
    } else {
      stats.loadCorrections += dups.filter(d => d.faculty).length;
    }

    stats.schedulesRemoved += dups.length;
    console.log('');
  }

  // Schedules are soft-deleted but their class spaces were left active, so a
  // deleted class kept showing in every student's and teacher's list. Retire
  // those spaces instead of deleting them, so the content survives a restore.
  const liveSchedules = await Schedule.find().select('_id isActive').lean();
  const scheduleState = new Map(liveSchedules.map(s => [String(s._id), s.isActive]));
  const activeSpaces = await ClassSpace.find({ isActive: true }).select('_id schedule').lean();

  const stale = activeSpaces.filter(s => scheduleState.get(String(s.schedule)) !== true);
  const orphans = stale.filter(s => !scheduleState.has(String(s.schedule)));

  if (stale.length > 0) {
    console.log(`${stale.length} active class space(s) belong to a deleted schedule`
      + `${orphans.length ? ` (${orphans.length} of them reference a schedule that is gone entirely)` : ''}.`);

    if (APPLY) {
      const ids = stale.map(s => s._id);
      await ClassSpace.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
      await Student.updateMany(
        { enrolledClasses: { $in: ids } },
        { $pull: { enrolledClasses: { $in: ids } } }
      );
      console.log('  retired\n');
    } else {
      console.log('  would be retired\n');
    }
    stats.spacesRetired = stale.length;
  }

  console.log('---');
  console.log(`Schedules: ${stats.schedulesBefore} -> ${stats.schedulesBefore - stats.schedulesRemoved}`);
  console.log(`Class spaces merged away: ${stats.spacesRemoved}`);
  console.log(`Class spaces retired:     ${stats.spacesRetired || 0}`);
  console.log(`Announcements carried:  ${stats.announcementsMoved}`);
  console.log(`Materials carried:      ${stats.materialsMoved}`);
  console.log(`Faculty load corrections: ${stats.loadCorrections}`);
  if (stats.mismatched > 0) {
    console.log(`Rows with a conflicting instructor/room: ${stats.mismatched} (review these sections)`);
  }
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to write these changes.');

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Merge failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
