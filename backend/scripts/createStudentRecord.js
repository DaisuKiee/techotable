const mongoose = require('mongoose');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const createStudentRecord = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find the user
    const email = 'elixirdevelopmentbot@gmail.com';
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Check if Student record already exists
    const existingStudent = await Student.findOne({ user: user._id });
    if (existingStudent) {
      console.log('✅ Student record already exists!');
      console.log('\n📋 Student Details:');
      console.log(`   Student ID: ${existingStudent.studentId}`);
      console.log(`   Program: ${existingStudent.program}`);
      console.log(`   Year Level: ${existingStudent.yearLevel}`);
      console.log(`   Section: ${existingStudent.section}`);
      process.exit(0);
    }

    // Create Student record
    const student = await Student.create({
      user: user._id,
      studentId: user.studentId,
      program: user.program,
      yearLevel: user.yearLevel,
      section: user.section,
      studentType: 'regular',
      academicYear: '2024-2025',
      semester: 1,
      enrollmentStatus: 'enrolled'
    });

    console.log('✅ Student record created successfully!\n');
    console.log('═══════════════════════════════════════════');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', `${user.firstName} ${user.lastName}`);
    console.log('🎓 Student ID:', student.studentId);
    console.log('📚 Program:', student.program);
    console.log('📅 Year:', student.yearLevel);
    console.log('🏷️  Section:', student.section);
    console.log('📊 Status:', student.enrollmentStatus);
    console.log('═══════════════════════════════════════════\n');
    console.log('✨ The student should now appear in Student Management!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createStudentRecord();
