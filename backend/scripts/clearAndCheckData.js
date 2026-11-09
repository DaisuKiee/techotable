const mongoose = require('mongoose');
const Schedule = require('../models/Schedule.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const User = require('../models/User.model');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function clearAndCheckData() {
  try {
    // Clear all schedules
    const deleteResult = await Schedule.deleteMany({});
    console.log(`✅ Cleared ${deleteResult.deletedCount} schedules\n`);

    // Check if we have the necessary data
    const subjectCount = await Subject.countDocuments({ program: 'BSIT', yearLevel: 1, semester: 1 });
    const facultyCount = await Faculty.countDocuments({ isActive: true });
    const roomCount = await Room.countDocuments({ isActive: true });

    console.log('📊 Database Status:');
    console.log(`   Subjects (BSIT Year 1 Sem 1): ${subjectCount}`);
    console.log(`   Active Faculty: ${facultyCount}`);
    console.log(`   Active Rooms: ${roomCount}\n`);

    if (subjectCount === 0) {
      console.log('❌ No subjects found! Please add subjects first.');
    }

    if (facultyCount === 0) {
      console.log('❌ No faculty found! Please add faculty first.');
    } else {
      const faculty = await Faculty.find({ isActive: true })
        .populate('user', 'firstName lastName')
        .limit(5);
      console.log('👨‍🏫 Sample Faculty:');
      faculty.forEach(f => {
        console.log(`   - ${f.user?.firstName} ${f.user?.lastName} (Load: ${f.currentLoad}/${f.maxTeachingLoad})`);
      });
      console.log('');
    }

    if (roomCount === 0) {
      console.log('❌ No rooms found! Please add rooms first.');
    } else {
      const rooms = await Room.find({ isActive: true }).limit(5);
      console.log('🏫 Sample Rooms:');
      rooms.forEach(r => {
        console.log(`   - ${r.roomCode}: ${r.roomName} (${r.roomType}, Capacity: ${r.capacity})`);
      });
      console.log('');
    }

    if (subjectCount > 0) {
      const subjects = await Subject.find({ 
        program: 'BSIT', 
        yearLevel: 1, 
        semester: 1 
      }).limit(5);
      console.log('📚 Sample Subjects (BSIT Year 1 Sem 1):');
      subjects.forEach(s => {
        console.log(`   - ${s.subjectCode}: ${s.subjectName} (${s.units} units, ${s.lectureHours}L + ${s.labHours}Lab)`);
      });
      console.log('');
    }

    console.log('✨ Ready to generate schedules!');
    console.log('\n💡 Tip: Make sure to select the correct:');
    console.log('   - Program: BSIT');
    console.log('   - Year Level: 1');
    console.log('   - Semester: 1');
    console.log('   - Section: A (or any letter)');
    console.log('   - Shift: Day (7 AM - 4 PM)');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearAndCheckData();
