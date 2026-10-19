const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('./models/Student.model');
const User = require('./models/User.model');

async function setStudentIrregular(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    // Find student by user ID
    const student = await Student.findOne({ user: user._id });
    if (!student) {
      console.log(`❌ No student profile found for user: ${email}`);
      process.exit(1);
    }

    console.log(`\nFound student:`);
    console.log(`  Name: ${user.firstName} ${user.lastName}`);
    console.log(`  Student ID: ${student.studentId}`);
    console.log(`  Current Type: ${student.studentType || 'NOT SET'}`);
    console.log(`  Section: ${student.sectionCode || 'NOT SET'}`);

    // Update to irregular
    student.studentType = 'irregular';
    await student.save();

    console.log(`\n✅ Updated ${user.firstName} ${user.lastName} to IRREGULAR student\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node setStudentIrregular.js <student-email>');
  console.log('Example: node setStudentIrregular.js student@example.com');
  process.exit(1);
}

setStudentIrregular(email);
