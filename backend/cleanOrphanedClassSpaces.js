/**
 * Clean Orphaned ClassSpaces
 * 
 * Removes or deactivates ClassSpaces that reference deleted schedules
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ClassSpace = require('./models/ClassSpace.model');
const Schedule = require('./models/Schedule.model');

const cleanOrphanedClassSpaces = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all ClassSpaces
    const allClassSpaces = await ClassSpace.find({}).populate('schedule');
    console.log(`📊 Found ${allClassSpaces.length} total ClassSpaces`);

    let orphanedCount = 0;
    let deletedCount = 0;

    for (const classSpace of allClassSpaces) {
      // Check if schedule exists
      if (!classSpace.schedule) {
        console.log(`❌ Orphaned ClassSpace found: ${classSpace._id}`);
        console.log(`   Section: ${classSpace.sectionCode}`);
        console.log(`   Subject: ${classSpace.subject}`);
        console.log(`   Schedule ID: ${classSpace.schedule} (DELETED)`);
        
        orphanedCount++;

        // Delete the orphaned ClassSpace
        await ClassSpace.findByIdAndDelete(classSpace._id);
        deletedCount++;
        console.log(`   ✅ Deleted orphaned ClassSpace`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total ClassSpaces: ${allClassSpaces.length}`);
    console.log(`   Orphaned ClassSpaces: ${orphanedCount}`);
    console.log(`   Deleted: ${deletedCount}`);

    if (orphanedCount === 0) {
      console.log('   ✅ No orphaned ClassSpaces found!');
    } else {
      console.log(`   ✅ Cleaned up ${deletedCount} orphaned ClassSpaces`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

cleanOrphanedClassSpaces();
