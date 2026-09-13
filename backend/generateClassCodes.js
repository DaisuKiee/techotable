/**
 * Generate enrollment codes for all ClassSpaces that don't have one
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ClassSpace = require('./models/ClassSpace.model');

const generateClassCodes = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Find all class spaces without a class code
    const spacesWithoutCodes = await ClassSpace.find({
      $or: [
        { classCode: { $exists: false } },
        { classCode: null },
        { classCode: '' }
      ]
    })
    .populate('subject', 'subjectCode subjectName')
    .populate('faculty', 'employeeId');

    console.log(`📊 Found ${spacesWithoutCodes.length} class spaces without codes\n`);

    if (spacesWithoutCodes.length === 0) {
      console.log('✅ All class spaces already have enrollment codes!');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;

    for (const space of spacesWithoutCodes) {
      try {
        // Generate unique code
        const classCode = await ClassSpace.generateUniqueClassCode();
        space.classCode = classCode;
        await space.save();

        console.log(`✅ ${space.subject?.subjectCode || space.sectionCode} → ${classCode}`);
        updated++;
      } catch (error) {
        console.error(`❌ Failed for ${space.subject?.subjectCode || space.sectionCode}:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Generated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total: ${spacesWithoutCodes.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

generateClassCodes();
