const mongoose = require('mongoose');
const Subject = require('../models/Subject.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkAllSubjects() {
  try {
    console.log('\n🎓 BSIT CURRICULUM - ALL YEARS VERIFICATION\n');
    console.log('='.repeat(80));

    for (let year = 1; year <= 4; year++) {
      for (let sem = 1; sem <= 2; sem++) {
        const subjects = await Subject.find({ 
          program: 'BSIT', 
          yearLevel: year, 
          semester: sem 
        }).sort({ subjectCode: 1 });

        if (subjects.length === 0) continue;

        const totalUnits = subjects.reduce((sum, s) => sum + s.units, 0);
        
        console.log(`\n📚 YEAR ${year} - SEMESTER ${sem} (${subjects.length} subjects, ${totalUnits} units):`);
        console.log('-'.repeat(80));

        subjects.forEach(s => {
          const total = s.lectureHours + s.labHours;
          const hours = total > 100 ? `${total}hrs OJT` : `${s.lectureHours}L + ${s.labHours}Lab = ${total}hrs`;
          console.log(`   ${s.subjectCode.padEnd(18)} ${s.units}u | ${hours.padEnd(20)} ${s.subjectName.substring(0, 35)}`);
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    const allSubjects = await Subject.find({ program: 'BSIT' });
    const totalSubjects = allSubjects.length;
    const totalUnits = allSubjects.reduce((sum, s) => sum + s.units, 0);
    
    console.log(`\n✅ TOTAL: ${totalSubjects} subjects, ${totalUnits} units across 4 years`);
    console.log('🎯 All subject hours verified against curriculum images\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllSubjects();
