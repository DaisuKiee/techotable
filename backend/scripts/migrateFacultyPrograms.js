require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');
const { getProgramCodes } = require('../utils/programValidator');

/**
 * Backfill the `programs` field on Faculty documents.
 *
 * A faculty member's program affiliation is derived, in priority order, from:
 *   1. teachingHistory[].program  - the strongest signal (they actually taught it)
 *   2. the employeeId prefix      - seeded ids look like FAC-<PROGRAM>-NNN
 *
 * Faculty that match neither are left with an EMPTY programs array and reported,
 * so an admin can assign them explicitly. We deliberately do NOT fall back to
 * "assign every program", because that makes the program filter match everyone
 * and silently defeats per-program scoping.
 *
 * Usage:
 *   node scripts/migrateFacultyPrograms.js           # only fill in faculty with no programs
 *   node scripts/migrateFacultyPrograms.js --reset   # recompute for ALL faculty (repairs bad data)
 */

const RESET = process.argv.includes('--reset');

/**
 * Pull the program code out of an employeeId like `FAC-BSIT-001` or `FAC-BIT-ET-001`.
 * Matches against real program codes so hyphenated codes (BIT-ET) parse correctly,
 * preferring the longest match to avoid any prefix ambiguity.
 */
const programFromEmployeeId = (employeeId, programCodes) => {
  if (!employeeId) return null;

  const matches = programCodes
    .filter(code => employeeId.toUpperCase().startsWith(`FAC-${code.toUpperCase()}-`))
    .sort((a, b) => b.length - a.length);

  return matches[0] || null;
};

async function migrateFacultyPrograms() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Program codes come from the database, not a hardcoded list
    const allProgramCodes = await getProgramCodes(true);
    if (allProgramCodes.length === 0) {
      console.error('❌ No active programs found. Run `node scripts/seedPrograms.js` first.');
      process.exit(1);
    }
    console.log(`📚 Loaded ${allProgramCodes.length} programs: ${allProgramCodes.join(', ')}`);
    console.log(RESET
      ? '⚠️  --reset: recomputing programs for ALL faculty\n'
      : 'ℹ️  Only filling in faculty with no programs (use --reset to recompute all)\n');

    const faculty = await Faculty.find().populate('user', 'firstName lastName');
    console.log(`📊 Found ${faculty.length} faculty members\n`);

    let fromHistory = 0;
    let fromEmployeeId = 0;
    let skipped = 0;
    const unresolved = [];

    for (const f of faculty) {
      const fullName = `${f.user?.firstName || ''} ${f.user?.lastName || ''}`.trim();

      if (!RESET && f.programs && f.programs.length > 0) {
        skipped++;
        continue;
      }

      // 1. Programs they have actually taught
      const programsFromHistory = [...new Set(
        (f.teachingHistory || []).map(h => h.program).filter(Boolean)
      )].filter(p => allProgramCodes.includes(p));

      if (programsFromHistory.length > 0) {
        f.programs = programsFromHistory;
        await f.save();
        console.log(`✅ ${fullName} (${f.employeeId}) → ${programsFromHistory.join(', ')}  [teaching history]`);
        fromHistory++;
        continue;
      }

      // 2. Program encoded in the employee ID
      const derived = programFromEmployeeId(f.employeeId, allProgramCodes);
      if (derived) {
        f.programs = [derived];
        await f.save();
        console.log(`✅ ${fullName} (${f.employeeId}) → ${derived}  [employeeId]`);
        fromEmployeeId++;
        continue;
      }

      // 3. Cannot determine - leave empty and report
      f.programs = [];
      await f.save();
      unresolved.push(`${fullName || '(no name)'} (${f.employeeId})`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed');
    console.log(`   From teaching history : ${fromHistory}`);
    console.log(`   From employeeId       : ${fromEmployeeId}`);
    console.log(`   Skipped (had programs): ${skipped}`);
    console.log(`   Unresolved            : ${unresolved.length}`);
    if (unresolved.length > 0) {
      console.log('\n⚠️  These faculty have NO programs and will not appear in any');
      console.log('   program-filtered list. Assign programs via the Faculty modal:');
      unresolved.forEach(u => console.log(`     - ${u}`));
    }
    console.log('='.repeat(60));

    // Show the resulting distribution so the outcome is verifiable at a glance
    const distribution = await Faculty.aggregate([
      { $unwind: '$programs' },
      { $group: { _id: '$programs', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log('\n📈 Faculty per program:');
    distribution.forEach(d => console.log(`   ${d._id.padEnd(8)} ${d.count}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateFacultyPrograms();
