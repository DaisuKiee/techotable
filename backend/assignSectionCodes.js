const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Student = require('./models/Student.model');

/**
 * Assign section codes to students who don't have one
 * This extracts the year level from the studentId and assigns a default section
 */

async function assignSectionCodes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');
    
    console.log('🔍 Finding students without section codes...');
    const studentsWithoutSection = await Student.find({ sectionCode: null });
    console.log(`Found ${studentsWithoutSection.length} students without section codes\n`);
    
    if (studentsWithoutSection.length === 0) {
      console.log('✅ All students already have section codes!');
      process.exit(0);
    }
    
    let updated = 0;
    let failed = 0;
    
    for (const student of studentsWithoutSection) {
      try {
        // Extract year from studentId (e.g., "BSIT-2021-001" -> year 4 in 2024-2025)
        // OR from numeric ID (8230612 -> check admission year)
        let yearLevel = null;
        let sectionLetter = 'A'; // Default section
        
        if (student.studentId.includes('-')) {
          // Format: "PROGRAM-YEAR-NUMBER"
          const parts = student.studentId.split('-');
          if (parts.length >= 2) {
            const admissionYear = parseInt(parts[1]);
            if (!isNaN(admissionYear)) {
              // Calculate current year level (assuming academic year 2024-2025)
              yearLevel = 2025 - admissionYear;
              if (yearLevel < 1) yearLevel = 1;
              if (yearLevel > 4) yearLevel = 4;
            }
          }
        } else {
          // Numeric ID - default to year 1 or check other fields
          yearLevel = 1; // Default for students with numeric IDs
        }
        
        if (yearLevel) {
          const sectionCode = `${student.program}-${yearLevel}${sectionLetter}`;
          
          await Student.findByIdAndUpdate(student._id, { 
            sectionCode: sectionCode 
          });
          
          console.log(`✅ ${student.studentId}: ${student.program} → ${sectionCode}`);
          updated++;
        } else {
          console.log(`⚠️  ${student.studentId}: Could not determine year level`);
          failed++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${student.studentId}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Total: ${studentsWithoutSection.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignSectionCodes();
