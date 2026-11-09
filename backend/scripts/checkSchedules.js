const mongoose = require('mongoose');
const Schedule = require('../models/Schedule.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkSchedules() {
  try {
    const schedules = await Schedule.find({})
      .populate('subject', 'subjectCode subjectName')
      .populate('faculty')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .sort({ createdAt: -1 })
      .limit(20);

    console.log(`\n📅 Found ${schedules.length} schedules in database\n`);

    if (schedules.length === 0) {
      console.log('❌ No schedules found! The generation might have failed silently.');
      console.log('\nPossible issues:');
      console.log('1. No faculty members in database');
      console.log('2. No rooms in database');
      console.log('3. No subjects for the selected program/year/semester');
      console.log('4. All schedules marked as inactive (isActive: false)');
    } else {
      schedules.forEach((schedule, idx) => {
        console.log(`${idx + 1}. ${schedule.subject?.subjectCode || 'N/A'} - ${schedule.subject?.subjectName || 'N/A'}`);
        console.log(`   Program: ${schedule.program}, Year: ${schedule.yearLevel}, Semester: ${schedule.semester}`);
        console.log(`   Section: ${schedule.section}`);
        console.log(`   Faculty: ${schedule.faculty?.user?.firstName || 'N/A'} ${schedule.faculty?.user?.lastName || ''}`);
        console.log(`   Room: ${schedule.room || 'N/A'}`);
        console.log(`   Status: ${schedule.status}, Active: ${schedule.isActive}`);
        console.log(`   Time Slots: ${schedule.timeSlots?.length || 0} slots`);
        if (schedule.timeSlots && schedule.timeSlots.length > 0) {
          schedule.timeSlots.forEach(slot => {
            console.log(`      - ${slot.day}: ${slot.startTime} - ${slot.endTime}`);
          });
        }
        console.log('');
      });
    }

    // Check for inactive schedules
    const inactiveCount = await Schedule.countDocuments({ isActive: false });
    if (inactiveCount > 0) {
      console.log(`⚠️  Warning: ${inactiveCount} inactive schedules found (isActive: false)`);
    }

    // Check for draft schedules
    const draftCount = await Schedule.countDocuments({ status: 'draft' });
    console.log(`\n📊 Status Summary:`);
    console.log(`   Draft: ${draftCount}`);
    console.log(`   Published: ${await Schedule.countDocuments({ status: 'published' })}`);
    console.log(`   Total Active: ${await Schedule.countDocuments({ isActive: true })}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchedules();
