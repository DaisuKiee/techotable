const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllClassSpaces,
  getMyClassSpaces,
  getClassSpaceById,
  createClassSpace,
  updateClassSpace,
  deleteClassSpace,
  joinByCode,
  leaveClassSpace,
  regenerateClassCode,
  postAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadMaterial,
  deleteMaterial,
  enrollByCode,
  unenrollFromClass,
} = require('../controllers/classSpace.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadMaterial: uploadMaterialFile } = require('../middleware/upload.middleware');

// Everything here requires a logged-in user
router.use(protect);

const STAFF = ['admin', 'scheduling_officer', 'program_manager'];
const TEACHING = [...STAFF, 'faculty'];

/* -------- student enrollment (declared before /:id so it isn't shadowed) -------- */
router.post('/join', authorize('student'), joinByCode);
router.post('/:id/leave', authorize('student'), leaveClassSpace);
router.post('/enroll-by-code', authorize('student'), enrollByCode);
router.delete('/:id/unenroll', authorize('student'), unenrollFromClass);

/* -------- listing -------- */
// Own classes: any role, resolved per-role in the controller
router.get('/my-classes', getMyClassSpaces);
// Full listing is staff/faculty only; students must use /my-classes
router.get('/', authorize(...TEACHING), getAllClassSpaces);
// Per-class read is membership-checked inside the controller
router.get('/:id', getClassSpaceById);

/* -------- class space management -------- */
router.post('/', authorize(...STAFF), createClassSpace);
router.put('/:id', authorize(...TEACHING), updateClassSpace);
router.delete('/:id', authorize('admin'), deleteClassSpace);
router.put('/:id/regenerate-code', authorize(...TEACHING), regenerateClassCode);

/* -------- announcements -------- */
router.post(
  '/:id/announcements',
  authorize(...TEACHING),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
  ],
  postAnnouncement
);
router.put('/:id/announcements/:announcementId', authorize(...TEACHING), updateAnnouncement);
router.delete('/:id/announcements/:announcementId', authorize(...TEACHING), deleteAnnouncement);

/* -------- materials -------- */
router.post('/:id/materials', authorize(...TEACHING), uploadMaterialFile.single('file'), uploadMaterial);
router.delete('/:id/materials/:materialId', authorize(...TEACHING), deleteMaterial);

module.exports = router;
