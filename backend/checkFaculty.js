require('dotenv').config();
require('./config/database')();

const Faculty = require('./models/Faculty.model');
const User = require('./models/User.model');

async function check() {
  const count = await Faculty.countDocuments();
  const users = await User.find({ role: 'faculty' }).limit(10);
  
  console.log('Faculty count:', count);
  console.log('\nSample faculty users:');
  users.forEach(u => {
    console.log(`  - ${u.firstName} ${u.lastName} (${u.email})`);
  });
  
  process.exit(0);
}

setTimeout(check, 1000);
