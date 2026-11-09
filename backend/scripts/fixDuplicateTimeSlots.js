const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Schedule = require('../models/Schedule.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');

async function fixDuplicateTimeSlots() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all active schedules with multiple time slots
    const schedules = await Schedule.find({ 
      isActive: true 
    })
    .populate('subject', 'subjectCode subjectName')
    .populate({
      path: 'faculty',
      populate: { path: 'user', select: 'firstName lastName' }
    });

    console.log(`\n📊 Found ${schedules.length} active schedules\n`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const schedule of schedules) {
      if (!schedule.timeSlots || schedule.timeSlots.length === 0) {
        console.log(`⚠️  Skipping ${schedule.sectionCode} - No time slots`);
        continue;
      }

      // Check if all time slots are on the same day with consecutive times
      const firstSlot = schedule.timeSlots[0];
      const lastSlot = schedule.timeSlots[schedule.timeSlots.length - 1];
      
      const allSameDay = schedule.timeSlots.every(slot => slot.day === firstSlot.day);
      
      if (schedule.timeSlots.length > 1 && allSameDay) {
        // Check if they're consecutive (each slot's end = next slot's start)
        let areConsecutive = true;
        for (let i = 0; i < schedule.timeSlots.length - 1; i++) {
          if (schedule.timeSlots[i].endTime !== schedule.timeSlots[i + 1].startTime) {
            areConsecutive = false;
            break;
          }
        }

        if (areConsecutive) {
          // Fix: Combine into single time slot
          console.log(`🔧 Fixing: ${schedule.sectionCode} - ${schedule.subject?.subjectCode || 'N/A'}`);
          console.log(`   Before: ${schedule.timeSlots.length} slots on ${firstSlot.day}`);
          schedule.timeSlots.forEach((slot, idx) => {
            console.log(`      ${idx + 1}. ${slot.startTime}-${slot.endTime}`);
          });

          schedule.timeSlots = [{
            day: firstSlot.day,
            startTime: firstSlot.startTime,
            endTime: lastSlot.endTime,
            type: firstSlot.type || 'Lecture'
          }];

          await schedule.save();
          
          console.log(`   After: 1 slot - ${firstSlot.day} ${firstSlot.startTime}-${lastSlot.endTime}`);
          console.log('');
          fixed++;
        } else {
          console.log(`✅ ${schedule.sectionCode} - ${schedule.subject?.subjectCode || 'N/A'} has non-consecutive slots (likely intentional)`);
          alreadyCorrect++;
        }
      } else {
        console.log(`✅ ${schedule.sectionCode} - ${schedule.subject?.subjectCode || 'N/A'} already has correct format`);
        alreadyCorrect++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Already correct: ${alreadyCorrect}`);
    console.log(`   Total: ${schedules.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

fixDuplicateTimeSlots();
