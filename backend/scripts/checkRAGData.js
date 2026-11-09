require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const Section = require('../models/Section.model');
const Student = require('../models/Student.model');
const ClassSpace = require('../models/ClassSpace.model');
const User = require('../models/User.model');

async function checkRAGData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('Checking database collections...\n');

    const [subjects, faculty, rooms, schedules, sections, students, classSpaces, users] = await Promise.all([
      Subject.countDocuments(),
      Faculty.countDocuments(),
      Room.countDocuments(),
      Schedule.countDocuments(),
      Section.countDocuments(),
      Student.countDocuments(),
      ClassSpace.countDocuments(),
      User.countDocuments()
    ]);

    console.log('📊 Database Counts:');
    console.log(`  📚 Subjects: ${subjects}`);
    console.log(`  👨‍🏫 Faculty: ${faculty}`);
    console.log(`  🏫 Rooms: ${rooms}`);
    console.log(`  📅 Schedules: ${schedules}`);
    console.log(`  👥 Sections: ${sections}`);
    console.log(`  🎓 Students: ${students}`);
    console.log(`  📍 ClassSpaces: ${classSpaces}`);
    console.log(`  👤 Users: ${users}`);
    console.log(`\n  Total: ${subjects + faculty + rooms + schedules + sections + students + classSpaces + users} records`);

    // Sample some data
    if (subjects > 0) {
      console.log('\n📚 Sample Subject:');
      const sampleSubject = await Subject.findOne().select('subjectCode subjectName program yearLevel').lean();
      console.log(JSON.stringify(sampleSubject, null, 2));
    }

    if (students > 0) {
      console.log('\n🎓 Sample Student:');
      const sampleStudent = await Student.findOne().populate('user', 'firstName lastName').select('studentId program sectionCode').lean();
      console.log(JSON.stringify(sampleStudent, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRAGData();
