/**
 * Add Test Students for Each Program
 * This creates sample students to test program-specific access control
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Student = require('../models/Student.model');

const testStudents = [
  // BSIT Students
  { studentId: 'BSIT-2021-001', firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.bsit@test.com', program: 'BSIT', yearLevel: 3, section: 'A' },
  { studentId: 'BSIT-2021-002', firstName: 'Maria', lastName: 'Santos', email: 'maria.bsit@test.com', program: 'BSIT', yearLevel: 3, section: 'A' },
  { studentId: 'BSIT-2022-001', firstName: 'Pedro', lastName: 'Garcia', email: 'pedro.bsit@test.com', program: 'BSIT', yearLevel: 2, section: 'B' },
  
  // BSHM Students
  { studentId: 'BSHM-2021-001', firstName: 'Ana', lastName: 'Reyes', email: 'ana.bshm@test.com', program: 'BSHM', yearLevel: 3, section: 'A' },
  { studentId: 'BSHM-2021-002', firstName: 'Carlos', lastName: 'Torres', email: 'carlos.bshm@test.com', program: 'BSHM', yearLevel: 3, section: 'A' },
  
  // BIT-ET Students
  { studentId: 'BITET-2021-001', firstName: 'Luis', lastName: 'Mendoza', email: 'luis.bitet@test.com', program: 'BIT-ET', yearLevel: 2, section: 'A' },
  { studentId: 'BITET-2022-001', firstName: 'Rosa', lastName: 'Flores', email: 'rosa.bitet@test.com', program: 'BIT-ET', yearLevel: 1, section: 'A' },
  
  // BIT-CT Students
  { studentId: 'BITCT-2021-001', firstName: 'Miguel', lastName: 'Ramos', email: 'miguel.bitct@test.com', program: 'BIT-CT', yearLevel: 2, section: 'A' },
  
  // BSIE Students
  { studentId: 'BSIE-2021-001', firstName: 'Sofia', lastName: 'Cruz', email: 'sofia.bsie@test.com', program: 'BSIE', yearLevel: 3, section: 'A' },
  { studentId: 'BSIE-2022-001', lastName: 'Diego', firstName: 'Fernandez', email: 'diego.bsie@test.com', program: 'BSIE', yearLevel: 2, section: 'A' },
];

const addTestStudents = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');
    
    console.log('👥 Creating test students...\n');
    
    let created = 0;
    let skipped = 0;
    
    for (const studentData of testStudents) {
      try {
        // Check if student already exists
        const existingStudent = await Student.findOne({ studentId: studentData.studentId });
        if (existingStudent) {
          console.log(`⏭️  Skipped: ${studentData.studentId} (already exists)`);
          skipped++;
          continue;
        }
        
        // Create user account
        const user = await User.create({
          email: studentData.email,
          password: 'student123', // Default password
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          role: 'student',
          studentId: studentData.studentId,
          program: studentData.program,
          yearLevel: studentData.yearLevel,
          section: studentData.section
        });
        
        // Create student profile
        await Student.create({
          user: user._id,
          studentId: studentData.studentId,
          program: studentData.program,
          yearLevel: studentData.yearLevel,
          section: studentData.section,
          studentType: 'regular',
          academicYear: '2024-2025',
          semester: 2,
          enrollmentStatus: 'enrolled'
        });
        
        console.log(`✅ Created: ${studentData.studentId} - ${studentData.firstName} ${studentData.lastName} (${studentData.program})`);
        created++;
        
      } catch (error) {
        console.error(`❌ Failed: ${studentData.studentId} - ${error.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`\n🎉 Done! You can now view students in the UI.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed.');
    process.exit(0);
  }
};

addTestStudents();
