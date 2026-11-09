const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const checkStudents = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const Student = mongoose.connection.collection('students');
    const count = await Student.countDocuments();
    
    console.log(`📊 Total students in database: ${count}\n`);
    
    if (count > 0) {
      const students = await Student.find().limit(5).toArray();
      console.log('Sample students:');
      students.forEach((s, i) => {
        console.log(`${i + 1}. ${s.studentId} - ${s.program} ${s.yearLevel}${s.section}`);
      });
    } else {
      console.log('⚠️  No students found in database');
      console.log('\n💡 To add students:');
      console.log('   1. Click "+ Add Student" button in the UI');
      console.log('   2. Or use "CSV Import" to import multiple students');
      console.log('   3. Or run the seedData script');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

checkStudents();
