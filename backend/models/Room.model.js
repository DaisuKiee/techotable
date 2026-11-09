const mongoose = require('mongoose');

const ROOM_TYPES = ['Lecture Room', 'Laboratory', 'Computer Lab', 'Workshop', 'Auditorium', 'Conference Room'];
const LAB_ROOM_TYPES = ['Laboratory', 'Computer Lab', 'Workshop'];
const EQUIPMENT_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Broken'];
const ROOM_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_CAPACITY = 500;

const RoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: [true, 'Room code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  // Optional: the code is what everyone uses. It used to be required while the
  // form treated it as optional, so saving a room without a name failed.
  roomName: {
    type: String,
    trim: true,
    default: ''
  },
  building: {
    type: String,
    required: [true, 'Building is required'],
    trim: true
  },
  floor: {
    type: Number,
    default: 1,
    min: 1
  },
  roomType: {
    type: String,
    required: [true, 'Room type is required'],
    enum: ROOM_TYPES,
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: 1,
    max: MAX_CAPACITY
  },
  // Features shown as chips (Projector, Air Conditioning, ...). The booleans
  // below are kept in step with this list for older code that reads them.
  facilities: [{
    type: String,
    trim: true
  }],
  equipment: [{
    name: String,
    quantity: Number,
    condition: {
      type: String,
      enum: EQUIPMENT_CONDITIONS,
      default: 'Good'
    }
  }],
  isAirconditioned: {
    type: Boolean,
    default: false
  },
  hasProjector: {
    type: Boolean,
    default: false
  },
  hasWhiteboard: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deactivatedAt: Date,
  deactivationReason: {
    type: String,
    trim: true
  },
  // Times the room can't be used (maintenance, a standing event). Both
  // generators and the manual schedule check keep classes out of them.
  unavailableTimeSlots: [{
    day: {
      type: String,
      enum: ROOM_DAYS
    },
    startTime: String,
    endTime: String,
    reason: String
  }],
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

RoomSchema.pre('save', function syncFeatureFlags(next) {
  if (this.isModified('facilities')) {
    const has = (name) => (this.facilities || []).some(f => f.toLowerCase() === name);
    this.hasProjector = has('projector');
    this.isAirconditioned = has('air conditioning');
    this.hasWhiteboard = has('whiteboard');
  }
  next();
});

// Index for faster queries
RoomSchema.index({ building: 1, floor: 1 });
RoomSchema.index({ roomType: 1 });

const Room = mongoose.model('Room', RoomSchema);

Room.ROOM_TYPES = ROOM_TYPES;
Room.LAB_ROOM_TYPES = LAB_ROOM_TYPES;
Room.EQUIPMENT_CONDITIONS = EQUIPMENT_CONDITIONS;
Room.ROOM_DAYS = ROOM_DAYS;
Room.MAX_CAPACITY = MAX_CAPACITY;

module.exports = Room;
