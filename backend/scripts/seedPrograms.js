require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Program = require('../models/Program.model');

const programs = [
  {
    code: 'BSIT',
    name: 'Bachelor of Science in Information Technology',
    description: 'A four-year program that equips students with the knowledge and skills in designing, implementing, and managing information technology systems.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  },
  {
    code: 'BSHM',
    name: 'Bachelor of Science in Hospitality Management',
    description: 'A four-year program that prepares students for careers in the hospitality and tourism industry.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  },
  {
    code: 'BIT-ET',
    name: 'Bachelor of Industrial Technology - Electronics Technology',
    description: 'A four-year program focused on electronics systems, circuits, and technology.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  },
  {
    code: 'BIT-CT',
    name: 'Bachelor of Industrial Technology - Computer Technology',
    description: 'A four-year program focused on computer hardware, networking, and systems technology.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  },
  {
    code: 'BIT-AT',
    name: 'Bachelor of Industrial Technology - Automotive Technology',
    description: 'A four-year program focused on automotive systems, maintenance, and repair.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  },
  {
    code: 'BSFI',
    name: 'Bachelor of Science in Fisheries',
    description: 'A four-year program focused on fisheries science, aquaculture, and marine resource management.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  },
  {
    code: 'BSIE',
    name: 'Bachelor of Science in Industrial Engineering',
    description: 'A four-year program focused on optimization of complex processes, systems, and organizations.',
    department: 'CoTE',
    duration: 4,
    isActive: true
  }
];

async function seedPrograms() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing programs
    await Program.deleteMany({});
    console.log('🗑️  Cleared existing programs\n');

    // Insert programs
    console.log('📝 Seeding programs...\n');
    for (const prog of programs) {
      const created = await Program.create(prog);
      console.log(`✅ Created: ${created.code} - ${created.name}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Successfully seeded 7 programs!');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedPrograms();
