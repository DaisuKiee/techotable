require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');

async function verifyAllUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    // Update all users to be verified
    const result = await User.updateMany(
      { isEmailVerified: { $ne: true } },
      { 
        $set: { 
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null
        } 
      }
    );
    
    console.log('✅ All users verified!');
    console.log(`Updated ${result.modifiedCount} users\n`);
    
    // Show all users
    const users = await User.find({}).select('email firstName lastName role isEmailVerified');
    
    console.log('═══════════════════════════════════════════');
    console.log('           ALL USERS STATUS');
    console.log('═══════════════════════════════════════════\n');
    
    users.forEach(user => {
      console.log(`${user.isEmailVerified ? '✅' : '❌'} ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Verified: ${user.isEmailVerified}\n`);
    });
    
    console.log('═══════════════════════════════════════════');
    console.log(`Total users: ${users.length}`);
    console.log('═══════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAllUsers();
