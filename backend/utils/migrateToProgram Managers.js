/**
 * Migration Script: Scheduling Officers to Program Managers
 * 
 * This script helps transition existing scheduling_officer users to the new
 * program_manager role with assigned programs.
 * 
 * Usage:
 *   node backend/utils/migrateToProgramManagers.js
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// Import models
const User = require('../models/User.model');
const { getProgramCodes } = require('./programValidator');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

// Populated from the database once connected (see models/Program.model.js)
let programs = [];

async function migrateToProgramManagers() {
  try {
    // Connect to database
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    programs = await getProgramCodes(true);
    if (programs.length === 0) {
      console.error('❌ No active programs found. Run `node seedPrograms.js` first.');
      process.exit(1);
    }
    console.log(`📚 Loaded ${programs.length} programs: ${programs.join(', ')}\n`);

    // Find all scheduling officers
    const schedulingOfficers = await User.find({ role: 'scheduling_officer' });

    if (schedulingOfficers.length === 0) {
      console.log('✅ No scheduling officers found. Migration not needed.\n');
      process.exit(0);
    }

    console.log(`📋 Found ${schedulingOfficers.length} scheduling officer(s):\n`);

    // List all scheduling officers
    schedulingOfficers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Current program: ${user.program || 'Not assigned'}\n`);
    });

    console.log('\n📌 Available Programs:');
    programs.forEach((prog, index) => {
      console.log(`${index + 1}. ${prog}`);
    });
    console.log('8. Keep as scheduling_officer (skip migration)\n');

    // Process each scheduling officer
    for (const user of schedulingOfficers) {
      console.log(`\n--- Processing: ${user.firstName} ${user.lastName} ---`);
      
      const choice = await question(
        `Assign program to ${user.email}?\n` +
        `Enter number (1-7 for program, 8 to skip): `
      );

      const choiceNum = parseInt(choice);

      if (choiceNum >= 1 && choiceNum <= 7) {
        const selectedProgram = programs[choiceNum - 1];
        
        // Update user to program_manager with assigned program
        user.role = 'program_manager';
        user.program = selectedProgram;
        await user.save();

        console.log(`✅ Migrated to: program_manager (${selectedProgram})`);
      } else if (choiceNum === 8) {
        console.log(`⏭️  Skipped - keeping as scheduling_officer`);
      } else {
        console.log(`❌ Invalid choice - keeping as scheduling_officer`);
      }
    }

    console.log('\n✅ Migration complete!\n');

    // Display summary
    const programManagers = await User.find({ role: 'program_manager' });
    const remainingOfficers = await User.find({ role: 'scheduling_officer' });

    console.log('📊 Migration Summary:');
    console.log(`   Program Managers: ${programManagers.length}`);
    programManagers.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName}: ${user.program}`);
    });
    
    if (remainingOfficers.length > 0) {
      console.log(`\n   Remaining Scheduling Officers: ${remainingOfficers.length}`);
      remainingOfficers.forEach(user => {
        console.log(`   - ${user.firstName} ${user.lastName}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run migration
console.log('🚀 Starting Migration: Scheduling Officers → Program Managers\n');
/**
 * Run deliberately, never on import.
 *
 * This file used to call itself at the bottom, so anything that merely
 * required it - a test sweep, an editor's auto-import, a careless
 * `require` in another module - connected to whatever MONGODB_URI happened
 * to be set and wrote to that database. Guarding on require.main means it
 * only runs when it is the file node was asked to execute.
 */
if (require.main === module) {
  migrateToProgramManagers();
}
