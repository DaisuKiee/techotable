const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Fix third year subjects based on curriculum image
async function fixThirdYearSubjects() {
  try {
    console.log('Fixing third year subject hours to match curriculum...\n');

    // 1ST SEMESTER FIXES

    // CC 315: Networking 2 (Lec) - keep as 2L + 0Lab, separate from lab
    await Subject.updateOne(
      { subjectCode: 'CC 315', program: 'BSIT', yearLevel: 3, semester: 1 },
      { $set: { lectureHours: 2, labHours: 0, units: 2 } }
    );
    console.log('✅ Updated CC 315: 2 Lec + 0 Lab = 2 hours total');

    // CC 315 L: Networking 2 (Lab) - should be 0L + 9Lab (not 3Lab)
    await Subject.updateOne(
      { subjectCode: 'CC 315 L', program: 'BSIT', yearLevel: 3, semester: 1 },
      { $set: { lectureHours: 0, labHours: 9, units: 3 } }
    );
    console.log('✅ Updated CC 315 L: 0 Lec + 9 Lab = 9 hours total');

    // Add CC 314 if it doesn't exist (missing from original script)
    const cc314Exists = await Subject.findOne({ subjectCode: 'CC 314', program: 'BSIT', yearLevel: 3, semester: 1 });
    if (!cc314Exists) {
      await Subject.create({
        subjectCode: 'CC 314',
        subjectName: 'Fundamentals of Research',
        program: 'BSIT',
        yearLevel: 3,
        semester: 1,
        units: 2,
        lectureHours: 2,
        labHours: 0,
        description: 'Core Course - Fundamentals of Research'
      });
      console.log('✅ Added CC 314: 2 Lec + 0 Lab = 2 hours total');
    } else {
      await Subject.updateOne(
        { subjectCode: 'CC 314', program: 'BSIT', yearLevel: 3, semester: 1 },
        { $set: { lectureHours: 2, labHours: 0, units: 2 } }
      );
      console.log('✅ Updated CC 314: 2 Lec + 0 Lab = 2 hours total');
    }

    // 2ND SEMESTER FIXES

    // GEE-PEE: People and the Earth's Ecosystems - image shows 0 + 0 hours
    await Subject.updateOne(
      { subjectCode: 'GEE-PEE', program: 'BSIT', yearLevel: 3, semester: 2 },
      { $set: { lectureHours: 3, labHours: 0 } }
    );
    console.log('✅ Updated GEE-PEE: 3 Lec + 0 Lab = 3 hours total');

    // CC 3211: Information Assurance and Security 1 (Lec) - keep as 2L + 0Lab, separate from lab
    await Subject.updateOne(
      { subjectCode: 'CC 3211', program: 'BSIT', yearLevel: 3, semester: 2 },
      { $set: { lectureHours: 2, labHours: 0, units: 2 } }
    );
    console.log('✅ Updated CC 3211: 2 Lec + 0 Lab = 2 hours total');

    // CC 3211 L: Information Assurance and Security 1 (Lab) - should be 0L + 9Lab (not 3Lab)
    await Subject.updateOne(
      { subjectCode: 'CC 3211 L', program: 'BSIT', yearLevel: 3, semester: 2 },
      { $set: { lectureHours: 0, labHours: 9, units: 3 } }
    );
    console.log('✅ Updated CC 3211 L: 0 Lec + 9 Lab = 9 hours total');

    // Verify all subjects
    console.log('\n📊 Verification - Third Year Semester 1:');
    const sem1Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 3, 
      semester: 1 
    }).sort({ subjectCode: 1 });

    sem1Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(20)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n📊 Verification - Third Year Semester 2:');
    const sem2Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 3, 
      semester: 2 
    }).sort({ subjectCode: 1 });

    sem2Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(20)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n✨ Third year subjects fixed to match curriculum!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixThirdYearSubjects();
