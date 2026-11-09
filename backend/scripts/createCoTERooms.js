const mongoose = require('mongoose');
const Room = require('../models/Room.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create 30 rooms in CoTE Building
const coTERooms = [];

for (let i = 1; i <= 30; i++) {
  const roomNumber = i.toString().padStart(2, '0'); // 01, 02, 03, etc.
  const isComputerLab = i > 25; // Last 5 rooms are computer labs
  
  coTERooms.push({
    roomCode: `COTE-${roomNumber}`,
    roomName: `CoTE Building Room ${i}`,
    building: 'CoTE Building',
    floor: Math.ceil(i / 10), // Distribute across 3 floors (1-10: floor 1, 11-20: floor 2, 21-30: floor 3)
    capacity: i <= 10 ? 40 : i <= 20 ? 35 : 30, // Vary capacity slightly
    roomType: isComputerLab ? 'Computer Lab' : 'Lecture Room',
    facilities: isComputerLab 
      ? ['Computers', 'Projector', 'Whiteboard', 'Air Conditioning', 'Network Access']
      : ['Projector', 'Whiteboard', 'Air Conditioning', 'Speaker System'],
    isAirconditioned: true,
    hasProjector: true,
    hasWhiteboard: true,
    isActive: true,
    notes: isComputerLab 
      ? `Computer laboratory with ${30} workstations in CoTE Building, Floor ${Math.ceil(i / 10)}`
      : `Standard lecture room in CoTE Building, Floor ${Math.ceil(i / 10)}`
  });
}

async function createCoTERooms() {
  try {
    console.log('Starting room data reset and creation...\n');

    // Step 1: Delete all existing rooms
    const deleteResult = await Room.deleteMany({});
    console.log(`✅ Cleared ${deleteResult.deletedCount} existing rooms from database`);

    // Step 2: Insert new CoTE Building rooms
    const result = await Room.insertMany(coTERooms);
    console.log(`✅ Successfully created ${result.length} rooms in CoTE Building!\n`);

    // Show summary by floor and type
    const floor1 = result.filter(r => r.floor === 1);
    const floor2 = result.filter(r => r.floor === 2);
    const floor3 = result.filter(r => r.floor === 3);
    const lectureRooms = result.filter(r => r.roomType === 'Lecture Room');
    const computerLabs = result.filter(r => r.roomType === 'Computer Lab');

    console.log('=== SUMMARY ===');
    console.log(`Building: CoTE Building`);
    console.log(`Total Rooms: ${result.length}`);
    console.log(`\nBy Floor:`);
    console.log(`  Floor 1: ${floor1.length} rooms (Room 1-10)`);
    console.log(`  Floor 2: ${floor2.length} rooms (Room 11-20)`);
    console.log(`  Floor 3: ${floor3.length} rooms (Room 21-30)`);
    console.log(`\nBy Type:`);
    console.log(`  Lecture Rooms: ${lectureRooms.length}`);
    console.log(`  Computer Laboratories: ${computerLabs.length}`);

    // Display all rooms
    console.log('\n=== ALL ROOMS IN CoTE BUILDING ===\n');
    
    console.log('📍 FLOOR 1 (Rooms 1-10):');
    floor1.forEach(room => {
      console.log(`  ${room.roomCode.padEnd(10)} - ${room.roomName.padEnd(30)} | Capacity: ${room.capacity} | Type: ${room.roomType}`);
    });

    console.log('\n📍 FLOOR 2 (Rooms 11-20):');
    floor2.forEach(room => {
      console.log(`  ${room.roomCode.padEnd(10)} - ${room.roomName.padEnd(30)} | Capacity: ${room.capacity} | Type: ${room.roomType}`);
    });

    console.log('\n📍 FLOOR 3 (Rooms 21-30):');
    floor3.forEach(room => {
      console.log(`  ${room.roomCode.padEnd(10)} - ${room.roomName.padEnd(30)} | Capacity: ${room.capacity} | Type: ${room.roomType}`);
    });

    console.log('\n=== COMPUTER LABORATORIES ===');
    computerLabs.forEach(room => {
      console.log(`  ${room.roomCode} - ${room.roomName}`);
      console.log(`    Facilities: ${room.facilities.join(', ')}`);
    });

    console.log('\n✨ Room setup complete! All 30 rooms in CoTE Building are ready for scheduling.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating rooms:', error);
    process.exit(1);
  }
}

// Run the script
createCoTERooms();
