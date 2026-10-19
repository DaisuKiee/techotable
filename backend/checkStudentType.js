require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/student.model');
const User = require('./models/User.model');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkStudentType() {
  try {
    console.log('\n=== Checking Student Types ===\n');
    
    const students = await Student.find()
      .populate('user', 'email firstName lastName')
      .limit(20);
    
    console.log(`Found ${students.length} students:\n`);
    
    students.forEach((student, idx) => {
      console.log(`${idx + 1}. ${student.user?.email || 'N/A'}`);
      console.log(`   Name: ${student.user?.firstName} ${student.user?.lastName}`);
      console.log(`   Student ID: ${student.studentId}`);
      console.log(`   Student Type: ${student.studentType || 'NOT SET'}`);
      console.log(`   Enrollment Status: ${student.enrollmentStatus || 'N/A'}`);
      console.log(`   Section: ${student.sectionCode || 'N/A'}`);
      console.log('');
    });
    
    const irregularCount = students.filter(s => s.studentType === 'irregular').length;
    const regularCount = students.filter(s => s.studentType === 'regular').length;
    const notSetCount = students.filter(s => !s.studentType).length;
    
    console.log('=== Summary ===');
    console.log(`Regular students: ${regularCount}`);
    console.log(`Irregular students: ${irregularCount}`);
    console.log(`Not set: ${notSetCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkStudentType();
