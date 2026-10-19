/**
 * Fix Orphaned Irregular Students
 * 
 * Options:
 * 1. Delete orphaned irregular students (recommended for test accounts)
 * 2. Mark them as inactive
 * 3. Convert specific ones to regular students
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student.model');
const ClassSpace = require('./models/ClassSpace.model');
const User = require('./models/User.model');

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function fixOrphanedIrregularStudents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 FINDING ORPHANED IRREGULAR STUDENTS\n' + '='.repeat(60));

    // Find irregular students with no classes
    const irregularStudents = await Student.find({ 
      studentType: 'irregular' 
    }).populate('user', 'firstName lastName email');

    const orphaned = [];
    for (const student of irregularStudents) {
      const classCount = await ClassSpace.countDocuments({
        students: student._id
      });
      if (classCount === 0) {
        orphaned.push(student);
      }
    }

    if (orphaned.length === 0) {
      console.log('✅ No orphaned irregular students found!');
      rl.close();
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`Found ${orphaned.length} orphaned irregular student(s):\n`);
    orphaned.forEach((s, i) => {
      const userName = s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown';
      console.log(`${i + 1}. ${s.studentId} - ${userName} (${s.user?.email || 'N/A'})`);
      console.log(`   Program: ${s.program || 'N/A'}, Year: ${s.yearLevel || 'undefined'}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('\nWhat would you like to do?');
    console.log('1. Delete all orphaned irregular students');
    console.log('2. Mark all as inactive (soft delete)');
    console.log('3. Cancel');
    
    const choice = await question('\nEnter your choice (1-3): ');

    if (choice === '1') {
      // Delete students and their user accounts
      console.log('\n🗑️  Deleting orphaned irregular students...');
      let deletedCount = 0;
      
      for (const student of orphaned) {
        const userId = student.user?._id;
        
        // Delete student
        await Student.findByIdAndDelete(student._id);
        
        // Delete associated user account
        if (userId) {
          await User.findByIdAndDelete(userId);
        }
        
        const userName = student.user ? 
          `${student.user.firstName} ${student.user.lastName}` : 
          'Unknown';
        console.log(`   ✅ Deleted: ${student.studentId} - ${userName}`);
        deletedCount++;
      }
      
      console.log(`\n✅ Successfully deleted ${deletedCount} student(s) and their user accounts!`);
      
    } else if (choice === '2') {
      // Mark as inactive
      console.log('\n📝 Marking students as inactive...');
      let markedCount = 0;
      
      for (const student of orphaned) {
        await Student.findByIdAndUpdate(student._id, {
          isActive: false
        });
        
        const userName = student.user ? 
          `${student.user.firstName} ${student.user.lastName}` : 
          'Unknown';
        console.log(`   ✅ Marked inactive: ${student.studentId} - ${userName}`);
        markedCount++;
      }
      
      console.log(`\n✅ Successfully marked ${markedCount} student(s) as inactive!`);
      
    } else {
      console.log('\n❌ Operation cancelled');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixOrphanedIrregularStudents();
