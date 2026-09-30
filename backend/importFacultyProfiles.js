const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();
require('./config/database')();

const Faculty = require('./models/Faculty.model');
const User = require('./models/User.model');

async function importFacultyProfiles() {
  try {
    console.log('📚 Reading Faculty Profiles Excel file...\n');
    
    // Read the Excel file
    const filePath = path.join(__dirname, '..', 'FacultyProfiles.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the range and extract headers from row 2 (0-indexed row 1)
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Read headers from row 2
    const headers = {};
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerCell = worksheet[XLSX.utils.encode_cell({ r: 1, c: C })];
      if (headerCell && headerCell.v) {
        headers[C] = headerCell.v;
      }
    }
    
    console.log('📋 Headers found:', Object.values(headers).join(', '));
    console.log('\n');
    
    // Read data starting from row 3 (0-indexed row 2)
    const facultyData = [];
    for (let R = 2; R <= range.e.r; R++) {
      const row = {};
      let hasData = false;
      
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        const header = headers[C];
        if (header && cell && cell.v) {
          row[header] = String(cell.v).trim();
          hasData = true;
        }
      }
      
      // Only add rows that have a faculty name
      if (hasData && row.FACULTY) {
        facultyData.push(row);
      }
    }
    
    console.log(`✅ Found ${facultyData.length} faculty members in Excel\n`);
    
    // Process and update each faculty member
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    
    for (const data of facultyData) {
      try {
        const facultyName = data.FACULTY;
        const aka = data.AKA;
        
        // Try to find the faculty member by name
        // Split name and try to match
        const nameParts = facultyName.replace(/Prof\.|Dr\./gi, '').trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        
        // Find user by name
        const user = await User.findOne({
          $or: [
            { firstName: new RegExp(firstName, 'i'), lastName: new RegExp(lastName, 'i') },
            { email: new RegExp(aka.replace(',', '').replace(' ', ''), 'i') }
          ],
          role: 'faculty'
        });
        
        if (!user) {
          console.log(`⚠️  Faculty not found: ${facultyName} (${aka})`);
          notFound++;
          continue;
        }
        
        // Find faculty profile
        const faculty = await Faculty.findOne({ user: user._id });
        
        if (!faculty) {
          console.log(`⚠️  Faculty profile not found for user: ${facultyName}`);
          notFound++;
          continue;
        }
        
        // Update faculty profile with Excel data
        const updateData = {};
        
        // Bachelor's Degree
        if (data['BS Degree'] || data.MAJOR1 || data.MINOR1) {
          updateData.bachelorsDegree = {
            degree: data['BS Degree'] || '',
            major: data.MAJOR1 || '',
            minor: data.MINOR1 || ''
          };
        }
        
        // Master's Degree
        if (data['Master Degree'] || data.MAJOR2 || data.MINOR2) {
          updateData.mastersDegree = {
            degree: data['Master Degree'] || '',
            major: data.MAJOR2 || '',
            minor: data.MINOR2 || ''
          };
        }
        
        // Doctoral Degree
        if (data['Doctoral Degree'] || data.MAJOR3 || data.MINOR3) {
          updateData.doctoralDegree = {
            degree: data['Doctoral Degree'] || '',
            major: data.MAJOR3 || '',
            minor: data.MINOR3 || ''
          };
        }
        
        // Additional information
        if (data['SPECIAL TRAINING']) {
          updateData.specialTraining = data['SPECIAL TRAINING'];
        }
        
        if (data['ADMINISTRATIVE DESIGNATION']) {
          updateData.administrativeDesignation = data['ADMINISTRATIVE DESIGNATION'];
        }
        
        if (data.RESEARCH) {
          updateData.researchInvolvement = data.RESEARCH;
        }
        
        if (data.EXTENSION) {
          updateData.extensionInvolvement = data.EXTENSION;
        }
        
        if (data.PRODUCTION) {
          updateData.productionInvolvement = data.PRODUCTION;
        }
        
        // Update employment type based on STATUS
        if (data.STATUS) {
          if (data.STATUS.toLowerCase().includes('part')) {
            updateData.employmentType = 'Part-time';
          } else if (data.STATUS.toLowerCase().includes('organic')) {
            updateData.employmentType = 'Regular';
          }
        }
        
        // Update faculty
        await Faculty.findByIdAndUpdate(faculty._id, updateData);
        
        console.log(`✅ Updated: ${facultyName}`);
        updated++;
        
      } catch (error) {
        console.log(`❌ Error processing ${data.FACULTY}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Not Found: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total in Excel: ${facultyData.length}`);
    console.log('='.repeat(50));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importFacultyProfiles();
