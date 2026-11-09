const mongoose = require('mongoose');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const { getProgramCodes } = require('../utils/programValidator');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const createFacultyData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Programs come from the database (see models/Program.model.js)
    const programs = await getProgramCodes(true);
    if (programs.length === 0) {
      console.error('No active programs found. Run `node scripts/seedPrograms.js` first.');
      process.exit(1);
    }
    console.log(`Loaded ${programs.length} programs: ${programs.join(', ')}`);
    
    // Specializations for each program
    const specializationsByProgram = {
      BSIT: [
        'Programming', 'Web Development', 'Database Management', 
        'Systems Analysis', 'Networking', 'Mobile Development',
        'Software Engineering', 'IT Project Management'
      ],
      BSHM: [
        'Hotel Management', 'Food and Beverage Service', 'Culinary Arts',
        'Tourism Management', 'Restaurant Management', 'Event Management',
        'Hospitality Operations', 'Customer Service'
      ],
      'BIT-ET': [
        'Electronics Technology', 'Circuit Design', 'Microcontrollers',
        'Digital Electronics', 'Industrial Electronics', 'Instrumentation',
        'Electronic Maintenance', 'PCB Design'
      ],
      'BIT-CT': [
        'Computer Hardware', 'System Administration', 'Technical Support',
        'Computer Maintenance', 'Network Configuration', 'PC Assembly',
        'Hardware Troubleshooting', 'System Integration'
      ],
      'BIT-AT': [
        'Automotive Technology', 'Engine Repair', 'Vehicle Diagnostics',
        'Automotive Electronics', 'Transmission Systems', 'Brake Systems',
        'Vehicle Maintenance', 'Auto Body Repair'
      ],
      BSFI: [
        'Aquaculture', 'Fish Processing', 'Marine Biology',
        'Fisheries Management', 'Aquatic Ecosystems', 'Fish Breeding',
        'Coastal Resource Management', 'Fisheries Economics'
      ],
      BSIE: [
        'Industrial Engineering', 'Production Planning', 'Quality Control',
        'Operations Management', 'Manufacturing Systems', 'Ergonomics',
        'Supply Chain Management', 'Process Improvement'
      ]
    };

    // Positions to rotate through
    const positions = ['Professor', 'Associate Professor', 'Assistant Professor', 'Instructor'];

    // Clear existing faculty data
    console.log('\nClearing existing faculty data...');
    const existingFaculty = await Faculty.find().populate('user');
    for (const fac of existingFaculty) {
      if (fac.user) {
        await User.findByIdAndDelete(fac.user._id);
      }
      await Faculty.findByIdAndDelete(fac._id);
    }
    console.log('✓ Existing faculty data cleared');

    let totalCreated = 0;
    
    // Create 10 faculty members for each program
    for (const program of programs) {
      console.log(`\n--- Creating faculty for ${program} ---`);
      
      for (let i = 1; i <= 10; i++) {
        const programSafe = program.replace(/-/g, ''); // Remove hyphens for names
        const firstName = `Teach-${programSafe}`;
        const lastName = `${i}`;
        const email = `teach-${program.toLowerCase()}-${i}@ctu.edu.ph`;
        const employeeId = `FAC-${program}-${String(i).padStart(3, '0')}`;
        
        // Create user account
        const userDoc = await User.create({
          email: email,
          password: 'faculty123',
          role: 'faculty',
          firstName: firstName,
          lastName: lastName,
          isActive: true
        });

        // Randomly select 2-4 specializations for this faculty
        const specs = specializationsByProgram[program];
        const numSpecs = Math.floor(Math.random() * 3) + 2; // 2 to 4 specializations
        const shuffled = [...specs].sort(() => 0.5 - Math.random());
        const selectedSpecs = shuffled.slice(0, numSpecs);

        // Rotate through positions
        const position = positions[i % positions.length];

        // Random max load between 18-40 hours
        const maxLoad = [18, 21, 24, 27, 30][Math.floor(Math.random() * 5)];

        // Determine field of study based on program
        let field = 'Computer Science';
        if (program === 'BSHM') field = 'Hospitality Management';
        else if (program === 'BIT-ET') field = 'Electronics Technology';
        else if (program === 'BIT-CT') field = 'Computer Technology';
        else if (program === 'BIT-AT') field = 'Automotive Technology';
        else if (program === 'BSFI') field = 'Fisheries';
        else if (program === 'BSIE') field = 'Industrial Engineering';

        // Create faculty profile
        const facultyDoc = await Faculty.create({
          user: userDoc._id,
          employeeId: employeeId,
          department: 'CoTE',
          position: position,
          qualifications: [
            {
              degree: ['BS', 'MS', 'PhD'][Math.floor(Math.random() * 3)],
              field: field,
              institution: 'Cebu Technological University',
              yearObtained: 2010 + Math.floor(Math.random() * 14) // 2010-2023
            }
          ],
          specializations: selectedSpecs,
          // Each seeded faculty is qualified for the one program they belong to.
          // Without this, program-filtered faculty lists come back empty.
          programs: [program],
          maxTeachingLoad: maxLoad,
          currentLoad: 0,
          isActive: true
        });

        // Link faculty profile to user
        userDoc.facultyProfile = facultyDoc._id;
        await userDoc.save();

        console.log(`  ✓ Created: ${firstName} ${lastName} (${employeeId}) - ${selectedSpecs.slice(0, 2).join(', ')}${selectedSpecs.length > 2 ? '...' : ''}`);
        totalCreated++;
      }
    }

    console.log('\n=== Faculty Data Created Successfully ===');
    console.log(`Total faculty created: ${totalCreated} (${programs.length} programs × 10 faculty)`);
    console.log('\nFaculty accounts (all use password: faculty123):');
    for (const program of programs) {
      console.log(`\n${program}:`);
      for (let i = 1; i <= 3; i++) { // Show first 3 as examples
        console.log(`  teach-${program.toLowerCase()}-${i}@ctu.edu.ph`);
      }
      console.log(`  ... (up to teach-${program.toLowerCase()}-10@ctu.edu.ph)`);
    }
    console.log('\n=========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('Error creating faculty data:', error);
    process.exit(1);
  }
};

// Run the function
createFacultyData();
