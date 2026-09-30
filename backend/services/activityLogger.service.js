/**
 * Activity Logger Service
 * 
 * Centralized logging service for tracking user activities
 * and system events for audit trails and analytics
 */

const ActivityLog = require('../models/ActivityLog.model');

/**
 * Log an activity
 * @param {Object} data - Activity data
 */
async function logActivity(data) {
  try {
    const {
      userId,
      action,
      resource,
      resourceId = null,
      details = {},
      ipAddress = null,
      userAgent = null,
      status = 'success',
      errorMessage = null,
      duration = null,
      metadata = {}
    } = data;

    // Validate required fields
    if (!userId || !action || !resource) {
      console.error('Missing required fields for activity log:', data);
      return null;
    }

    // Create log entry
    const log = await ActivityLog.create({
      user: userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage,
      duration,
      metadata
    });

    return log;
  } catch (error) {
    // Don't throw errors from logging to prevent breaking main operations
    console.error('Activity logging error:', error);
    return null;
  }
}

/**
 * Get activity logs with filters
 * @param {Object} filters - Query filters
 */
async function getActivityLogs(filters = {}) {
  try {
    const {
      userId,
      action,
      resource,
      status,
      startDate,
      endDate,
      limit = 100,
      skip = 0,
      sort = '-createdAt'
    } = filters;

    // Build query
    const query = {};
    if (userId) query.user = userId;
    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Execute query
    const logs = await ActivityLog.find(query)
      .populate('user', 'firstName lastName email role profilePicture')
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await ActivityLog.countDocuments(query);

    return {
      logs,
      total,
      limit,
      skip
    };
  } catch (error) {
    console.error('Get activity logs error:', error);
    throw error;
  }
}

/**
 * Get activity statistics
 * @param {Object} filters - Query filters
 */
async function getActivityStats(filters = {}) {
  try {
    const { startDate, endDate, userId } = filters;

    // Build base query
    const baseQuery = {};
    if (userId) baseQuery.user = userId;
    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) baseQuery.createdAt.$gte = new Date(startDate);
      if (endDate) baseQuery.createdAt.$lte = new Date(endDate);
    }

    // Get statistics
    const [
      totalActivities,
      activitiesByAction,
      activitiesByResource,
      activitiesByStatus,
      activitiesByUser,
      recentActivities
    ] = await Promise.all([
      // Total count
      ActivityLog.countDocuments(baseQuery),
      
      // By action
      ActivityLog.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // By resource
      ActivityLog.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // By status
      ActivityLog.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // By user (top 10)
      ActivityLog.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$user', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        {
          $project: {
            _id: 1,
            count: 1,
            name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
            role: '$userInfo.role'
          }
        }
      ]),
      
      // Recent activities
      ActivityLog.find(baseQuery)
        .populate('user', 'firstName lastName email profilePicture')
        .sort('-createdAt')
        .limit(20)
        .lean()
    ]);

    // Calculate activities per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activitiesPerDay = await ActivityLog.aggregate([
      {
        $match: {
          ...baseQuery,
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format status counts
    const statusCounts = {
      success: 0,
      failure: 0,
      warning: 0
    };
    
    activitiesByStatus.forEach(item => {
      if (item._id && statusCounts.hasOwnProperty(item._id)) {
        statusCounts[item._id] = item.count;
      }
    });

    return {
      totalActivities,
      successCount: statusCounts.success,
      failureCount: statusCounts.failure,
      warningCount: statusCounts.warning,
      uniqueUsers: activitiesByUser.length,
      activitiesByAction,
      activitiesByResource,
      activitiesByStatus,
      activitiesByUser,
      activitiesPerDay,
      recentActivities
    };
  } catch (error) {
    console.error('Get activity stats error:', error);
    throw error;
  }
}

/**
 * Clean up old logs (called by cron job or manually)
 * @param {Number} daysToKeep - Number of days to keep
 */
async function cleanupOldLogs(daysToKeep = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    return {
      deleted: result.deletedCount,
      cutoffDate
    };
  } catch (error) {
    console.error('Cleanup logs error:', error);
    throw error;
  }
}

/**
 * Get user activity summary
 * @param {String} userId - User ID
 */
async function getUserActivitySummary(userId) {
  try {
    const mongoose = require('mongoose');
    
    const [
      totalActivities,
      lastLogin,
      actionsSummary,
      resourcesSummary
    ] = await Promise.all([
      ActivityLog.countDocuments({ user: userId }),
      
      ActivityLog.findOne({ user: userId, action: 'login' })
        .sort('-createdAt')
        .lean(),
      
      ActivityLog.aggregate([
        { $match: { user: mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      ActivityLog.aggregate([
        { $match: { user: mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    return {
      totalActivities,
      lastLogin: lastLogin?.createdAt || null,
      actionsSummary,
      resourcesSummary
    };
  } catch (error) {
    console.error('Get user activity summary error:', error);
    throw error;
  }
}

// Express middleware to automatically log requests
function activityLoggerMiddleware(options = {}) {
  const { 
    logReads = false, // Whether to log read operations
    excludePaths = ['/api/health', '/api/auth/me'] // Paths to exclude
  } = options;

  return async (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.includes(path))) {
      return next();
    }

    // Skip read operations if configured
    if (!logReads && req.method === 'GET') {
      return next();
    }

    // Capture start time
    const startTime = Date.now();

    // Capture original send function
    const originalSend = res.send;

    // Override send function to log after response
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Determine action from method and path
      let action = 'read';
      let resource = 'system';

      if (req.method === 'POST') action = 'create';
      else if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
      else if (req.method === 'DELETE') action = 'delete';

      // Extract resource from path
      const pathParts = req.path.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        resource = pathParts[1]; // e.g., /api/faculty -> faculty
      }

      // Log activity if user is authenticated
      if (req.user) {
        logActivity({
          userId: req.user._id,
          action,
          resource,
          resourceId: pathParts[2] || null,
          details: {
            method: req.method,
            path: req.path,
            statusCode
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          status: statusCode < 400 ? 'success' : 'failure',
          duration,
          metadata: {
            query: req.query,
            params: req.params
          }
        });
      }

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
}

module.exports = {
  logActivity,
  getActivityLogs,
  getActivityStats,
  cleanupOldLogs,
  getUserActivitySummary,
  activityLoggerMiddleware
};
