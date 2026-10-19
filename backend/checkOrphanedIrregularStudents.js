/**
 * Check Orphaned Irregular Students
 * 
 * Finds irregular students who have no enrolled classes.
 * These students should either:
 * 1. Be converted to regular students and assigned to a section, OR
 * 2. Be enrolled in at least one subject
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student.model');
const ClassSpace = require('./models/ClassSpace.model');
const User = require('./models/User.model');

async function checkOrphanedIrregularStudents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 CHECKING IRREGULAR STUDENTS\n' + '='.repeat(60));

    // Find all irregular students
    const irregularStudents = await Student.find({ 
      studentType: 'irregular' 
    }).populate('user', 'firstName lastName email');

    console.log(`Found ${irregularStudents.length} irregular student(s)\n`);

    let orphanedCount = 0;
    const orphanedStudents = [];

    for (const student of irregularStudents) {
      // Count how many classes they're enrolled in
      const classCount = await ClassSpace.countDocuments({
        students: student._id
      });

      const userName = student.user ? 
        `${student.user.firstName} ${student.user.lastName}` : 
        'Unknown';

      if (classCount === 0) {
        orphanedCount++;
        orphanedStudents.push({
          id: student._id,
          studentId: student.studentId,
          name: userName,
          email: student.user?.email,
          program: student.program,
          yearLevel: student.yearLevel
        });

        console.log(`⚠️  ${student.studentId} - ${userName}`);
        console.log(`   Email: ${student.user?.email || 'N/A'}`);
        console.log(`   Program: ${student.program} Year ${student.yearLevel}`);
        console.log(`   Enrolled classes: 0`);
        console.log(`   Status: ORPHANED (No classes)`);
        console.log('');
      } else {
        console.log(`✅ ${student.studentId} - ${userName}`);
        console.log(`   Enrolled classes: ${classCount}`);
        console.log('');
      }
    }

    console.log('='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total irregular students: ${irregularStudents.length}`);
    console.log(`   With enrolled classes: ${irregularStudents.length - orphanedCount}`);
    console.log(`   Orphaned (no classes): ${orphanedCount}`);

    if (orphanedCount > 0) {
      console.log('\n⚠️  WARNING: Found orphaned irregular students!');
      console.log('\nThese students should either:');
      console.log('1. Be converted to regular students and assigned to a section');
      console.log('2. Enroll in at least one subject using their subject enrollment code');
      console.log('\nTo fix automatically, run: node fixOrphanedIrregularStudents.js');
    } else {
      console.log('\n✅ All irregular students are properly enrolled in classes!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkOrphanedIrregularStudents();
