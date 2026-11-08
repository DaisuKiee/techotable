const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByRole,
  uploadAvatar,
  deleteAvatar
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) are allowed'));
    }
  }
});

// All routes require authentication
router.use(protect);

// Avatar routes
router.post('/:id/avatar', upload.single('avatar'), uploadAvatar);
router.delete('/:id/avatar', deleteAvatar);

// Get users by role
// Staff only: this listed every user of a role to any signed-in account
router.get('/role/:role', authorize('admin', 'scheduling_officer', 'program_manager'), getUsersByRole);

// Admin only routes
router.get('/', authorize('admin', 'scheduling_officer', 'program_manager'), getAllUsers);
router.get('/:id', authorize('admin', 'scheduling_officer', 'program_manager'), getUserById);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
