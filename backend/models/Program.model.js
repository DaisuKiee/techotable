const mongoose = require('mongoose');

const ProgramSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Program code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Program name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    default: 'CoTE'
  },
  duration: {
    type: Number, // in years
    default: 4
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
ProgramSchema.index({ isActive: 1 });

module.exports = mongoose.model('Program', ProgramSchema);
