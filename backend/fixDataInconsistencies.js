/**
 * Fix Data Inconsistencies
 * 
 * This script fixes data inconsistencies caused by deleted schedules:
 * 1. Recalculates faculty teaching hours based on active schedules
 * 2. Recalculates section student counts based on actual enrolled students
 * 3. Reports all fixes made
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Faculty = require('./models/Faculty.model');
const Schedule = require('./models/Schedule.model');
const Section = require('./models/Section.model');
const Student = require('./models/Student.model');
const User = require('./models/User.model');
const Subject = require('./models/Subject.model');

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

async function fixFacultyHours() {
  console.log('\n📊 FIXING FACULTY TEACHING HOURS\n' + '='.repeat(50));
  
  const allFaculty = await Faculty.find().populate('user', 'firstName lastName');
  let fixedCount = 0;

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
    schedules.forEach(schedule => {
      const hours = calculateScheduleHours(schedule.timeSlots);
      totalHours += hours;
    });

    // Update faculty hours
    const oldHours = faculty.currentTeachingHours || 0;
    const newHours = parseFloat(totalHours.toFixed(2));

    if (oldHours !== newHours) {
      await Faculty.findByIdAndUpdate(faculty._id, {
        currentTeachingHours: newHours
      });

      console.log(`✅ ${faculty.employeeId} - ${facultyName}`);
      console.log(`   Old hours: ${oldHours} → New hours: ${newHours}`);
      console.log(`   Active schedules: ${schedules.length}`);
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} faculty member(s)`);
  return fixedCount;
}

async function fixSectionStudentCounts() {
  console.log('\n\n📊 FIXING SECTION STUDENT COUNTS\n' + '='.repeat(50));
  
  const allSections = await Section.find();
  let fixedCount = 0;

  for (const section of allSections) {
    // Count actual students enrolled in this section
    const studentCount = await Student.countDocuments({
      sectionCode: section.sectionCode
    });

    const oldCount = section.currentStudents || 0;

    if (oldCount !== studentCount) {
      await Section.findByIdAndUpdate(section._id, {
        currentStudents: studentCount
      });

      console.log(`✅ ${section.sectionCode}`);
      console.log(`   Old count: ${oldCount} → New count: ${studentCount}`);
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} section(s)`);
  return fixedCount;
}

async function cleanOrphanedStudentSections() {
  console.log('\n\n📊 CLEANING ORPHANED STUDENT SECTIONS\n' + '='.repeat(50));
  
  // Find students with sectionCode that doesn't exist
  const students = await Student.find({ 
    sectionCode: { $exists: true, $ne: null, $ne: '' } 
  });
  
  let fixedCount = 0;

  for (const student of students) {
    // Check if section exists
    const sectionExists = await Section.findOne({ 
      sectionCode: student.sectionCode 
    });

    if (!sectionExists) {
      console.log(`⚠️  Student ${student.studentId} has non-existent section: ${student.sectionCode}`);
      console.log(`   Clearing section assignment...`);
      
      await Student.findByIdAndUpdate(student._id, {
        sectionCode: null
      });
      
      fixedCount++;
    }
  }

  console.log(`\n✅ Cleaned ${fixedCount} orphaned student section(s)`);
  return fixedCount;
}

async function generateSummaryReport() {
  console.log('\n\n📊 DATA SUMMARY REPORT\n' + '='.repeat(50));
  
  // Faculty summary
  const totalFaculty = await Faculty.countDocuments();
  const facultyWithHours = await Faculty.countDocuments({ 
    currentTeachingHours: { $gt: 0 } 
  });
  
  console.log('\n👨‍🏫 FACULTY:');
  console.log(`   Total: ${totalFaculty}`);
  console.log(`   With teaching hours: ${facultyWithHours}`);
  console.log(`   Without teaching hours: ${totalFaculty - facultyWithHours}`);

  // Schedule summary
  const totalSchedules = await Schedule.countDocuments({ isActive: true });
  console.log('\n📅 SCHEDULES:');
  console.log(`   Active schedules: ${totalSchedules}`);

  // Section summary
  const totalSections = await Section.countDocuments();
  const sectionsWithStudents = await Section.countDocuments({ 
    currentStudents: { $gt: 0 } 
  });
  
  console.log('\n🎓 SECTIONS:');
  console.log(`   Total: ${totalSections}`);
  console.log(`   With students: ${sectionsWithStudents}`);
  console.log(`   Empty: ${totalSections - sectionsWithStudents}`);

  // Student summary
  const totalStudents = await Student.countDocuments();
  const studentsWithSection = await Student.countDocuments({ 
    sectionCode: { $exists: true, $ne: null, $ne: '' } 
  });
  
  console.log('\n👥 STUDENTS:');
  console.log(`   Total: ${totalStudents}`);
  console.log(`   Assigned to sections: ${studentsWithSection}`);
  console.log(`   Not assigned: ${totalStudents - studentsWithSection}`);
}

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Fix all inconsistencies
    const facultyFixed = await fixFacultyHours();
    const sectionsFixed = await fixSectionStudentCounts();
    const orphansFixed = await cleanOrphanedStudentSections();

    // Generate summary report
    await generateSummaryReport();

    console.log('\n' + '='.repeat(50));
    console.log('✅ DATA CLEANUP COMPLETE!');
    console.log('='.repeat(50));
    console.log(`   Faculty fixed: ${facultyFixed}`);
    console.log(`   Sections fixed: ${sectionsFixed}`);
    console.log(`   Orphaned assignments cleaned: ${orphansFixed}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
main();
