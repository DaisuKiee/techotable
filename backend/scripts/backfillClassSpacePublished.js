/**
 * One-off: set ClassSpace.isPublished from each space's schedule status.
 * Teachers and students only see published classes; spaces created before the
 * flag existed have no value, which would hide every class.
 *
 * Usage: node scripts/backfillClassSpacePublished.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const spaces = await db.collection('classspaces').find({}, { projection: { schedule: 1, isPublished: 1 } }).toArray();
  const schedules = new Map((await db.collection('schedules')
    .find({ _id: { $in: spaces.map((s) => s.schedule) } }, { projection: { status: 1 } }).toArray())
    .map((s) => [String(s._id), s.status]));

  let published = 0;
  let hidden = 0;
  for (const space of spaces) {
    const status = schedules.get(String(space.schedule));
    const isPublished = !!status && status !== 'draft';
    if (space.isPublished !== isPublished) {
      await db.collection('classspaces').updateOne({ _id: space._id }, { $set: { isPublished } });
    }
    if (isPublished) published++; else hidden++;
  }
  console.log(`${spaces.length} class spaces: ${published} visible (published/archived), ${hidden} draft-only`);
  await mongoose.disconnect();
})();
