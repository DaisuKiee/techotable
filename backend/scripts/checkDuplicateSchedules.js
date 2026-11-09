const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Schedule = require('../models/Schedule.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all active schedules
    const schedules = await Schedule.find({ isActive: true })
      .populate('subject', 'subjectCode subjectName')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .sort({ sectionCode: 1 });

    console.log(`\n📊 Total Active Schedules: ${schedules.length}\n`);

    // Group by sectionCode to find duplicates
    const grouped = {};
    
    for (const schedule of schedules) {
      const key = `${schedule.sectionCode}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(schedule);
    }

    // Find duplicates
    console.log('🔍 Checking for duplicate schedule entries...\n');
    
    let duplicatesFound = false;
    for (const [key, items] of Object.entries(grouped)) {
      if (items.length > 1) {
        duplicatesFound = true;
        console.log(`❌ DUPLICATE: ${key} has ${items.length} entries:`);
        items.forEach((item, idx) => {
          console.log(`   ${idx + 1}. ID: ${item._id}`);
          console.log(`      Subject: ${item.subject?.subjectCode || 'N/A'}`);
          console.log(`      Faculty: ${item.faculty?.user?.firstName || 'N/A'} ${item.faculty?.user?.lastName || ''}`);
          console.log(`      Room: ${item.room}`);
          console.log(`      Time Slots: ${item.timeSlots.length}`);
          item.timeSlots.forEach((slot, slotIdx) => {
            console.log(`         ${slotIdx + 1}. ${slot.day} ${slot.startTime}-${slot.endTime}`);
          });
          console.log(`      Created: ${item.createdAt}`);
          console.log('');
        });
      }
    }

    if (!duplicatesFound) {
      console.log('✅ No duplicate sectionCode entries found');
    }

    // Check for schedules with the same subject, section, and overlapping time slots
    console.log('\n🔍 Checking for duplicate subject assignments...\n');
    
    const subjectDuplicates = {};
    for (const schedule of schedules) {
      const key = `${schedule.program}-${schedule.yearLevel}-${schedule.section}-${schedule.subject?._id}`;
      if (!subjectDuplicates[key]) {
        subjectDuplicates[key] = [];
      }
      subjectDuplicates[key].push(schedule);
    }

    let subjectDupsFound = false;
    for (const [key, items] of Object.entries(subjectDuplicates)) {
      if (items.length > 1) {
        subjectDupsFound = true;
        console.log(`❌ SUBJECT DUPLICATE: ${key}`);
        console.log(`   Found ${items.length} schedules for the same subject and section:`);
        items.forEach((item, idx) => {
          console.log(`   ${idx + 1}. ${item.sectionCode} - ${item.subject?.subjectCode || 'N/A'} - Room ${item.room}`);
        });
        console.log('');
      }
    }

    if (!subjectDupsFound) {
      console.log('✅ No duplicate subject assignments found');
    }

    // Sample some schedules
    console.log('\n📋 Sample of schedules (first 5):');
    schedules.slice(0, 5).forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.sectionCode}`);
      console.log(`   Subject: ${s.subject?.subjectCode || 'N/A'} - ${s.subject?.subjectName || 'N/A'}`);
      console.log(`   Faculty: ${s.faculty?.user?.firstName || 'N/A'} ${s.faculty?.user?.lastName || ''}`);
      console.log(`   Room: ${s.room}`);
      console.log(`   Slots: ${s.timeSlots.length}`);
      s.timeSlots.forEach((slot) => {
        console.log(`      - ${slot.day} ${slot.startTime}-${slot.endTime}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkDuplicates();
