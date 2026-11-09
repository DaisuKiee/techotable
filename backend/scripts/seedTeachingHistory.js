require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const User = require('../models/User.model');
const {
  currentAcademicYearStart,
  formatAcademicYear,
} = require('../utils/teachingExperience');

/**
 * Seed `teachingHistory` on Faculty documents.
 *
 * Every faculty member gets a plausible record spread across the last N academic
 * years, drawn only from subjects that belong to a program they are qualified for.
 * Some subjects are assigned as a "specialty" the teacher repeats most years
 * (recent, deep experience) and others as one-off older assignments, so that
 * recency-weighted ranking has something meaningful to differentiate.
 *
 * Usage:
 *   node scripts/seedTeachingHistory.js           # skip faculty that already have history
 *   node scripts/seedTeachingHistory.js --reset    # overwrite history for ALL faculty
 */

const RESET = process.argv.includes('--reset');
const YEARS_BACK = 6;          // how far back to generate
const SEMESTERS = ['1st Semester', '2nd Semester'];

// Deterministic pseudo-random so reruns produce stable data
let seed = 12345;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const shuffle = (arr) => [...arr].sort(() => rand() - 0.5);

async function seedTeachingHistory() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const currentAY = currentAcademicYearStart();
    console.log(`📅 Current academic year: ${formatAcademicYear(currentAY)}`);
    console.log(`📅 Generating history back to ${formatAcademicYear(currentAY - YEARS_BACK + 1)}`);
    console.log(RESET
      ? '⚠️  --reset: overwriting teachingHistory for ALL faculty\n'
      : 'ℹ️  Only seeding faculty with no history (use --reset to overwrite)\n');

    const subjects = await Subject.find().select('subjectCode subjectName program units').lean();
    if (subjects.length === 0) {
      console.error('❌ No subjects found. Seed subjects first.');
      process.exit(1);
    }

    // Index subjects by program for quick lookup
    const subjectsByProgram = subjects.reduce((acc, s) => {
      if (!s.program) return acc;
      (acc[s.program] = acc[s.program] || []).push(s);
      return acc;
    }, {});
    console.log('📚 Subjects available per program:');
    Object.entries(subjectsByProgram).forEach(([p, list]) =>
      console.log(`   ${p.padEnd(10)} ${list.length}`)
    );
    console.log('');

    const faculty = await Faculty.find().populate('user', 'firstName lastName');
    console.log(`👨‍🏫 Found ${faculty.length} faculty members\n`);

    let seeded = 0;
    let skipped = 0;
    let noSubjects = 0;
    let totalEntries = 0;

    for (const f of faculty) {
      const name = `${f.user?.firstName || ''} ${f.user?.lastName || ''}`.trim();

      if (!RESET && (f.teachingHistory || []).length > 0) {
        skipped++;
        continue;
      }

      // Only subjects from programs this teacher is qualified for,
      // plus shared 'General' subjects.
      const eligible = [
        ...(f.programs || []).flatMap(p => subjectsByProgram[p] || []),
        ...(subjectsByProgram['General'] || []),
      ];

      if (eligible.length === 0) {
        console.log(`⚠️  ${name} (${f.employeeId}): no subjects for programs [${(f.programs || []).join(', ') || 'none'}] - skipped`);
        f.teachingHistory = [];
        await f.save();
        noSubjects++;
        continue;
      }

      const pool = shuffle(eligible);

      // 1-2 "specialty" subjects taught almost every year (deep recent experience)
      const specialtyCount = Math.min(randInt(1, 2), pool.length);
      const specialties = pool.slice(0, specialtyCount);

      // A few other subjects taught occasionally, skewed older
      const occasional = pool.slice(specialtyCount, specialtyCount + randInt(1, 3));

      const history = [];

      // Specialties: taught in most of the recent years
      specialties.forEach(subject => {
        // Start 2-5 years back and run up to either last year or this year
        const startOffset = randInt(2, YEARS_BACK - 1);
        const endOffset = randInt(0, 1); // 0 = still teaching it, 1 = through last year
        for (let offset = startOffset; offset >= endOffset; offset--) {
          // Occasionally skip a year so it isn't perfectly uniform
          if (rand() < 0.15) continue;
          history.push({
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: pick(SEMESTERS),
            academicYear: formatAcademicYear(currentAY - offset),
            program: subject.program,
            rating: Math.round((3.5 + rand() * 1.5) * 10) / 10, // 3.5 - 5.0
          });
        }
      });

      // Occasional subjects: 1-2 older appearances
      occasional.forEach(subject => {
        const times = randInt(1, 2);
        for (let i = 0; i < times; i++) {
          const offset = randInt(3, YEARS_BACK - 1); // deliberately older
          history.push({
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: pick(SEMESTERS),
            academicYear: formatAcademicYear(currentAY - offset),
            program: subject.program,
            rating: Math.round((3.0 + rand() * 1.8) * 10) / 10, // 3.0 - 4.8
          });
        }
      });

      f.teachingHistory = history;
      await f.save();

      totalEntries += history.length;
      seeded++;

      const distinct = new Set(history.map(h => h.subjectCode)).size;
      const newest = history.reduce((min, h) => {
        const off = currentAY - parseInt(h.academicYear, 10);
        return Math.min(min, off);
      }, 99);
      console.log(`✅ ${name.padEnd(16)} (${f.employeeId.padEnd(15)}) ${String(history.length).padStart(2)} entries, ${distinct} subjects, most recent ${newest === 0 ? 'this year' : `${newest}y ago`}`);
    }

    console.log('\n' + '='.repeat(64));
    console.log('✅ Teaching history seeding complete');
    console.log(`   Faculty seeded          : ${seeded}`);
    console.log(`   Skipped (had history)   : ${skipped}`);
    console.log(`   No eligible subjects    : ${noSubjects}`);
    console.log(`   Total history entries   : ${totalEntries}`);
    if (seeded > 0) {
      console.log(`   Avg entries per faculty : ${(totalEntries / seeded).toFixed(1)}`);
    }
    console.log('='.repeat(64));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedTeachingHistory();
