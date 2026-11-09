const { sendError } = require('../middleware/error.middleware');
const { managerProgram, programUserIds } = require('../utils/programScope');
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

    // Program managers see activity by people in their own program
    const program = managerProgram(req);
    const scopedUser = program ? (userId ? ((await programUserIds(program)).includes(String(userId)) ? userId : '000000000000000000000000') : await programUserIds(program)) : userId;

    const result = await getActivityLogs({
      userId: scopedUser,
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
    const { startDate, endDate, userId, timezone } = req.query;

    // Program managers: their program's people, or one of them if asked
    const program = managerProgram(req);
    let scopedUser = userId;
    if (program) {
      const ids = await programUserIds(program);
      scopedUser = userId ? (ids.map(String).includes(String(userId)) ? userId : '000000000000000000000000') : ids;
    }
    const stats = await getActivityStats({
      startDate,
      endDate,
      userId: scopedUser,
      // Day buckets in the viewer's timezone (an IANA name such as Asia/Manila)
      timezone: /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(timezone || '') ? timezone : 'UTC'
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
