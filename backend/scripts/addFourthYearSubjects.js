const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Fourth Year Subjects Data
const fourthYearSubjects = [
  // ============== 1ST SEMESTER ==============
  {
    subjectCode: 'CC 4112',
    subjectName: 'Information Assurance and Security 2 (Lec)',
    program: 'BSIT',
    yearLevel: 4,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Information Assurance and Security 2 Lecture'
  },
  {
    subjectCode: 'CC 4112 L',
    subjectName: 'Information Assurance and Security 2 (Lab)',
    program: 'BSIT',
    yearLevel: 4,
    semester: 1,
    units: 3,
    lectureHours: 0,
    labHours: 9,
    description: 'Core Course - Information Assurance and Security 2 Laboratory'
  },
  {
    subjectCode: 'CC 4113',
    subjectName: 'Systems Administration and Maintenance',
    program: 'BSIT',
    yearLevel: 4,
    semester: 1,
    units: 3,
    lectureHours: 4,
    labHours: 3,
    description: 'Core Course - Systems Administration and Maintenance'
  },
  {
    subjectCode: 'CC 4114',
    subjectName: 'Capstone Project and Research 2',
    program: 'BSIT',
    yearLevel: 4,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Capstone Project and Research 2'
  },
  {
    subjectCode: 'IT Elec 4',
    subjectName: 'Systems Integration and Architecture 2',
    program: 'BSIT',
    yearLevel: 4,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'IT Elective 4 - Systems Integration and Architecture 2'
  },
  {
    subjectCode: 'AP 6',
    subjectName: 'Cross-Platform Script Development Technology',
    program: 'BSIT',
    yearLevel: 4,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Application Course - Cross-Platform Development'
  },

  // ============== 2ND SEMESTER ==============
  {
    subjectCode: 'CC 4215',
    subjectName: 'On-the-Job Training (OJT)',
    program: 'BSIT',
    yearLevel: 4,
    semester: 2,
    units: 9,
    lectureHours: 0,
    labHours: 0,
    description: 'On-the-Job Training / Practicum - 720 hours total'
  }
];

async function addFourthYearSubjects() {
  try {
    console.log('Starting to add fourth year subjects...');

    // Clear existing fourth year BSIT subjects
    const deleteResult = await Subject.deleteMany({ 
      program: 'BSIT', 
      yearLevel: 4 
    });
    console.log(`Cleared ${deleteResult.deletedCount} existing fourth year BSIT subjects`);

    // Insert new subjects
    const result = await Subject.insertMany(fourthYearSubjects);
    console.log(`Successfully added ${result.length} fourth year subjects!`);

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
    console.log('\n=== 4TH YEAR - 1ST SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 1).forEach(subject => {
      const hours = subject.lectureHours + subject.labHours;
      console.log(`${subject.subjectCode.padEnd(20)} - ${subject.subjectName.substring(0, 45).padEnd(45)} (${subject.units} units, ${hours}hrs)`);
    });

    console.log('\n=== 4TH YEAR - 2ND SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 2).forEach(subject => {
      const hours = subject.lectureHours + subject.labHours;
      const hourDisplay = hours > 0 ? `${hours}hrs` : '720hrs practicum';
      console.log(`${subject.subjectCode.padEnd(20)} - ${subject.subjectName.substring(0, 45).padEnd(45)} (${subject.units} units, ${hourDisplay})`);
    });

    console.log('\n✅ All BSIT subjects (Years 1-4) are now in the database!');
    console.log('📚 Ready for schedule generation and academic planning.');

    process.exit(0);
  } catch (error) {
    console.error('Error adding subjects:', error);
    process.exit(1);
  }
}

// Run the script
addFourthYearSubjects();
