const mongoose = require('mongoose');
const Schedule = require('../models/Schedule.model');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function activateSchedules() {
  try {
    const result = await Schedule.updateMany(
      { isActive: false },
      { $set: { isActive: true } }
    );

    console.log(`✅ Updated ${result.modifiedCount} schedules to active status`);

    const activeCount = await Schedule.countDocuments({ isActive: true });
    console.log(`📊 Total active schedules: ${activeCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateSchedules();
