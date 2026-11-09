const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Second Year Subjects Data
const secondYearSubjects = [
  // ============== 1ST SEMESTER ==============
  {
    subjectCode: 'GEC-E',
    subjectName: 'Ethics',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Ethics'
  },
  {
    subjectCode: 'GEE-ES',
    subjectName: 'Environmental Science',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Elective Course - Environmental Science'
  },
  {
    subjectCode: 'GEC-LWR',
    subjectName: 'Life and Works of Rizal',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Rizal'
  },
  {
    subjectCode: 'CC 212',
    subjectName: 'Quantitative Methods (Modeling & Simulation)',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Quantitative Methods'
  },
  {
    subjectCode: 'CC 214',
    subjectName: 'Data Structures and Algorithms (Lec)',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Data Structures and Algorithms Lecture'
  },
  {
    subjectCode: 'CC 214 L',
    subjectName: 'Data Structures and Algorithms (Lab)',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 3,
    lectureHours: 0,
    labHours: 9,
    description: 'Core Course - Data Structures and Algorithms Laboratory'
  },
  {
    subjectCode: 'CC 213',
    subjectName: 'Object-Oriented Programming',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Object-Oriented Programming'
  },
  {
    subjectCode: 'IT Elec 1',
    subjectName: 'Web Systems and Technologies',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'IT Elective 1 - Web Systems'
  },
  {
    subjectCode: 'IT Elec 2',
    subjectName: 'Web Systems and Technologies (Lab)',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 0,
    lectureHours: 0,
    labHours: 0,
    description: 'IT Elective 2 - Continuation'
  },
  {
    subjectCode: 'PATHFR 3',
    subjectName: 'Physical Activities Towards Health and Fitness 3 - Dance/Sports/Martial Arts/Group Exercise/Outdoor and Adventure Activities',
    program: 'BSIT',
    yearLevel: 2,
    semester: 1,
    units: 2,
    lectureHours: 0,
    labHours: 2,
    description: 'PE Course - Dance/Sports/Martial Arts'
  },

  // ============== 2ND SEMESTER ==============
  {
    subjectCode: 'GEC-TCW',
    subjectName: 'The Contemporary World',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Contemporary World'
  },
  {
    subjectCode: 'CC 223',
    subjectName: 'Integrative Programming and Technologies 1',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Core Course - Integrative Programming'
  },
  {
    subjectCode: 'CC 224',
    subjectName: 'Networking 1',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Core Course - Networking 1'
  },
  {
    subjectCode: 'CC 225',
    subjectName: 'Information Management (Lec)',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Information Management Lecture'
  },
  {
    subjectCode: 'CC 225 L',
    subjectName: 'Information Management (Lab)',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 3,
    lectureHours: 0,
    labHours: 9,
    description: 'Core Course - Information Management Laboratory'
  },
  {
    subjectCode: 'IT Elec 3',
    subjectName: 'Platform Technologies',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'IT Elective 3 - Platform Technologies'
  },
  {
    subjectCode: 'AP 3',
    subjectName: 'ASP.NET',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Application Course - ASP.NET'
  },
  {
    subjectCode: 'PATHFR 4',
    subjectName: 'Physical Activities Towards Health and Fitness 4 - Dance/Sports/Martial Arts/Group Exercise/Outdoor and Adventure Activities',
    program: 'BSIT',
    yearLevel: 2,
    semester: 2,
    units: 2,
    lectureHours: 0,
    labHours: 2,
    description: 'PE Course - Dance/Sports/Martial Arts'
  }
];

async function addSecondYearSubjects() {
  try {
    console.log('Starting to add second year subjects...');

    // Clear existing second year BSIT subjects
    const deleteResult = await Subject.deleteMany({ 
      program: 'BSIT', 
      yearLevel: 2 
    });
    console.log(`Cleared ${deleteResult.deletedCount} existing second year BSIT subjects`);

    // Insert new subjects
    const result = await Subject.insertMany(secondYearSubjects);
    console.log(`Successfully added ${result.length} second year subjects!`);

    // Show summary
    const sem1Count = result.filter(s => s.semester === 1).length;
    const sem2Count = result.filter(s => s.semester === 2).length;
    
    const sem1Units = result.filter(s => s.semester === 1).reduce((sum, s) => sum + s.units, 0);
    const sem2Units = result.filter(s => s.semester === 2).reduce((sum, s) => sum + s.units, 0);
    
    console.log(`\nSummary:`);
    console.log(`- 1st Semester: ${sem1Count} subjects (${sem1Units} units)`);
    console.log(`- 2nd Semester: ${sem2Count} subjects (${sem2Units} units)`);
    console.log(`- Total: ${result.length} subjects`);

    // Display subjects by semester
    console.log('\n=== 2ND YEAR - 1ST SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 1).forEach(subject => {
      const hours = subject.lectureHours + subject.labHours;
      console.log(`${subject.subjectCode.padEnd(15)} - ${subject.subjectName.substring(0, 50).padEnd(50)} (${subject.units} units, ${hours}hrs)`);
    });

    console.log('\n=== 2ND YEAR - 2ND SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 2).forEach(subject => {
      const hours = subject.lectureHours + subject.labHours;
      console.log(`${subject.subjectCode.padEnd(15)} - ${subject.subjectName.substring(0, 50).padEnd(50)} (${subject.units} units, ${hours}hrs)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error adding subjects:', error);
    process.exit(1);
  }
}

// Run the script
addSecondYearSubjects();
