require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const ClassSpace = require('../models/ClassSpace.model');
const Schedule = require('../models/Schedule.model');
const Section = require('../models/Section.model');
const Student = require('../models/Student.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');

/**
 * Rebuild class spaces so there is exactly one per subject offering (Schedule).
 *
 * What it does:
 *  1. Drops the obsolete unique index on ClassSpace.sectionCode. The old schema
 *     allowed only ONE space per section, which is why the previous code had to
 *     invent fake codes like "BSIT-4A-D-3f2a".
 *  2. Removes legacy spaces that have no schedule (the old section-level rooms).
 *  3. Creates/updates one space per active Schedule, with a unique classCode.
 *  4. Re-enrolls students into the spaces for their section.
 *
 * Usage:
 *   node scripts/rebuildClassSpaces.js            # dry run, shows what would change
 *   node scripts/rebuildClassSpaces.js --apply    # actually write
 */

const APPLY = process.argv.includes('--apply');

const log = (...a) => console.log(...a);

async function dropObsoleteIndexes() {
  const coll = mongoose.connection.db.collection('classspaces');
  const indexes = await coll.indexes();

  for (const name of ['sectionCode_1', 'enrollmentCode_1']) {
    const found = indexes.find(i => i.name === name);
    if (!found) {
      log(`   index ${name}: not present, nothing to drop`);
      continue;
    }
    if (!APPLY) {
      log(`   index ${name}: WOULD DROP (unique=${!!found.unique})`);
      continue;
    }
    try {
      await coll.dropIndex(name);
      log(`   index ${name}: dropped`);
    } catch (e) {
      if (e.code === 27 || /index not found/i.test(e.message)) {
        log(`   index ${name}: already gone`);
      } else {
        throw e;
      }
    }
  }
}

async function rebuild() {
  log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  log('Connected\n');

  log(APPLY
    ? '*** APPLY MODE - changes will be written ***\n'
    : '--- DRY RUN - no changes will be written (pass --apply to write) ---\n');

  // ---- 1. indexes -------------------------------------------------------
  log('1. Obsolete indexes on classspaces:');
  await dropObsoleteIndexes();

  // ---- 2. legacy section-level spaces -----------------------------------
  log('\n2. Legacy spaces with no schedule:');
  const legacy = await ClassSpace.collection
    .find({ $or: [{ schedule: null }, { schedule: { $exists: false } }] })
    .toArray();

  if (legacy.length === 0) {
    log('   none');
  } else {
    legacy.forEach(l => log(
      `   ${String(l.sectionCode).padEnd(16)} announcements=${(l.announcements || []).length} ` +
      `materials=${(l.materials || []).length} enrolled=${(l.enrolledStudents || []).length}`
    ));
    const carrying = legacy.filter(
      l => (l.announcements || []).length || (l.materials || []).length
    );
    if (carrying.length > 0) {
      log(`   !! ${carrying.length} of these hold announcements/materials and will NOT be deleted.`);
      log('      Move that content manually, then re-run.');
    }
    const deletable = legacy.filter(
      l => !(l.announcements || []).length && !(l.materials || []).length
    );
    if (APPLY && deletable.length > 0) {
      const r = await ClassSpace.collection.deleteMany({
        _id: { $in: deletable.map(d => d._id) },
      });
      log(`   deleted ${r.deletedCount} empty legacy space(s)`);
    } else if (deletable.length > 0) {
      log(`   WOULD DELETE ${deletable.length} empty legacy space(s)`);
    }
  }

  // ---- 3. one space per schedule ---------------------------------------
  log('\n3. Class spaces per subject offering:');
  const schedules = await Schedule.find({ isActive: true })
    .populate('subject', 'subjectCode subjectName program')
    .lean();

  log(`   ${schedules.length} active schedule(s)`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of schedules) {
    if (!s.subject) {
      log(`   ! schedule ${s._id} has no subject - skipped`);
      skipped++;
      continue;
    }

    const existing = await ClassSpace.findOne({ schedule: s._id });

    const fields = {
      schedule: s._id,
      subject: s.subject._id,
      faculty: s.faculty || null,
      sectionCode: s.sectionCode,
      program: s.program || s.subject.program,
      academicYear: s.academicYear,
      semester: s.semester,
      isActive: true,
    };

    if (existing) {
      if (!APPLY) {
        log(`   = ${s.subject.subjectCode.padEnd(12)} ${s.sectionCode} (exists, would refresh)`);
        updated++;
        continue;
      }
      Object.assign(existing, fields);
      if (!existing.classCode) {
        existing.classCode = await ClassSpace.generateUniqueClassCode();
      }
      await existing.save();
      log(`   = ${s.subject.subjectCode.padEnd(12)} ${s.sectionCode} refreshed  code=${existing.classCode}`);
      updated++;
    } else {
      if (!APPLY) {
        log(`   + ${s.subject.subjectCode.padEnd(12)} ${s.sectionCode} (would create)`);
        created++;
        continue;
      }
      const classCode = await ClassSpace.generateUniqueClassCode();
      await ClassSpace.create({ ...fields, classCode, announcements: [], materials: [], enrolledStudents: [] });
      log(`   + ${s.subject.subjectCode.padEnd(12)} ${s.sectionCode} created    code=${classCode}`);
      created++;
    }
  }

  // ---- 4. re-enrol students -------------------------------------------
  log('\n4. Student enrolment:');
  const students = await Student.find().populate('user', 'firstName lastName').lean();

  for (const st of students) {
    const name = `${st.user?.firstName || ''} ${st.user?.lastName || ''}`.trim() || st.studentId;

    if (st.studentType === 'irregular') {
      const codes = st.subjectCodes || [];
      log(`   ${name} (irregular): ${codes.length} subject code(s) - joins per subject, left as is`);
      continue;
    }

    if (!st.sectionCode) {
      log(`   ${name}: no section - nothing to enrol`);
      continue;
    }

    const spaces = await ClassSpace.find({ sectionCode: st.sectionCode, isActive: true });
    if (spaces.length === 0) {
      log(`   ${name}: section ${st.sectionCode} has no class spaces yet`);
      continue;
    }

    if (!APPLY) {
      log(`   ${name}: WOULD enrol in ${spaces.length} space(s) for ${st.sectionCode}`);
      continue;
    }

    let added = 0;
    for (const cs of spaces) {
      if (!cs.hasStudent(st._id)) {
        cs.enrolledStudents.push({ student: st._id, enrollmentType: 'section' });
        await cs.save();
        added++;
      }
    }

    await Student.findByIdAndUpdate(st._id, {
      enrolledClasses: spaces.map(s => s._id),
    });

    log(`   ${name}: enrolled in ${added} new space(s) (${spaces.length} total for ${st.sectionCode})`);
  }

  // ---- 5. recompute section counters ----------------------------------
  log('\n5. Section student counts:');
  const sections = await Section.find();
  for (const sec of sections) {
    const actual = await Student.countDocuments({
      sectionCode: sec.sectionCode,
      studentType: 'regular',
    });
    if (sec.currentStudents === actual) {
      log(`   ${sec.sectionCode.padEnd(14)} ${actual} (already correct)`);
      continue;
    }
    if (APPLY) {
      sec.currentStudents = actual;
      await sec.save();
      log(`   ${sec.sectionCode.padEnd(14)} ${actual} (was ${sec.currentStudents}) corrected`);
    } else {
      log(`   ${sec.sectionCode.padEnd(14)} WOULD set to ${actual} (currently ${sec.currentStudents})`);
    }
  }

  log('\n' + '='.repeat(62));
  log(APPLY ? 'Rebuild applied' : 'Dry run complete - re-run with --apply to write');
  log(`  spaces created : ${created}`);
  log(`  spaces updated : ${updated}`);
  log(`  skipped        : ${skipped}`);
  log('='.repeat(62));

  await mongoose.disconnect();
  process.exit(0);
}

rebuild().catch(e => {
  console.error('Rebuild failed:', e);
  process.exit(1);
});
