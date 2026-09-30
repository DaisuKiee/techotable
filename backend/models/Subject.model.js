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
  }
}, {
  timestamps: true
});

// Index for faster queries
SubjectSchema.index({ program: 1, yearLevel: 1, semester: 1 });

/**
 * Generate a random subject code (6 characters: 2 letters + 4 digits)
 * Example: IT3101, CS2045, EE1234
 */
SubjectSchema.statics.generateSubjectCode = function() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  
  let code = '';
  // 2 uppercase letters
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // 4 digits
  for (let i = 0; i < 4; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
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
