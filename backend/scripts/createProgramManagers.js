/**
 * Create Program Managers for Each Program
 * 
 * This creates 7 program manager accounts, one for each program:
 * BSIT, BSHM, BIT-ET, BIT-CT, BIT-AT, BSFI, BSIE
 * 
 * Each manager can ONLY manage schedules for their assigned program.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');

const programManagers = [
  {
    email: 'bsit.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BSIT',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BSIT'
  },
  {
    email: 'bshm.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BSHM',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BSHM'
  },
  {
    email: 'bitet.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BIT-ET',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BIT-ET'
  },
  {
    email: 'bitct.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BIT-CT',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BIT-CT'
  },
  {
    email: 'bitat.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BIT-AT',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BIT-AT'
  },
  {
    email: 'bsfi.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BSFI',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BSFI'
  },
  {
    email: 'bsie.manager@ctu.edu.ph',
    password: 'manager123',
    firstName: 'BSIE',
    lastName: 'Manager',
    role: 'program_manager',
    program: 'BSIE'
  }
];

const createProgramManagers = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');
    
    console.log('👥 Creating Program Managers...\n');
    console.log('═══════════════════════════════════════════════════════\n');
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const managerData of programManagers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: managerData.email });
        
        if (existingUser) {
          // Update existing user to program_manager role
          if (existingUser.role !== 'program_manager' || existingUser.program !== managerData.program) {
            existingUser.role = 'program_manager';
            existingUser.program = managerData.program;
            existingUser.firstName = managerData.firstName;
            existingUser.lastName = managerData.lastName;
            await existingUser.save();
            console.log(`🔄 Updated: ${managerData.email}`);
            console.log(`   Role: ${existingUser.role}`);
            console.log(`   Program: ${existingUser.program}`);
            console.log(`   Name: ${existingUser.firstName} ${existingUser.lastName}\n`);
            created++;
          } else {
            console.log(`⏭️  Skipped: ${managerData.email} (already exists as program manager)\n`);
            skipped++;
          }
          continue;
        }
        
        // Create new program manager
        const user = await User.create({
          email: managerData.email,
          password: managerData.password,
          firstName: managerData.firstName,
          lastName: managerData.lastName,
          role: 'program_manager',
          program: managerData.program,
          isActive: true
        });
        
        console.log(`✅ Created: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Program: ${user.program}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Password: ${managerData.password}\n`);
        
        created++;
        
      } catch (error) {
        console.error(`❌ Failed: ${managerData.email}`);
        console.error(`   Error: ${error.message}\n`);
        errors++;
      }
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Created/Updated: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${programManagers.length}\n`);
    
    if (created > 0) {
      console.log('🎉 Program Managers Ready!\n');
      console.log('📋 Login Credentials:');
      console.log('═══════════════════════════════════════════════════════');
      programManagers.forEach(m => {
        console.log(`\n${m.program} Manager:`);
        console.log(`  Email: ${m.email}`);
        console.log(`  Password: ${m.password}`);
        console.log(`  Can manage: ${m.program} schedules only`);
      });
      console.log('\n═══════════════════════════════════════════════════════\n');
      
      console.log('🧪 Testing Instructions:');
      console.log('1. Login with any program manager account');
      console.log('2. Go to Schedules page');
      console.log('3. Try to create a schedule');
      console.log('4. Notice the program field is auto-set and read-only');
      console.log('5. Try to access another program\'s schedule → Access Denied!\n');
      
      console.log('💡 Next Steps:');
      console.log('1. Test each program manager login');
      console.log('2. Verify they can only see their program\'s data');
      console.log('3. Test creating schedules (program auto-assigned)');
      console.log('4. Test access denied when trying to view other programs\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.\n');
    process.exit(0);
  }
};

// Run the script
console.log('\n🚀 Creating Program Managers for CTU Daan Bantayan\n');
createProgramManagers();
