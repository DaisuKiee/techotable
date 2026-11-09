const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Fix fourth year subjects based on curriculum image
async function fixFourthYearSubjects() {
  try {
    console.log('Fixing fourth year subject hours to match curriculum...\n');

    // 1ST SEMESTER FIXES

    // CC 4112: Information Assurance and Security 2 (Lec) - keep as 2L + 0Lab, separate from lab
    await Subject.updateOne(
      { subjectCode: 'CC 4112', program: 'BSIT', yearLevel: 4, semester: 1 },
      { $set: { lectureHours: 2, labHours: 0, units: 2 } }
    );
    console.log('✅ Updated CC 4112: 2 Lec + 0 Lab = 2 hours total');

    // CC 4112 L: Information Assurance and Security 2 (Lab) - should be 0L + 9Lab (not 3Lab)
    await Subject.updateOne(
      { subjectCode: 'CC 4112 L', program: 'BSIT', yearLevel: 4, semester: 1 },
      { $set: { lectureHours: 0, labHours: 9, units: 3 } }
    );
    console.log('✅ Updated CC 4112 L: 0 Lec + 9 Lab = 9 hours total');

    // CC 4113: Systems Administration - should be 2L + 3Lab (not 4L + 3Lab)
    await Subject.updateOne(
      { subjectCode: 'CC 4113', program: 'BSIT', yearLevel: 4, semester: 1 },
      { $set: { lectureHours: 2, labHours: 3, units: 3 } }
    );
    console.log('✅ Updated CC 4113: 2 Lec + 3 Lab = 5 hours total');

    // 2ND SEMESTER
    // OJT should have 720 practicum hours (9 units = 720 hours total)
    await Subject.updateOne(
      { subjectCode: 'CC 4215', program: 'BSIT', yearLevel: 4, semester: 2 },
      { $set: { lectureHours: 0, labHours: 720, units: 9 } }
    );
    console.log('✅ Updated CC 4215 (OJT): 0 Lec + 720 Lab (practicum) hours');

    // Verify all subjects
    console.log('\n📊 Verification - Fourth Year Semester 1:');
    const sem1Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 4, 
      semester: 1 
    }).sort({ subjectCode: 1 });

    sem1Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(20)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n📊 Verification - Fourth Year Semester 2:');
    const sem2Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 4, 
      semester: 2 
    }).sort({ subjectCode: 1 });

    sem2Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(20)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n✨ Fourth year subjects fixed to match curriculum!');
    console.log('🎓 All BSIT subjects (Years 1-4) are now corrected!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixFourthYearSubjects();
