require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student.model');
const User = require('./models/User.model');

async function checkAndCreateStudentRecord() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users with student role who don't have a student record
    const studentUsers = await User.find({ role: 'student' });
    console.log(`\nFound ${studentUsers.length} users with student role`);

    for (const user of studentUsers) {
      const existingStudent = await Student.findOne({ user: user._id });
      
      if (!existingStudent) {
        console.log(`\n❌ No student record for: ${user.firstName} ${user.lastName} (${user.email})`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Program: ${user.program || 'Not set'}`);
        
        // Create student record
        const newStudent = await Student.create({
          user: user._id,
          studentId: user.studentId || `STU-${Date.now()}`,
          program: user.program || 'BSIT',
          studentType: 'regular',
          academicYear: '2024-2025',
          semester: 2,
          enrollmentStatus: 'enrolled',
          sectionCode: user.section || null
        });
        
        console.log(`   ✅ Created student record with ID: ${newStudent._id}`);
      } else {
        console.log(`\n✅ Student record exists for: ${user.firstName} ${user.lastName}`);
        console.log(`   Student ID: ${existingStudent.studentId}`);
        console.log(`   Program: ${existingStudent.program}`);
        console.log(`   Type: ${existingStudent.studentType}`);
        console.log(`   Section: ${existingStudent.sectionCode || 'Not assigned'}`);
        console.log(`   Status: ${existingStudent.enrollmentStatus}`);
      }
    }

    console.log('\n✅ Check complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndCreateStudentRecord();
