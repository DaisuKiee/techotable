const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { isValidProgramCode } = require('../utils/programValidator');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'scheduling_officer', 'program_manager', 'faculty', 'student'],
    default: 'student',
    required: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  studentId: {
    type: String,
    trim: true,
    sparse: true // Allows null but unique if present
  },
  program: {
    type: String,
    default: null,
    trim: true,
    validate: {
      validator: async function(value) {
        const isEmpty = value === null || value === undefined || value === '';

        // Program managers must be tied to a program
        if (this.role === 'program_manager' && isEmpty) {
          return false;
        }

        // Everyone else may leave it blank
        if (isEmpty) return true;

        // Whatever is set must be a real, active program
        return isValidProgramCode(value);
      },
      message: function(props) {
        if (this.role === 'program_manager' && !props.value) {
          return 'Program is required for program managers';
        }
        return `'${props.value}' is not a valid program. It must match an active program code in the database.`;
      }
    }
  },
  shift: {
    type: String,
    enum: ['Day', 'Night', null],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPending: {
    type: Boolean,
    default: false
  },
  // Which Terms of Use / Privacy Notice version this user accepted, and when
  // (see config/terms.js). Null until they accept on first login.
  termsAcceptedVersion: {
    type: String,
    default: null
  },
  termsAcceptedAt: {
    type: Date,
    default: null
  },
  pendingApprovalDate: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  facultyProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  // Settings fields
  settings: {
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      scheduleUpdates: { type: Boolean, default: true },
      facultyAssignments: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false }
    },
    appearance: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      language: { type: String, enum: ['en', 'fil', 'ceb'], default: 'en' },
      timezone: { type: String, default: 'Asia/Manila' }
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'program-only', 'private'], default: 'public' },
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      allowMessages: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  if (this.middleName) {
    return `${this.firstName} ${this.middleName} ${this.lastName}`;
  }
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
