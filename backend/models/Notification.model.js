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
    enum: ['schedule', 'announcement', 'material', 'system'],
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
      enum: ['Schedule', 'ClassSpace', 'Announcement', 'Material']
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
    className: String
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
