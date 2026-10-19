const mongoose = require('mongoose');

const { programFieldValidator } = require('../utils/programValidator');

const SubjectSchema = new mongoose.Schema({
  subjectCode: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  subjectName: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  units: {
    type: Number,
    required: [true, 'Units are required'],
    min: 0,
    max: 12 // Increased to accommodate OJT/Practicum courses
  },
  lectureHours: {
    type: Number,
    required: true,
    min: 0
  },
  labHours: {
    type: Number,
    default: 0,
    min: 0
  },
  program: {
    type: String,
    required: [true, 'Program is required'],
    trim: true,
    // 'General' covers subjects shared across every program (e.g. GE courses)
    validate: programFieldValidator({ extraAllowed: ['General'] }),
  },
  yearLevel: {
    type: Number,
    required: [true, 'Year level is required'],
    min: 1,
    max: 4
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    enum: [1, 2]
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  requiredQualifications: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  subjectEnrollmentCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Index for faster queries
SubjectSchema.index({ program: 1, yearLevel: 1, semester: 1 });

/**
 * Generate a random subject code (8 characters, no ambiguous chars)
 * Example: K3P9X7M2, H7D5Q2N9, AB8XY3Z4
 */
SubjectSchema.statics.generateSubjectCode = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude 0, O, 1, I for clarity
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Generate a random subject enrollment code (8 characters, no ambiguous chars)
 * Used by irregular students to enroll in a single subject
 * Example: K3P9X7M2
 */
SubjectSchema.statics.generateSubjectEnrollmentCode = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude 0, O, 1, I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Generate a unique subject code (check against database)
 */
SubjectSchema.statics.generateUniqueSubjectCode = async function() {
  let code;
  let attempts = 0;
  const maxAttempts = 50;
  
  do {
    code = this.generateSubjectCode();
    const existing = await this.findOne({ subjectCode: code });
    if (!existing) return code;
    attempts++;
  } while (attempts < maxAttempts);
  
  throw new Error('Could not generate unique subject code after ' + maxAttempts + ' attempts');
};

module.exports = mongoose.model('Subject', SubjectSchema);
