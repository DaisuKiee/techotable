const mongoose = require('mongoose');

const FacultySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['CoTE', 'Other'],
    default: 'CoTE'
  },
  position: {
    type: String,
    required: true,
    enum: ['Instructor', 'Assistant Professor', 'Associate Professor', 'Professor', 'Chairman', 'Dean', 'CD'],
    trim: true
  },
  positionHours: {
    type: Number,
    default: 0,
    min: 0,
    get: function() {
      // Auto-calculate based on position
      switch(this.position) {
        case 'Chairman': return 12; // 12-15 hours, using 12 as default
        case 'Dean': return 9;
        case 'CD': return 6;
        default: return 0;
      }
    }
  },
  employmentType: {
    type: String,
    required: true,
    enum: ['Regular', 'Part-time'],
    default: 'Regular'
  },
  qualifications: [{
    degree: {
      type: String,
      required: true
    },
    field: {
      type: String,
      required: true
    },
    institution: String,
    yearObtained: Number
  }],
  specializations: [{
    type: String,
    trim: true
  }],
  programs: [{
    type: String,
    trim: true
  }],
  teachingHistory: [{
    subjectCode: String,
    subjectName: String,
    semester: String,
    academicYear: String,
    program: String,
    rating: {
      type: Number,
      min: 0,
      max: 5
    }
  }],
  maxTeachingHours: {
    type: Number,
    default: 36, // Standard: 36 hours for regular/part-time
    min: 0,
    max: 40  // Can go up to 40 with warning
  },
  currentTeachingHours: {
    type: Number,
    default: 0,
    min: 0
  },
  preferredTimeSlots: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    startTime: String,
    endTime: String
  }],
  unavailableTimeSlots: [{
    day: String,
    startTime: String,
    endTime: String,
    reason: String
  }],
  contactNumber: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries on specializations
FacultySchema.index({ 'specializations': 1 });

// Virtual field for total hours (teaching + administrative)
FacultySchema.virtual('totalHours').get(function() {
  return (this.currentTeachingHours || 0) + (this.positionHours || 0);
});

// Virtual field for load status
FacultySchema.virtual('loadStatus').get(function() {
  const total = this.totalHours;
  const standard = 36;
  
  if (total <= standard) {
    return { status: 'normal', color: 'green', message: 'Normal load' };
  } else if (total <= 40) {
    return { status: 'warning', color: 'yellow', message: 'Above standard (allowed)' };
  } else {
    return { status: 'overload', color: 'red', message: 'Overloaded' };
  }
});

// Ensure virtuals are included in JSON
FacultySchema.set('toJSON', { virtuals: true });
FacultySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Faculty', FacultySchema);
