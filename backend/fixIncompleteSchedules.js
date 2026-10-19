const mongoose = require('mongoose');
require('dotenv').config();
const Schedule = require('./models/Schedule.model');
const Subject = require('./models/Subject.model');
const Section = require('./models/Section.model');

async function fixIncompleteSchedules() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find schedules with missing critical fields
    const incompleteSchedules = await Schedule.find({
      $or: [
        { section: null },
        { section: { $exists: false } },
        { day: null },
        { day: { $exists: false } },
        { startTime: null },
        { startTime: { $exists: false } },
        { endTime: null },
        { endTime: { $exists: false } }
      ]
    }).populate('subject', 'subjectCode subjectName');

    console.log(`\n📊 Found ${incompleteSchedules.length} incomplete schedules:\n`);

    if (incompleteSchedules.length === 0) {
      console.log('✅ No incomplete schedules found!');
      process.exit(0);
    }

    incompleteSchedules.forEach((schedule, index) => {
      console.log(`${index + 1}. Schedule ID: ${schedule._id}`);
      console.log(`   Subject: ${schedule.subject?.subjectCode || 'Unknown'} - ${schedule.subject?.subjectName || 'Unknown'}`);
      console.log(`   Section: ${schedule.section || 'NULL'}`);
      console.log(`   Day: ${schedule.day !== undefined ? schedule.day : 'NULL'}`);
      console.log(`   Time: ${schedule.startTime || 'NULL'} - ${schedule.endTime || 'NULL'}`);
      console.log(`   Room: ${schedule.room || 'NULL'}`);
      console.log('');
    });

    // Ask if user wants to delete these
    console.log('\n⚠️  These schedules are incomplete and should be deleted.');
    console.log('   Run this script with --delete flag to remove them:');
    console.log('   node fixIncompleteSchedules.js --delete\n');

    if (process.argv.includes('--delete')) {
      const ids = incompleteSchedules.map(s => s._id);
      const result = await Schedule.deleteMany({ _id: { $in: ids } });
      console.log(`\n✅ Deleted ${result.deletedCount} incomplete schedules`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIncompleteSchedules();
