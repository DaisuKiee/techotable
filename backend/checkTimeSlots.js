require('dotenv').config();
const mongoose = require('mongoose');
const Schedule = require('./models/schedule.model');
const Subject = require('./models/subject.model');
const Section = require('./models/section.model');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkTimeSlots() {
  try {
    console.log('\n=== Checking Schedule TimeSlots ===\n');
    
    // Get schedules with timeSlots
    const schedules = await Schedule.find({
      timeSlots: { $exists: true, $ne: [] }
    })
    .limit(10)
    .populate('subject', 'subjectCode name')
    .populate('section', 'sectionCode');
    
    console.log(`Found ${schedules.length} schedules with timeSlots\n`);
    
    schedules.forEach((schedule, idx) => {
      console.log(`\n--- Schedule ${idx + 1} ---`);
      console.log(`Subject: ${schedule.subject?.subjectCode || 'N/A'} - ${schedule.subject?.name || 'N/A'}`);
      console.log(`Section: ${schedule.section?.sectionCode || schedule.section || 'N/A'}`);
      console.log(`Room: ${schedule.roomLabel || schedule.room || 'N/A'}`);
      console.log(`TimeSlots:`);
      
      if (schedule.timeSlots && schedule.timeSlots.length > 0) {
        schedule.timeSlots.forEach((slot, slotIdx) => {
          console.log(`  Slot ${slotIdx + 1}:`);
          console.log(`    day: ${slot.day} (type: ${typeof slot.day})`);
          console.log(`    startTime: ${slot.startTime}`);
          console.log(`    endTime: ${slot.endTime}`);
          console.log(`    room: ${slot.room || 'N/A'}`);
        });
      } else {
        console.log('  No timeSlots array');
      }
      
      // Also check legacy fields
      if (schedule.day || schedule.startTime || schedule.endTime) {
        console.log(`Legacy fields:`);
        console.log(`  day: ${schedule.day}`);
        console.log(`  startTime: ${schedule.startTime}`);
        console.log(`  endTime: ${schedule.endTime}`);
      }
    });
    
    // Count schedules with missing day in timeSlots
    const schedulesWithTimeSlots = await Schedule.find({
      timeSlots: { $exists: true, $ne: [] }
    });
    
    let missingDayCount = 0;
    schedulesWithTimeSlots.forEach(schedule => {
      if (schedule.timeSlots.some(slot => slot.day === undefined || slot.day === null)) {
        missingDayCount++;
      }
    });
    
    console.log(`\n\n=== Summary ===`);
    console.log(`Total schedules with timeSlots: ${schedulesWithTimeSlots.length}`);
    console.log(`Schedules with missing day in timeSlots: ${missingDayCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkTimeSlots();
