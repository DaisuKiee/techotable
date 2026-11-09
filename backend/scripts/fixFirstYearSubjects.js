const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Update subjects to match curriculum image exactly
async function fixFirstYearSubjects() {
  try {
    console.log('Fixing first year subject hours to match curriculum...\n');

    // Update CC 111: Introduction to Computing - should be 3L + 6Lab = 9 total (not 3L + 3Lab)
    await Subject.updateOne(
      { subjectCode: 'CC 111', program: 'BSIT', yearLevel: 1, semester: 1 },
      { $set: { lectureHours: 3, labHours: 6 } }
    );
    console.log('✅ Updated CC 111: 3 Lec + 6 Lab = 9 hours total');

    // Update CC 112: Computer Programming 1 (Lec) - should be 2L + 3Lab = 5 total as one combined entry
    await Subject.updateOne(
      { subjectCode: 'CC 112', program: 'BSIT', yearLevel: 1, semester: 1 },
      { $set: { lectureHours: 2, labHours: 3 } }
    );
    console.log('✅ Updated CC 112: 2 Lec + 3 Lab = 5 hours total');

    // Delete CC 112 L since it should be combined with CC 112
    await Subject.deleteOne({ subjectCode: 'CC 112 L', program: 'BSIT', yearLevel: 1, semester: 1 });
    console.log('✅ Deleted CC 112 L (now combined with CC 112)');

    // Update PATHFR 1: Should be 0 Lec + 3 Lab (activity course)
    await Subject.updateOne(
      { subjectCode: 'PATHFR 1', program: 'BSIT', yearLevel: 1, semester: 1 },
      { $set: { lectureHours: 0, labHours: 3 } }
    );
    console.log('✅ Updated PATHFR 1: 0 Lec + 3 Lab = 3 hours total');

    // 2ND SEMESTER FIXES

    // Update CC 123 L: Computer Programming 2 (Lab) - based on image shows 3L + 0Lab for lec part
    await Subject.updateOne(
      { subjectCode: 'CC 121', program: 'BSIT', yearLevel: 1, semester: 2 },
      { $set: { lectureHours: 3, labHours: 0, subjectName: 'Computer Programming 2 (Lec)' } }
    );
    console.log('✅ Updated CC 121: 3 Lec + 0 Lab = 3 hours total');

    // Update CC 123 L to correct code and hours
    await Subject.updateOne(
      { subjectCode: 'CC 123 L', program: 'BSIT', yearLevel: 1, semester: 2 },
      { $set: { lectureHours: 0, labHours: 3, units: 3, subjectName: 'Computer Programming 2 (Lab)' } }
    );
    console.log('✅ Updated CC 123 L: 0 Lec + 3 Lab = 3 hours total');

    // Update CC 121 / MATH-E2 - should be just one subject
    await Subject.updateOne(
      { subjectCode: 'CC 121 / MATH-E2', program: 'BSIT', yearLevel: 1, semester: 2 },
      { $set: { subjectCode: 'CC 121 / Math-E2', lectureHours: 3, labHours: 0 } }
    );
    console.log('✅ Updated CC 121 / Math-E2: 3 Lec + 0 Lab = 3 hours total');

    // Update PATHFR 2: Should be 0 Lec + 2 Lab
    await Subject.updateOne(
      { subjectCode: 'PATHFR 2', program: 'BSIT', yearLevel: 1, semester: 2 },
      { $set: { lectureHours: 0, labHours: 2 } }
    );
    console.log('✅ Updated PATHFR 2: 0 Lec + 2 Lab = 2 hours total');

    console.log('\n📊 Verification - First Year Semester 1:');
    const sem1Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 1, 
      semester: 1 
    }).sort({ subjectCode: 1 });

    sem1Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(15)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n📊 Verification - First Year Semester 2:');
    const sem2Subjects = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 1, 
      semester: 2 
    }).sort({ subjectCode: 1 });

    sem2Subjects.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`   ${s.subjectCode.padEnd(15)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n✨ First year subjects fixed to match curriculum!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixFirstYearSubjects();
