require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/student.model');
const User = require('./models/User.model');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function setAllAsIrregular() {
  try {
    console.log('\n=== Setting NOT SET students as Irregular ===\n');
    
    // Find students with no studentType set
    const students = await Student.find({
      $or: [
        { studentType: { $exists: false } },
        { studentType: null },
        { studentType: '' }
      ]
    }).populate('user', 'email firstName lastName');
    
    console.log(`Found ${students.length} students with NOT SET student type:\n`);
    
    students.forEach((student, idx) => {
      console.log(`${idx + 1}. ${student.user?.email || 'N/A'} - ${student.studentId}`);
    });
    
    if (students.length === 0) {
      console.log('No students to update');
      await mongoose.connection.close();
      return;
    }
    
    console.log(`\nUpdating ${students.length} students to irregular...`);
    
    // Update all of them
    const result = await Student.updateMany(
      {
        $or: [
          { studentType: { $exists: false } },
          { studentType: null },
          { studentType: '' }
        ]
      },
      { $set: { studentType: 'irregular' } }
    );
    
    console.log(`\n✅ Successfully updated ${result.modifiedCount} students to irregular type`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

setAllAsIrregular();
