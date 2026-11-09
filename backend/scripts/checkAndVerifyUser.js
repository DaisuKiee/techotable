require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');

const email = process.argv[2] || 'elixirdevelopmentbot@gmail.com';

async function checkAndVerify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found with email:', email);
      console.log('\nMake sure the email is correct or sign up first.');
      process.exit(1);
    }
    
    console.log('═══════════════════════════════════════════');
    console.log('           USER STATUS CHECK');
    console.log('═══════════════════════════════════════════\n');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.firstName, user.lastName);
    console.log('🎓 Student ID:', user.studentId);
    console.log('📚 Program:', user.program);
    console.log('📅 Year:', user.yearLevel);
    console.log('🏷️  Role:', user.role);
    console.log('\n───────────────────────────────────────────');
    console.log('          VERIFICATION STATUS');
    console.log('───────────────────────────────────────────\n');
    
    if (user.isEmailVerified) {
      console.log('✅ EMAIL VERIFIED: YES');
      console.log('🔓 Account Status: ACTIVE');
      console.log('\n═══════════════════════════════════════════');
      console.log('   ✨ This account is ready to use! ✨');
      console.log('═══════════════════════════════════════════\n');
      console.log('You can login at: http://localhost:3000/login');
      console.log('Email:', user.email);
      console.log('Password: (the password you used during signup)\n');
    } else {
      console.log('❌ EMAIL VERIFIED: NO');
      console.log('🔒 Account Status: PENDING VERIFICATION');
      console.log('📅 Token Expires:', user.emailVerificationExpires);
      console.log('\n═══════════════════════════════════════════');
      console.log('      🔧 MANUAL VERIFICATION');
      console.log('═══════════════════════════════════════════\n');
      console.log('Verifying user now...\n');
      
      // Verify the user
      user.isEmailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();
      
      console.log('✅ USER VERIFIED SUCCESSFULLY!\n');
      console.log('═══════════════════════════════════════════');
      console.log('   ✨ Account is now active! ✨');
      console.log('═══════════════════════════════════════════\n');
      console.log('You can now login at: http://localhost:3000/login');
      console.log('Email:', user.email);
      console.log('Password: (the password you used during signup)\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('\n');
checkAndVerify();
