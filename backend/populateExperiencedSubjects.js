require('dotenv').config();
const mongoose = require('mongoose');
const Faculty = require('./models/Faculty.model');
const connectDB = require('./config/database');

const populateExperiencedSubjects = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    const faculties = await Faculty.find({});
    console.log(`Found ${faculties.length} faculty members`);

    let updated = 0;

    for (const faculty of faculties) {
      if (faculty.teachingHistory && faculty.teachingHistory.length > 0) {
        // Count frequency of each subject
        const subjectFrequency = {};
        
        faculty.teachingHistory.forEach(history => {
          if (history.subjectCode) {
            if (!subjectFrequency[history.subjectCode]) {
              subjectFrequency[history.subjectCode] = {
                count: 0,
                subjectName: history.subjectName
              };
            }
            subjectFrequency[history.subjectCode].count++;
          }
        });

        // Convert to experiencedSubjects array, sorted by frequency
        const experiencedSubjects = Object.entries(subjectFrequency)
          .sort((a, b) => b[1].count - a[1].count) // Sort by count descending
          .slice(0, 5) // Take top 5
          .map(([subjectCode, data]) => ({
            subjectCode: subjectCode,
            frequency: `${data.count}x`,
            period: data.count === 1 ? 'once' : 
                    data.count <= 3 ? 'recently' : 
                    'frequently'
          }));

        if (experiencedSubjects.length > 0) {
          faculty.experiencedSubjects = experiencedSubjects;
          await faculty.save();
          updated++;
          console.log(`✓ Updated ${faculty.user}: ${experiencedSubjects.length} experienced subjects`);
        }
      }
    }

    console.log(`\n✓ Successfully updated ${updated} faculty members`);
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

populateExperiencedSubjects();
