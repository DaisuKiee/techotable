const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import all models
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Faculty = require('../models/Faculty.model');
const Schedule = require('../models/Schedule.model');
const Section = require('../models/Section.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const ClassSpace = require('../models/ClassSpace.model');

async function addIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('Creating indexes...\n');

    // Create indexes for all models
    const models = [
      { name: 'User', model: User },
      { name: 'Student', model: Student },
      { name: 'Faculty', model: Faculty },
      { name: 'Schedule', model: Schedule },
      { name: 'Section', model: Section },
      { name: 'Subject', model: Subject },
      { name: 'Room', model: Room },
      { name: 'ClassSpace', model: ClassSpace }
    ];

    for (const { name, model } of models) {
      try {
        console.log(`📝 Creating indexes for ${name}...`);
        await model.createIndexes();
        console.log(`✅ ${name} indexes created`);
      } catch (error) {
        console.error(`❌ Error creating ${name} indexes:`, error.message);
      }
    }

    console.log('\n✅ All indexes processed successfully');
    console.log('\n📊 To view indexes in MongoDB:');
    console.log('   db.collection.getIndexes()');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addIndexes();
