require('dotenv').config();
const mongoose = require('mongoose');
const ClassSpace = require('./models/ClassSpace.model');
const Subject = require('./models/subject.model');
const Section = require('./models/section.model');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkClassCode() {
  try {
    const code = 'B7QUNE6H';
    console.log(`\nSearching for ClassSpace with code: ${code}\n`);
    
    const classSpace = await ClassSpace.findOne({ classCode: code })
      .populate('subject', 'subjectCode subjectName');
    
    if (classSpace) {
      console.log('✅ ClassSpace found:');
      console.log('  ID:', classSpace._id);
      console.log('  Subject:', classSpace.subject?.subjectCode || 'N/A');
      console.log('  Subject Name:', classSpace.subject?.subjectName || 'N/A');
      console.log('  Section:', classSpace.sectionCode || 'N/A');
      console.log('  Class Code:', classSpace.classCode);
      console.log('  Is Active:', classSpace.isActive);
      console.log('  Enrolled Students:', classSpace.enrolledStudents?.length || 0);
    } else {
      console.log('❌ No ClassSpace found with code:', code);
      
      // Check all ClassSpaces for this subject
      const allClassSpaces = await ClassSpace.find()
        .populate('subject', 'subjectCode')
        .limit(10);
      
      console.log('\n📋 Sample ClassSpaces in database:');
      allClassSpaces.forEach(cs => {
        console.log(`  Code: ${cs.classCode || 'NO CODE'}, Subject: ${cs.subject?.subjectCode || 'N/A'}, Active: ${cs.isActive}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkClassCode();
