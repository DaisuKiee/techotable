const mongoose = require('mongoose');
const ClassSpace = require('./models/ClassSpace.model');
const Section = require('./models/Section.model');
const Subject = require('./models/Subject.model');
require('dotenv').config();

async function checkCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const code = 'VPNY9DSN';
    console.log(`🔍 Searching for: ${code}\n`);

    // Check if it's a ClassSpace class code
    const classSpace = await ClassSpace.findOne({ classCode: code })
      .populate('subject', 'subjectCode subjectName')
      .populate('section', 'sectionCode program yearLevel');
    
    if (classSpace) {
      console.log('✅ Found as ClassSpace CLASS CODE:');
      console.log('   Class Code:', classSpace.classCode);
      console.log('   Subject:', classSpace.subject?.subjectCode, '-', classSpace.subject?.subjectName);
      console.log('   Section:', classSpace.section?.sectionCode);
      console.log('   Program:', classSpace.section?.program);
      console.log('   Year Level:', classSpace.section?.yearLevel);
      console.log('   Is Active:', classSpace.isActive);
      console.log('   Students:', classSpace.students?.length || 0);
    } else {
      console.log('❌ NOT found as ClassSpace class code');
    }

    console.log('');

    // Check if it's a Section enrollment code
    const section = await Section.findOne({ enrollmentCode: code })
      .populate('adviser');
    
    if (section) {
      console.log('✅ Found as Section ENROLLMENT CODE:');
      console.log('   Section Code:', section.sectionCode);
      console.log('   Enrollment Code:', section.enrollmentCode);
      console.log('   Program:', section.program);
      console.log('   Year Level:', section.yearLevel);
      console.log('   Academic Year:', section.academicYear);
      console.log('   Semester:', section.semester);
      console.log('   Is Active:', section.isActive);
      console.log('   Students:', section.currentStudents, '/', section.maxStudents);
    } else {
      console.log('❌ NOT found as Section enrollment code');
    }

    console.log('');

    // Check if it's a Subject code (MISTAKE - students often try this)
    const subject = await Subject.findOne({ subjectCode: code });
    
    if (subject) {
      console.log('⚠️  Found as SUBJECT CODE (this is NOT a valid enrollment code!):');
      console.log('   Subject Code:', subject.subjectCode);
      console.log('   Subject Name:', subject.subjectName);
      console.log('   Program:', subject.program);
      console.log('   Year Level:', subject.yearLevel);
      console.log('   Semester:', subject.semester);
      console.log('\n   ℹ️  To join this subject, the student needs the CLASS CODE, not the subject code!');
      console.log('   Looking for ClassSpaces with this subject...\n');

      // Find ClassSpaces for this subject
      const classSpaces = await ClassSpace.find({ subject: subject._id, isActive: true })
        .populate('section', 'sectionCode program yearLevel');
      
      if (classSpaces.length > 0) {
        console.log(`   ✅ Found ${classSpaces.length} active class(es) for this subject:`);
        classSpaces.forEach(cs => {
          console.log(`      Class Code: ${cs.classCode} (Section: ${cs.section?.sectionCode})`);
        });
      } else {
        console.log('   ❌ No active classes found for this subject yet.');
        console.log('   → The schedule needs to be created and activated first!');
      }
    } else {
      console.log('❌ NOT found as Subject code');
    }

    // List some valid codes
    console.log('\n📋 Sample valid codes:');
    console.log('\n--- Section Enrollment Codes (for regular students) ---');
    const sections = await Section.find({ isActive: true }).limit(5).select('sectionCode enrollmentCode program yearLevel');
    sections.forEach(s => {
      console.log(`   ${s.enrollmentCode} → ${s.sectionCode} (${s.program} Year ${s.yearLevel})`);
    });

    console.log('\n--- Class Codes (for irregular students) ---');
    const classes = await ClassSpace.find({ isActive: true })
      .limit(5)
      .populate('subject', 'subjectCode')
      .select('classCode subject');
    classes.forEach(c => {
      console.log(`   ${c.classCode} → ${c.subject?.subjectCode}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkCode();
