const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication
      'login', 'logout', 'register',
      // CRUD operations
      'create', 'read', 'update', 'delete',
      // Schedule operations
      'schedule_generate', 'schedule_publish', 'schedule_export',
      // Faculty operations
      'faculty_assign', 'faculty_workload_update', 'faculty_ai_analysis',
      // Student operations
      'student_enroll', 'student_bulk_import',
      // Class space operations
      'announcement_post', 'material_upload',
      // System operations
      'settings_update', 'data_export', 'data_import'
    ]
  },
  resource: {
    type: String,
    required: true,
    enum: [
      'user', 'faculty', 'student', 'subject', 'room', 
      'schedule', 'classSpace', 'announcement', 'material',
      'system', 'auth', 'analyze-subject-compatibility', 'background-summary'
    ]
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success'
  },
  errorMessage: {
    type: String,
    default: null
  },
  duration: {
    type: Number, // milliseconds
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
ActivityLogSchema.index({ user: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ resource: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });

// TTL index - automatically delete logs older than 90 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
