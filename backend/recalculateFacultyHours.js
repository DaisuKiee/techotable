/**
 * Recalculate Faculty Teaching Hours
 * 
 * This script recalculates currentTeachingHours for all faculty members
 * based on their active schedules. Fixes hours that were incorrectly
 * tracked using the old 'currentLoad' field or subject units.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Faculty = require('./models/Faculty.model');
const Schedule = require('./models/Schedule.model');
const Subject = require('./models/Subject.model');
const User = require('./models/User.model');

/**
 * Convert time string (HH:MM) to minutes
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate total teaching hours from time slots
 */
function calculateScheduleHours(timeSlots) {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    return 0;
  }
  
  let totalHours = 0;
  timeSlots.forEach(slot => {
    if (slot.startTime && slot.endTime) {
      const startMinutes = timeToMinutes(slot.startTime);
      const endMinutes = timeToMinutes(slot.endTime);
      const durationHours = (endMinutes - startMinutes) / 60;
      totalHours += durationHours;
    }
  });
  
  return totalHours;
}

async function recalculateFacultyHours() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all faculty members
    const allFaculty = await Faculty.find().populate('user', 'firstName lastName');
    console.log(`📊 Found ${allFaculty.length} faculty members\n`);

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const faculty of allFaculty) {
      const facultyName = faculty.user ? 
        `${faculty.user.firstName} ${faculty.user.lastName}` : 
        faculty.employeeId;

      // Get all active schedules for this faculty
      const schedules = await Schedule.find({
        faculty: faculty._id,
        isActive: true
      }).populate('subject', 'subjectCode');

      // Calculate total hours from all schedules
      let totalHours = 0;
      const scheduleDetails = [];

      schedules.forEach(schedule => {
        const hours = calculateScheduleHours(schedule.timeSlots);
        totalHours += hours;
        
        scheduleDetails.push({
          subject: schedule.subject?.subjectCode || 'Unknown',
          section: schedule.sectionCode,
          hours: hours.toFixed(2)
        });
      });

      // Update faculty hours
      const oldHours = faculty.currentTeachingHours || 0;
      const newHours = parseFloat(totalHours.toFixed(2));

      if (oldHours !== newHours) {
        await Faculty.findByIdAndUpdate(faculty._id, {
          currentTeachingHours: newHours
        });

        console.log(`📝 ${faculty.employeeId} - ${facultyName}`);
        console.log(`   Old hours: ${oldHours} → New hours: ${newHours}`);
        console.log(`   Schedules (${schedules.length}):`);
        scheduleDetails.forEach(detail => {
          console.log(`     - ${detail.subject} (${detail.section}): ${detail.hours} hrs`);
        });
        console.log('');
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }

    console.log('\n✅ Recalculation Complete!');
    console.log(`   Updated: ${updatedCount} faculty members`);
    console.log(`   Unchanged: ${unchangedCount} faculty members`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
recalculateFacultyHours();
