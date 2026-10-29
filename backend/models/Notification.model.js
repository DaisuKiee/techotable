const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    // schedule: a class was added/moved/changed/removed; enrollment: section or
    // class membership; account: approvals and sign-ups
    enum: ['schedule', 'announcement', 'material', 'enrollment', 'account', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  // Optional link to navigate when clicked
  link: {
    type: String
  },
  // Reference to the related resource
  relatedResource: {
    resourceType: {
      type: String,
      enum: ['Schedule', 'ClassSpace', 'Announcement', 'Material', 'Section', 'Student', 'Faculty', 'User']
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  // Metadata for displaying icons/colors
  metadata: {
    icon: String,
    color: String,
    subjectCode: String,
    className: String,
    // What happened, for icons and filtering: created, moved, updated,
    // reassigned, removed, published, generated, assigned, approved, ...
    kind: String,
    sectionCode: String,
    // Short "before -> after" lines shown under the message
    changes: [String]
  },
  // Who caused it (shown as "by Maria Santos"), when known
  actorName: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

module.exports = mongoose.model('Notification', NotificationSchema);
