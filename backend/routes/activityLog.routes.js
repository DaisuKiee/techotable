const express = require('express');
const router = express.Router();
const {
  getAllLogs,
  getStats,
  getUserSummary,
  cleanupLogs
} = require('../controllers/activityLog.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Statistics endpoint - accessible to management roles
router.get('/stats', authorize('admin', 'scheduling_officer', 'program_manager'), getStats);

// User summary (users can view their own, admins can view any)
router.get('/user/:userId', getUserSummary);

// Management routes - accessible to admin, scheduling officer, and program manager
router.get('/', authorize('admin', 'scheduling_officer', 'program_manager'), getAllLogs);
router.delete('/cleanup', authorize('admin'), cleanupLogs);

module.exports = router;
