const mongoose = require('mongoose');
const Subject = require('./models/Subject.model');
const ClassSpace = require('./models/ClassSpace.model');
require('dotenv').config();

async function findSubjectCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Search for subjects that might match
    const searchTerm = 'VPNY9DSN';
    console.log(`🔍 Searching for subject code containing: ${searchTerm}\n`);

    // Try exact match
    let subject = await Subject.findOne({ subjectCode: searchTerm });
    
    if (!subject) {
      // Try case-insensitive
      subject = await Subject.findOne({ 
        subjectCode: { $regex: new RegExp('^' + searchTerm + '$', 'i') } 
      });
    }

    if (subject) {
      console.log('✅ Found subject:');
      console.log('   Subject Code:', subject.subjectCode);
      console.log('   Subject Name:', subject.subjectName);
      console.log('   Program:', subject.program);
      console.log('   Year:', subject.yearLevel);
      console.log('   Semester:', subject.semester);
      console.log('\n   Looking for active classes...\n');

      // Find all active ClassSpaces for this subject
      const classSpaces = await ClassSpace.find({ 
        subject: subject._id,
        isActive: true 
      }).populate('section', 'sectionCode program yearLevel academicYear semester');

      if (classSpaces.length > 0) {
        console.log(`   ✅ Found ${classSpaces.length} active class(es):`);
        classSpaces.forEach(cs => {
          console.log(`      📝 Class Code: ${cs.classCode}`);
          console.log(`         Section: ${cs.section?.sectionCode}`);
          console.log(`         Program: ${cs.section?.program} Year ${cs.section?.yearLevel}`);
          console.log(`         Term: ${cs.section?.academicYear} Sem ${cs.section?.semester}`);
          console.log(`         Students: ${cs.students?.length || 0}`);
          console.log('');
        });
        console.log('   ℹ️  Students should use one of these CLASS CODES to join, not the subject code!');
      } else {
        console.log('   ❌ No active classes found for this subject.');
      }
    } else {
      console.log('❌ Subject code not found.\n');
      
      // Show some example subject codes
      console.log('📋 Sample subject codes in database:');
      const subjects = await Subject.find().limit(20).select('subjectCode subjectName program yearLevel');
      subjects.forEach(s => {
        console.log(`   ${s.subjectCode} - ${s.subjectName} (${s.program} Year ${s.yearLevel})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
  }
}

findSubjectCode();
