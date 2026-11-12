const mongoose = require('mongoose');
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Faculty.deleteMany({});
    await Subject.deleteMany({});
    await Room.deleteMany({});
    console.log('Cleared existing data');

    // Create Admin User
    const admin = await User.create({
      email: 'admin@ctu.edu.ph',
      password: 'admin123',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      isActive: true
    });
    console.log('✓ Admin user created');

    // Create Scheduling Officer
    const schedulingOfficer = await User.create({
      email: 'scheduler@ctu.edu.ph',
      password: 'scheduler123',
      role: 'scheduling_officer',
      firstName: 'Maria',
      lastName: 'Santos',
      isActive: true
    });
    console.log('✓ Scheduling officer created');

    // Create Faculty Users
    const faculty1User = await User.create({
      email: 'jsmith@ctu.edu.ph',
      password: 'faculty123',
      role: 'faculty',
      firstName: 'John',
      lastName: 'Smith',
      isActive: true
    });

    const faculty2User = await User.create({
      email: 'mjohnson@ctu.edu.ph',
      password: 'faculty123',
      role: 'faculty',
      firstName: 'Mary',
      lastName: 'Johnson',
      isActive: true
    });

    const faculty3User = await User.create({
      email: 'rgarcia@ctu.edu.ph',
      password: 'faculty123',
      role: 'faculty',
      firstName: 'Robert',
      lastName: 'Garcia',
      isActive: true
    });

    console.log('✓ Faculty users created');

    // Create Faculty Profiles
    const faculty1 = await Faculty.create({
      user: faculty1User._id,
      employeeId: 'FAC-2024-001',
      department: 'CoTE',
      position: 'Associate Professor',
      qualifications: [
        {
          degree: 'PhD',
          field: 'Computer Science',
          institution: 'University of the Philippines',
          yearObtained: 2018
        },
        {
          degree: 'MS',
          field: 'Information Technology',
          institution: 'Cebu Institute of Technology',
          yearObtained: 2012
        }
      ],
      specializations: ['Programming', 'Data Structures', 'Algorithms'],
      maxTeachingLoad: 24,
      currentLoad: 0
    });

    const faculty2 = await Faculty.create({
      user: faculty2User._id,
      employeeId: 'FAC-2024-002',
      department: 'CoTE',
      position: 'Assistant Professor',
      qualifications: [
        {
          degree: 'MS',
          field: 'Computer Engineering',
          institution: 'Cebu Technological University',
          yearObtained: 2019
        }
      ],
      specializations: ['Database Management', 'Web Development', 'Systems Analysis'],
      maxTeachingLoad: 24,
      currentLoad: 0
    });

    const faculty3 = await Faculty.create({
      user: faculty3User._id,
      employeeId: 'FAC-2024-003',
      department: 'CoTE',
      position: 'Instructor',
      qualifications: [
        {
          degree: 'BS',
          field: 'Information Technology',
          institution: 'Cebu Technological University',
          yearObtained: 2020
        }
      ],
      specializations: ['Networking', 'Cybersecurity', 'System Administration'],
      maxTeachingLoad: 24,
      currentLoad: 0
    });

    // Link faculty profiles to users
    faculty1User.facultyProfile = faculty1._id;
    await faculty1User.save();

    faculty2User.facultyProfile = faculty2._id;
    await faculty2User.save();

    faculty3User.facultyProfile = faculty3._id;
    await faculty3User.save();

    console.log('✓ Faculty profiles created and linked');

    // Create Student User
    const student = await User.create({
      email: 'student@ctu.edu.ph',
      password: 'student123',
      role: 'student',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      isActive: true
    });
    console.log('✓ Student user created');

    // Create Sample Subjects
    const subjects = await Subject.create([
      // BSIT Year 1 Semester 1
      {
        subjectCode: 'IT101',
        subjectName: 'Introduction to Computing',
        description: 'Fundamentals of computing and information technology',
        units: 3,
        lectureHours: 3,
        labHours: 0,
        program: 'BSIT',
        yearLevel: 1,
        semester: 1,
        requiredQualifications: ['Computer Science', 'Information Technology']
      },
      {
        subjectCode: 'IT102',
        subjectName: 'Computer Programming 1',
        description: 'Introduction to programming using C++',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BSIT',
        yearLevel: 1,
        semester: 1,
        requiredQualifications: ['Computer Science', 'Programming']
      },
      {
        subjectCode: 'MATH101',
        subjectName: 'College Algebra',
        description: 'Fundamental concepts in algebra',
        units: 3,
        lectureHours: 3,
        labHours: 0,
        program: 'BSIT',
        yearLevel: 1,
        semester: 1,
        requiredQualifications: ['Mathematics']
      },
      // BSIT Year 1 Semester 2
      {
        subjectCode: 'IT103',
        subjectName: 'Computer Programming 2',
        description: 'Object-oriented programming concepts',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BSIT',
        yearLevel: 1,
        semester: 2,
        prerequisites: [],
        requiredQualifications: ['Computer Science', 'Programming']
      },
      {
        subjectCode: 'IT104',
        subjectName: 'Data Structures and Algorithms',
        description: 'Fundamental data structures and algorithm design',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BSIT',
        yearLevel: 1,
        semester: 2,
        requiredQualifications: ['Computer Science', 'Algorithms']
      },
      // BSIT Year 2 Semester 1
      {
        subjectCode: 'IT201',
        subjectName: 'Database Management Systems',
        description: 'Design and implementation of database systems',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BSIT',
        yearLevel: 2,
        semester: 1,
        requiredQualifications: ['Database Management', 'Information Technology']
      },
      {
        subjectCode: 'IT202',
        subjectName: 'Web Development',
        description: 'Frontend and backend web technologies',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BSIT',
        yearLevel: 2,
        semester: 1,
        requiredQualifications: ['Web Development', 'Programming']
      },
      // BSHM Subjects
      {
        subjectCode: 'HM101',
        subjectName: 'Introduction to Hospitality Management',
        description: 'Overview of hospitality industry',
        units: 3,
        lectureHours: 3,
        labHours: 0,
        program: 'BSHM',
        yearLevel: 1,
        semester: 1,
        requiredQualifications: ['Hospitality Management']
      },
      {
        subjectCode: 'HM102',
        subjectName: 'Food and Beverage Service',
        description: 'Service techniques and procedures',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BSHM',
        yearLevel: 1,
        semester: 1,
        requiredQualifications: ['Hospitality Management']
      },
      // BIT-ET Subjects
      {
        subjectCode: 'ET101',
        subjectName: 'Basic Electronics',
        description: 'Fundamentals of electronic components and circuits',
        units: 3,
        lectureHours: 2,
        labHours: 3,
        program: 'BIT-ET',
        yearLevel: 1,
        semester: 1,
        requiredQualifications: ['Electronics Technology', 'Engineering']
      }
    ]);

    // Link prerequisites
    const it102 = subjects.find(s => s.subjectCode === 'IT102');
    const it103 = subjects.find(s => s.subjectCode === 'IT103');
    if (it102 && it103) {
      it103.prerequisites = [it102._id];
      await it103.save();
    }

    console.log('✓ Sample subjects created');

    // Create Sample Rooms
    await Room.create([
      // Computer Labs
      {
        roomCode: 'CL-101',
        roomName: 'Computer Laboratory 1',
        building: 'Engineering Building',
        floor: 1,
        roomType: 'Computer Lab',
        capacity: 40,
        facilities: ['Computers', 'Internet Access', 'Whiteboard', 'Projector'],
        equipment: [
          { name: 'Desktop Computer', quantity: 40, condition: 'Good' },
          { name: 'Projector', quantity: 1, condition: 'Excellent' }
        ],
        isAirconditioned: true,
        hasProjector: true,
        hasWhiteboard: true
      },
      {
        roomCode: 'CL-102',
        roomName: 'Computer Laboratory 2',
        building: 'Engineering Building',
        floor: 1,
        roomType: 'Computer Lab',
        capacity: 40,
        facilities: ['Computers', 'Internet Access', 'Whiteboard', 'Projector'],
        isAirconditioned: true,
        hasProjector: true,
        hasWhiteboard: true
      },
      // Lecture Rooms
      {
        roomCode: 'LR-201',
        roomName: 'Lecture Room 201',
        building: 'Engineering Building',
        floor: 2,
        roomType: 'Lecture Room',
        capacity: 50,
        facilities: ['Whiteboard', 'Projector', 'Sound System'],
        equipment: [
          { name: 'Projector', quantity: 1, condition: 'Good' },
          { name: 'Whiteboard', quantity: 2, condition: 'Good' }
        ],
        isAirconditioned: true,
        hasProjector: true,
        hasWhiteboard: true
      },
      {
        roomCode: 'LR-202',
        roomName: 'Lecture Room 202',
        building: 'Engineering Building',
        floor: 2,
        roomType: 'Lecture Room',
        capacity: 45,
        facilities: ['Whiteboard', 'Projector'],
        isAirconditioned: false,
        hasProjector: true,
        hasWhiteboard: true
      },
      // Electronics Laboratory
      {
        roomCode: 'EL-301',
        roomName: 'Electronics Laboratory',
        building: 'Engineering Building',
        floor: 3,
        roomType: 'Laboratory',
        capacity: 30,
        facilities: ['Workbenches', 'Oscilloscopes', 'Power Supplies', 'Whiteboard'],
        equipment: [
          { name: 'Oscilloscope', quantity: 15, condition: 'Good' },
          { name: 'Power Supply', quantity: 15, condition: 'Good' },
          { name: 'Multimeter', quantity: 30, condition: 'Good' }
        ],
        isAirconditioned: true,
        hasProjector: false,
        hasWhiteboard: true
      },
      // Workshop
      {
        roomCode: 'WS-101',
        roomName: 'Automotive Workshop',
        building: 'Workshop Building',
        floor: 1,
        roomType: 'Workshop',
        capacity: 25,
        facilities: ['Tool Storage', 'Work Areas', 'Vehicle Lifts'],
        equipment: [
          { name: 'Vehicle Lift', quantity: 2, condition: 'Good' },
          { name: 'Tool Set', quantity: 15, condition: 'Fair' }
        ],
        isAirconditioned: false,
        hasProjector: false,
        hasWhiteboard: true
      },
      // Auditorium
      {
        roomCode: 'AUD-001',
        roomName: 'Main Auditorium',
        building: 'Main Building',
        floor: 1,
        roomType: 'Auditorium',
        capacity: 150,
        facilities: ['Stage', 'Sound System', 'Lighting', 'Projector', 'Microphones'],
        equipment: [
          { name: 'Projector', quantity: 2, condition: 'Excellent' },
          { name: 'Wireless Microphone', quantity: 4, condition: 'Good' },
          { name: 'Speaker System', quantity: 8, condition: 'Good' }
        ],
        isAirconditioned: true,
        hasProjector: true,
        hasWhiteboard: false
      }
    ]);

    console.log('✓ Sample rooms created');

    console.log('\n=== Seed Data Created Successfully ===');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@ctu.edu.ph / admin123');
    console.log('Scheduling Officer: scheduler@ctu.edu.ph / scheduler123');
    console.log('Faculty 1: jsmith@ctu.edu.ph / faculty123');
    console.log('Faculty 2: mjohnson@ctu.edu.ph / faculty123');
    console.log('Faculty 3: rgarcia@ctu.edu.ph / faculty123');
    console.log('Student: student@ctu.edu.ph / student123');
    console.log('=====================================\n');

    process.exit(0);

  } catch (error) {
    console.error('Seed data error:', error);
    process.exit(1);
  }
};

// Run the seed function
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
  seedData();
}
