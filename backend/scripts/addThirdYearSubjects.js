const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Third Year Subjects Data
const thirdYearSubjects = [
  // ============== 1ST SEMESTER ==============
  {
    subjectCode: 'GEE-FE',
    subjectName: 'Functional English',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Elective Course - Functional English'
  },
  {
    subjectCode: 'CC 315',
    subjectName: 'Networking 2 (Lec)',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Networking 2 Lecture'
  },
  {
    subjectCode: 'CC 315 L',
    subjectName: 'Networking 2 (Lab)',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 3,
    lectureHours: 0,
    labHours: 9,
    description: 'Core Course - Networking 2 Laboratory'
  },
  {
    subjectCode: 'CC 316',
    subjectName: 'Systems Integration and Architecture 1',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Core Course - Systems Integration and Architecture 1'
  },
  {
    subjectCode: 'CC 317',
    subjectName: 'Introduction to Human Computer Interaction',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Core Course - Human Computer Interaction'
  },
  {
    subjectCode: 'CC 3180',
    subjectName: 'Business Management Systems',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Core Course - Business Management Systems'
  },
  {
    subjectCode: 'CC 31 CC 316',
    subjectName: 'Applications Development and Emerging Technologies',
    program: 'BSIT',
    yearLevel: 3,
    semester: 1,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Core Course - Applications Development and Emerging Technologies'
  },

  // ============== 2ND SEMESTER ==============
  {
    subjectCode: 'GEC-AA',
    subjectName: 'Art Appreciation',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Art Appreciation'
  },
  {
    subjectCode: 'GEE-PEE',
    subjectName: "People and the Earth's Ecosystems",
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: "General Elective Course - Earth's Ecosystems"
  },
  {
    subjectCode: 'CC 3200',
    subjectName: 'Capstone Project and Research 1',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Capstone Project and Research 1'
  },
  {
    subjectCode: 'CC 3210',
    subjectName: 'Social and Professional Issues',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Social and Professional Issues'
  },
  {
    subjectCode: 'CC 3211',
    subjectName: 'Information Assurance and Security 1 (Lec)',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Information Assurance and Security 1 Lecture'
  },
  {
    subjectCode: 'CC 3211 L',
    subjectName: 'Information Assurance and Security 1 (Lab)',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 0,
    labHours: 9,
    description: 'Core Course - Information Assurance and Security 1 Laboratory'
  },
  {
    subjectCode: 'AP 4',
    subjectName: 'iOS Mobile Application Development Cross-Platform',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Application Course - iOS Mobile Development'
  },
  {
    subjectCode: 'AP 5',
    subjectName: 'Technology and the Application of Internet of Things',
    program: 'BSIT',
    yearLevel: 3,
    semester: 2,
    units: 3,
    lectureHours: 2,
    labHours: 3,
    description: 'Application Course - Internet of Things'
  }
];

async function addThirdYearSubjects() {
  try {
    console.log('Starting to add third year subjects...');

    // Clear existing third year BSIT subjects
    const deleteResult = await Subject.deleteMany({ 
      program: 'BSIT', 
      yearLevel: 3 
    });
    console.log(`Cleared ${deleteResult.deletedCount} existing third year BSIT subjects`);

    // Insert new subjects
    const result = await Subject.insertMany(thirdYearSubjects);
    console.log(`Successfully added ${result.length} third year subjects!`);

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
    console.log('\n=== 3RD YEAR - 1ST SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 1).forEach(subject => {
      const hours = subject.lectureHours + subject.labHours;
      console.log(`${subject.subjectCode.padEnd(20)} - ${subject.subjectName.substring(0, 45).padEnd(45)} (${subject.units} units, ${hours}hrs)`);
    });

    console.log('\n=== 3RD YEAR - 2ND SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 2).forEach(subject => {
      const hours = subject.lectureHours + subject.labHours;
      console.log(`${subject.subjectCode.padEnd(20)} - ${subject.subjectName.substring(0, 45).padEnd(45)} (${subject.units} units, ${hours}hrs)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error adding subjects:', error);
    process.exit(1);
  }
}

// Run the script
addThirdYearSubjects();
