const mongoose = require('mongoose');
const Faculty = require('../models/Faculty.model');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function resetFacultyLoads() {
  try {
    const result = await Faculty.updateMany(
      {},
      { $set: { currentLoad: 0 } }
    );

    console.log(`✅ Reset ${result.modifiedCount} faculty members' teaching loads to 0`);

    const faculty = await Faculty.find({}).populate('user', 'firstName lastName');
    console.log('\n👨‍🏫 Faculty Load Status:');
    faculty.forEach(f => {
      console.log(`   ${f.user?.firstName} ${f.user?.lastName}: ${f.currentLoad}/${f.maxTeachingLoad} units`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetFacultyLoads();
