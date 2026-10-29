const express = require('express');
const router = express.Router();
const {
  stream,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearRead,
  deleteNotification
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

router.get('/stream', stream);
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);
// Before '/:id' so "read" isn't taken as an id
router.delete('/read', clearRead);
router.delete('/:id', deleteNotification);

module.exports = router;
