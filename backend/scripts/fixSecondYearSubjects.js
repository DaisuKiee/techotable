const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Fix second year subjects based on curriculum image
async function fixSecondYearSubjects() {
  try {
    console.log('Fixing second year subject hours to match curriculum...\n');

    // 1ST SEMESTER FIXES

    // CC 212: Quantitative Methods - should be 3L + 0Lab (not 2L)
    await Subject.updateOne(
      { subjectCode: 'CC 212', program: 'BSIT', yearLevel: 2, semester: 1 },
      { $set: { lectureHours: 3, labHours: 0, units: 3 } }
    );
    console.log('✅ Updated CC 212: 3 Lec + 0 Lab = 3 hours total');

    // CC 214: Data Structures (Lec) - keep as 2L + 0Lab, separate from lab
    await Subject.updateOne(
      { subjectCode: 'CC 214', program: 'BSIT', yearLevel: 2, semester: 1 },
      { $set: { lectureHours: 2, labHours: 0, units: 2 } }
    );
    console.log('✅ Updated CC 214: 2 Lec + 0 Lab = 2 hours total');

    // CC 214 L: Data Structures (Lab) - should be 0L + 3Lab
    await Subject.updateOne(
      { subjectCode: 'CC 214 L', program: 'BSIT', yearLevel: 2, semester: 1 },
      { $set: { lectureHours: 0, labHours: 3, units: 3 } }
    );
    console.log('✅ Updated CC 214 L: 0 Lec + 3 Lab = 3 hours total');

    // CC 213: Object-Oriented Programming - should be 2L + 3Lab = 5hrs
    await Subject.updateOne(
      { subjectCode: 'CC 213', program: 'BSIT', yearLevel: 2, semester: 1 },
      { $set: { lectureHours: 2, labHours: 3 } }
    );
    console.log('✅ Updated CC 213: 2 Lec + 3 Lab = 5 hours total');

    // IT Elec 1: Web Systems - should be 2L + 3Lab (already correct)
    await Subject.updateOne(
      { subjectCode: 'IT Elec 1', program: 'BSIT', yearLevel: 2, semester: 1 },
      { $set: { lectureHours: 2, labHours: 3 } }
    );
    console.log('✅ Updated IT Elec 1: 2 Lec + 3 Lab = 5 hours total');

    // Delete IT Elec 2 (empty placeholder)
    await Subject.deleteOne({ subjectCode: 'IT Elec 2', program: 'BSIT', yearLevel: 2, semester: 1 });
    console.log('✅ Deleted IT Elec 2 (empty placeholder)');

    // PATHFR 3: Should be 2L + 0Lab (not 0L + 2Lab)
    await Subject.updateOne(
      { subjectCode: 'PATHFR 3', program: 'BSIT', yearLevel: 2, semester: 1 },
      { $set: { lectureHours: 2, labHours: 0 } }
    );
    console.log('✅ Updated PATHFR 3: 2 Lec + 0 Lab = 2 hours total');

    // 2ND SEMESTER FIXES

    // CC 225: Information Management (Lec) - keep as 2L + 0Lab, separate from lab
    await Subject.updateOne(
      { subjectCode: 'CC 225', program: 'BSIT', yearLevel: 2, semester: 2 },
      { $set: { lectureHours: 2, labHours: 0, units: 2 } }
    );
    console.log('✅ Updated CC 225: 2 Lec + 0 Lab = 2 hours total');

    // CC 225 L: Information Management (Lab) - should be 0L + 5Lab (not 9Lab)
    await Subject.updateOne(
      { subjectCode: 'CC 225 L', program: 'BSIT', yearLevel: 2, semester: 2 },
      { $set: { lectureHours: 0, labHours: 5, units: 3 } }
    );
    console.log('✅ Updated CC 225 L: 0 Lec + 5 Lab = 5 hours total');

    // PATHFR 4: Should be 2L + 0Lab (not 0L + 2Lab)
    await Subject.updateOne(
      { subjectCode: 'PATHFR 4', program: 'BSIT', yearLevel: 2, semester: 2 },
      { $set: { lectureHours: 2, labHours: 0 } }
    );
    console.log('✅ Updated PATHFR 4: 2 Lec + 0 Lab = 2 hours total');

    // Verify all subjects
    console.log('\n📊 Verification - Second Year Semester 1:');
    const sem1Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 2, 
      semester: 1 
    }).sort({ subjectCode: 1 });

    sem1Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(15)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n📊 Verification - Second Year Semester 2:');
    const sem2Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 2, 
      semester: 2 
    }).sort({ subjectCode: 1 });

    sem2Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(15)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n✨ Second year subjects fixed to match curriculum!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSecondYearSubjects();
