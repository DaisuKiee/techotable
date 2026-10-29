const mongoose = require('mongoose');

const { programFieldValidator } = require('../utils/programValidator');

const SectionSchema = new mongoose.Schema({
  sectionCode: {
    type: String,
    required: [true, 'Section code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  enrollmentCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  program: {
    type: String,
    required: [true, 'Program is required'],
    trim: true,
    validate: programFieldValidator()
  },
  yearLevel: {
    type: Number,
    required: [true, 'Year level is required'],
    min: 1,
    max: 4
  },
  sectionLetter: {
    type: String,
    required: [true, 'Section letter is required'],
    trim: true,
    uppercase: true
  },
  shift: {
    type: String,
    required: [true, 'Shift is required'],
    enum: ['Day', 'Night']
  },
  maxStudents: {
    type: Number,
    default: 40,
    min: 1
  },
  currentStudents: {
    type: Number,
    default: 0,
    min: 0
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    enum: [1, 2]
  },
  adviser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    default: null
  },
  // The room this section normally meets in. The schedule builder pre-fills it
  // on every class dropped for the section. Stored as a Room id string, the
  // same way Schedule.room is, so the two compare directly.
  room: {
    type: String,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries (sectionCode and enrollmentCode already indexed via unique:true)
SectionSchema.index({ program: 1, yearLevel: 1, sectionLetter: 1 });
SectionSchema.index({ academicYear: 1, semester: 1 });

// Method to generate random enrollment code
SectionSchema.methods.generateEnrollmentCode = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Virtual for full section name
SectionSchema.virtual('fullName').get(function() {
  return `${this.program} ${this.yearLevel}-${this.sectionLetter}`;
});

// Ensure virtuals are included in JSON
SectionSchema.set('toJSON', { virtuals: true });
SectionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Section', SectionSchema);
