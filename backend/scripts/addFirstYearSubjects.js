const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// First Year Subjects Data
const firstYearSubjects = [
  // ============== 1ST SEMESTER ==============
  {
    subjectCode: 'GEC-RPH',
    subjectName: 'Readings in Philippine History',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Philippine History'
  },
  {
    subjectCode: 'GEC-MMW',
    subjectName: 'Mathematics in the Modern World',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Mathematics'
  },
  {
    subjectCode: 'GEE-TEM',
    subjectName: 'The Entrepreneurial Mind',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'General Elective Course - Entrepreneurship'
  },
  {
    subjectCode: 'CC 111',
    subjectName: 'Introduction to Computing',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 3,
    description: 'Core Course - Introduction to Computing with Lab'
  },
  {
    subjectCode: 'CC 112',
    subjectName: 'Computer Programming 1 (Lec)',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Computer Programming 1 Lecture'
  },
  {
    subjectCode: 'CC 112 L',
    subjectName: 'Computer Programming 1 (Lab)',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 1,
    lectureHours: 0,
    labHours: 3,
    description: 'Core Course - Computer Programming 1 Laboratory'
  },
  {
    subjectCode: 'CC 113',
    subjectName: 'Multimedia',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'Core Course - Multimedia'
  },
  {
    subjectCode: 'PATHFR 1',
    subjectName: 'Physical Activities Towards Health and Fitness 1 - Movement Competency Training',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 3,
    lectureHours: 0,
    labHours: 3,
    description: 'PE Course - Movement and Fitness Training'
  },
  {
    subjectCode: 'NSTP 1',
    subjectName: 'National Service Training Program 1 (CWTS 1/LTS 1/ROTC 1)',
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'NSTP - Civic Welfare/Literacy/Reserve Officers Training'
  },

  // ============== 2ND SEMESTER ==============
  {
    subjectCode: 'GEC-PC',
    subjectName: 'Purposive Communication',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Communication'
  },
  {
    subjectCode: 'GEC-STS',
    subjectName: 'Science, Technology and Society',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Science and Technology'
  },
  {
    subjectCode: 'GEC-US',
    subjectName: 'Understanding the Self',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'General Education Course - Self Understanding'
  },
  {
    subjectCode: 'GEE-GSPS',
    subjectName: 'Gender and Society with Peace Studies',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 2,
    lectureHours: 2,
    labHours: 0,
    description: 'General Elective - Gender Studies and Peace'
  },
  {
    subjectCode: 'CC 121',
    subjectName: 'Computer Programming 2 (Lec)',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Computer Programming 2 Lecture'
  },
  {
    subjectCode: 'CC 123 L',
    subjectName: 'Computer Programming 2 (Lab)',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 0,
    labHours: 9,
    description: 'Core Course - Computer Programming 2 Laboratory'
  },
  {
    subjectCode: 'CC 121 / MATH-E2',
    subjectName: 'Discrete Mathematics',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Discrete Mathematics'
  },
  {
    subjectCode: 'CC 122',
    subjectName: 'Digital Logic Design',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'Core Course - Digital Logic Design'
  },
  {
    subjectCode: 'PATHFR 2',
    subjectName: 'Physical Activities Towards Health and Fitness 2 - Exercise-based Fitness Activities',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 2,
    lectureHours: 0,
    labHours: 2,
    description: 'PE Course - Exercise and Fitness Activities'
  },
  {
    subjectCode: 'NSTP 2',
    subjectName: 'National Service Training Program 2 (CWTS 2/LTS 2/ROTC 2)',
    program: 'BSIT',
    yearLevel: 1,
    semester: 2,
    units: 3,
    lectureHours: 3,
    labHours: 0,
    description: 'NSTP - Civic Welfare/Literacy/Reserve Officers Training'
  }
];

async function addFirstYearSubjects() {
  try {
    console.log('Starting to add first year subjects...');

    // Clear existing first year BSIT subjects
    const deleteResult = await Subject.deleteMany({ 
      program: 'BSIT', 
      yearLevel: 1 
    });
    console.log(`Cleared ${deleteResult.deletedCount} existing first year BSIT subjects`);

    // Insert new subjects
    const result = await Subject.insertMany(firstYearSubjects);
    console.log(`Successfully added ${result.length} first year subjects!`);

    // Show summary
    const sem1Count = result.filter(s => s.semester === 1).length;
    const sem2Count = result.filter(s => s.semester === 2).length;
    console.log(`\nSummary:`);
    console.log(`- 1st Semester: ${sem1Count} subjects`);
    console.log(`- 2nd Semester: ${sem2Count} subjects`);
    console.log(`- Total: ${result.length} subjects`);

    // Display subjects by semester
    console.log('\n=== 1ST SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 1).forEach(subject => {
      console.log(`${subject.subjectCode} - ${subject.subjectName} (${subject.units} units)`);
    });

    console.log('\n=== 2ND SEMESTER SUBJECTS ===');
    result.filter(s => s.semester === 2).forEach(subject => {
      console.log(`${subject.subjectCode} - ${subject.subjectName} (${subject.units} units)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error adding subjects:', error);
    process.exit(1);
  }
}

// Run the script
addFirstYearSubjects();
