/**
 * Link Faculty profiles to their User accounts
 * Fixes the issue where faculty have schedules but dashboard shows "No faculty profile linked"
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Faculty = require('./models/Faculty.model');
const User = require('./models/User.model');

const linkFacultyProfiles = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all faculty profiles
    const faculties = await Faculty.find().populate('user', 'email role facultyProfile');

    console.log(`\n📋 Found ${faculties.length} faculty profiles`);
    console.log('=====================================\n');

    let linked = 0;
    let alreadyLinked = 0;
    let errors = 0;

    for (const faculty of faculties) {
      if (!faculty.user) {
        console.log(`❌ Faculty ${faculty.employeeId} has no user account`);
        errors++;
        continue;
      }

      const user = await User.findById(faculty.user._id);
      
      if (!user) {
        console.log(`❌ User not found for faculty ${faculty.employeeId}`);
        errors++;
        continue;
      }

      // Check if already linked
      if (user.facultyProfile && user.facultyProfile.toString() === faculty._id.toString()) {
        console.log(`✓ Already linked: ${user.firstName} ${user.lastName} (${user.email})`);
        alreadyLinked++;
        continue;
      }

      // Link faculty profile to user
      user.facultyProfile = faculty._id;
      await user.save();
      
      console.log(`✅ Linked: ${user.firstName} ${user.lastName} (${user.email}) → Faculty ${faculty.employeeId}`);
      linked++;
    }

    console.log('\n=====================================');
    console.log('📊 Summary:');
    console.log(`   ✅ Newly linked: ${linked}`);
    console.log(`   ✓ Already linked: ${alreadyLinked}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total: ${faculties.length}`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
};

linkFacultyProfiles();
