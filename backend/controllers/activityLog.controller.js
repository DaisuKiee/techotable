const { sendError } = require('../middleware/error.middleware');
const { 
  getActivityLogs, 
  getActivityStats, 
  getUserActivitySummary,
  cleanupOldLogs 
} = require('../services/activityLogger.service');

// @desc    Get all activity logs
// @route   GET /api/activity-logs
// @access  Private (Admin only)
exports.getAllLogs = async (req, res) => {
  try {
    const {
      userId,
      action,
      resource,
      status,
      startDate,
      endDate,
      limit = 100,
      skip = 0
    } = req.query;

    const result = await getActivityLogs({
      userId,
      action,
      resource,
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    sendError(res, error, 'Error fetching activity logs');
  }
};

// @desc    Get activity statistics
// @route   GET /api/activity-logs/stats
// @access  Private (Admin only)
exports.getStats = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    const stats = await getActivityStats({
      startDate,
      endDate,
      userId
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    sendError(res, error, 'Error fetching activity statistics');
  }
};

// @desc    Get user activity summary
// @route   GET /api/activity-logs/user/:userId
// @access  Private
exports.getUserSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only view their own summary unless admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user summary'
      });
    }

    const summary = await getUserActivitySummary(userId);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    sendError(res, error, 'Error fetching user activity summary');
  }
};

// @desc    Cleanup old logs
// @route   DELETE /api/activity-logs/cleanup
// @access  Private (Admin only)
exports.cleanupLogs = async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;

    const result = await cleanupOldLogs(parseInt(daysToKeep));

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deleted} old activity logs`,
      data: result
    });
  } catch (error) {
    sendError(res, error, 'Error cleaning up activity logs');
  }
};

module.exports = exports;
