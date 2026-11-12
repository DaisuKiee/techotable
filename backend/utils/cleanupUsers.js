const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cleanupUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Remove studentProfile field from all users
    const result = await mongoose.connection.db.collection('users').updateMany(
      {},
      { $unset: { studentProfile: "" } }
    );

    console.log(`✓ Updated ${result.modifiedCount} users`);
    console.log('✓ Cleanup complete');

    process.exit(0);
  } catch (error) {
    console.error('✗ Cleanup error:', error);
    process.exit(1);
  }
};

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
  cleanupUsers();
}
