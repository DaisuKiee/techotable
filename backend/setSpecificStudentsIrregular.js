require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/student.model');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function setIrregular() {
  try {
    console.log('\n=== Set Students as Irregular ===\n');
    console.log('Which students would you like to set as irregular?');
    console.log('1. Set ALL students with NOT SET student type as irregular');
    console.log('2. Set a specific student by email');
    console.log('3. Set a specific student by student ID');
    console.log('4. Exit\n');
    
    rl.question('Enter your choice (1-4): ', async (choice) => {
      try {
        if (choice === '1') {
          const result = await Student.updateMany(
            { studentType: { $in: [null, undefined, ''] } },
            { $set: { studentType: 'irregular' } }
          );
          console.log(`\n✅ Updated ${result.modifiedCount} students to irregular`);
        } else if (choice === '2') {
          const students = await Student.find({ studentType: { $in: [null, undefined, ''] } })
            .populate('user', 'email');
          
          console.log('\nStudents with NOT SET type:');
          students.forEach((s, idx) => {
            console.log(`${idx + 1}. ${s.user?.email || 'N/A'} (${s.studentId})`);
          });
          
          rl.question('\nEnter student email: ', async (email) => {
            const student = await Student.findOne().populate('user');
            const match = await Student.findOne().populate({
              path: 'user',
              match: { email: email.trim() }
            });
            
            if (!match || !match.user) {
              console.log('❌ Student not found');
            } else {
              match.studentType = 'irregular';
              await match.save();
              console.log(`✅ Set ${email} as irregular`);
            }
            
            await mongoose.connection.close();
            rl.close();
          });
          return;
        } else if (choice === '3') {
          rl.question('\nEnter student ID: ', async (studentId) => {
            const student = await Student.findOne({ studentId: studentId.trim() })
              .populate('user', 'email');
            
            if (!student) {
              console.log('❌ Student not found');
            } else {
              student.studentType = 'irregular';
              await student.save();
              console.log(`✅ Set ${student.user?.email || studentId} as irregular`);
            }
            
            await mongoose.connection.close();
            rl.close();
          });
          return;
        } else {
          console.log('Exiting...');
        }
        
        await mongoose.connection.close();
        rl.close();
      } catch (error) {
        console.error('Error:', error);
        await mongoose.connection.close();
        rl.close();
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    rl.close();
  }
}

setIrregular();
