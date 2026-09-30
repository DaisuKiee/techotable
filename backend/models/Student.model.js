const mongoose = require('mongoose');

const { programFieldValidator } = require('../utils/programValidator');

const StudentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    trim: true
  },
  program: {
    type: String,
    required: [true, 'Program is required'],
    trim: true,
    validate: programFieldValidator()
  },
  studentType: {
    type: String,
    enum: ['regular', 'irregular'],
    default: null,
    required: false
  },
  // For regular students: enrolled in a section (e.g., "BSIT-4A")
  // Will be assigned by program manager after signup
  sectionCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  // For irregular students: enrolled in specific subjects
  // Will be assigned by program manager
  subjectCodes: {
    type: [String],
    default: []
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-2025'
  },
  semester: {
    type: Number,
    required: true,
    enum: [1, 2],
    default: 1
  },
  enrolledClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSpace'
  }],
  contactNumber: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    barangay: String,
    city: String,
    province: String,
    zipCode: String
  },
  guardianInfo: {
    name: String,
    relationship: String,
    contactNumber: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    contactNumber: String
  },
  enrollmentStatus: {
    type: String,
    enum: ['enrolled', 'not_enrolled', 'dropped', 'graduated'],
    default: 'not_enrolled'
  },
  gpa: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
StudentSchema.index({ studentId: 1 });
StudentSchema.index({ program: 1, sectionCode: 1 });
StudentSchema.index({ user: 1 });
StudentSchema.index({ studentType: 1 });

module.exports = mongoose.model('Student', StudentSchema);
