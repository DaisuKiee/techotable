const mongoose = require('mongoose');
const Notification = require('../models/Notification.model');
const realtime = require('../services/realtime.service');
const { sendError } = require('../middleware/error.middleware');

const unreadFor = (userId) => Notification.countDocuments({ recipient: userId, isRead: false });

// Keep every open tab's badge in step after a read or delete
const pushUnread = async (userId) => {
  realtime.publish([userId], 'unread', { count: await unreadFor(userId) });
};

// @desc    Live stream of this user's notifications and data-change signals
// @route   GET /api/notifications/stream
// @access  Private
exports.stream = async (req, res) => {
  try {
    const unread = await unreadFor(req.user._id);
    realtime.subscribe(req, res, { unread });
  } catch (error) {
    sendError(res, error, 'Could not open the notification stream');
  }
};

// @desc    Get user notifications (newest first; `before` = id to page back from)
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { unreadOnly, type, before } = req.query;

    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') query.isRead = false;
    if (type) query.type = type;
    if (before && mongoose.isValidObjectId(before)) query._id = { $lt: before };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ _id: -1 }).limit(limit + 1).lean(),
      unreadFor(req.user._id),
    ]);

    res.status(200).json({
      success: true,
      data: notifications.slice(0, limit),
      hasMore: notifications.length > limit,
      unreadCount,
    });
  } catch (error) {
    sendError(res, error, 'Error fetching notifications');
  }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    res.status(200).json({ success: true, count: await unreadFor(req.user._id) });
  } catch (error) {
    sendError(res, error, 'Error fetching unread count');
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    realtime.publish([req.user._id], 'read', { ids: [String(notification._id)] });
    pushUnread(req.user._id);

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    sendError(res, error, 'Error marking notification as read');
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    realtime.publish([req.user._id], 'read', { all: true });
    realtime.publish([req.user._id], 'unread', { count: 0 });

    res.status(200).json({
      success: true,
      updated: result.modifiedCount || 0,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    sendError(res, error, 'Error marking notifications as read');
  }
};

// @desc    Delete every read notification
// @route   DELETE /api/notifications/read
// @access  Private
exports.clearRead = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ recipient: req.user._id, isRead: true });
    realtime.publish([req.user._id], 'cleared', { read: true });
    res.status(200).json({
      success: true,
      deleted: result.deletedCount || 0,
      message: 'Read notifications cleared'
    });
  } catch (error) {
    sendError(res, error, 'Error clearing notifications');
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    realtime.publish([req.user._id], 'deleted', { ids: [String(notification._id)] });
    if (!notification.isRead) pushUnread(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    sendError(res, error, 'Error deleting notification');
  }
};
