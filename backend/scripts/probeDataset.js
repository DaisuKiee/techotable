// Read-only survey of the live dataset, for the Appendix G benchmark.
require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../models/Program.model');
const Section = require('../models/Section.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const programs = await Program.find({ isActive: true }).select('code name').lean();
  console.log('Active programs:', programs.map(p => p.code).join(', '));

  const terms = await Section.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { ay: '$academicYear', sem: '$semester' }, sections: { $sum: 1 } } },
    { $sort: { sections: -1 } },
  ]);
  console.log('\nTerms with active sections:');
  for (const t of terms) console.log(`  ${t._id.ay} sem ${t._id.sem}: ${t.sections} sections`);

  console.log('\nPer program (active sections / subjects / faculty):');
  for (const p of programs) {
    const [secs, subs, facs] = await Promise.all([
      Section.find({ program: p.code, isActive: true }).select('sectionCode yearLevel sectionLetter shift academicYear semester').lean(),
      Subject.countDocuments({ program: p.code, isActive: true }),
      Faculty.countDocuments({ programs: p.code, isActive: true }),
    ]);
    const byTerm = {};
    for (const s of secs) {
      const k = `${s.academicYear}|${s.semester}`;
      byTerm[k] = (byTerm[k] || 0) + 1;
    }
    console.log(`  ${p.code.padEnd(8)} sections=${String(secs.length).padStart(3)}  subjects=${String(subs).padStart(3)}  faculty=${String(facs).padStart(3)}  terms=${JSON.stringify(byTerm)}`);
  }

  console.log('\nRooms:', await Room.countDocuments({ isActive: true }), 'active');
  console.log('Faculty total active:', await Faculty.countDocuments({ isActive: true }));
  console.log('Schedules:', await Schedule.countDocuments({ isActive: true }), 'active,',
    await Schedule.countDocuments({ isActive: true, status: 'published' }), 'published');

  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
