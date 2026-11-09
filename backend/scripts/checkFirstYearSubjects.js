const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkFirstYearSubjects() {
  try {
    console.log('\n📊 First Year Semester 1 Subjects:\n');
    const sem1 = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 1, 
      semester: 1 
    }).sort({ subjectCode: 1 });

    sem1.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`${s.subjectCode.padEnd(15)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    console.log('\n📊 First Year Semester 2 Subjects:\n');
    const sem2 = await Subject.find({ 
      program: 'BSIT', 
      yearLevel: 1, 
      semester: 2 
    }).sort({ subjectCode: 1 });

    sem2.forEach(s => {
      const total = s.lectureHours + s.labHours;
      console.log(`${s.subjectCode.padEnd(15)} - ${s.units} units | ${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFirstYearSubjects();
