const express = require('express');
const router = express.Router();
const {
  getAllSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  getSectionsByProgramAndYear,
  getSectionStats,
  regenerateEnrollmentCode,
  assignHomeRooms
} = require('../controllers/section.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { checkProgramAccess } = require('../middleware/programAccess.middleware');
const { restrictProgramParam } = require('../utils/programScope');

// Apply authentication to all routes
router.use(protect);

// Stats route (must be before /:id) - with program filtering
router.get('/stats', authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Section'), getSectionStats);

// Program and year specific route
router.get('/program/:program/year/:year', restrictProgramParam(), getSectionsByProgramAndYear);

// Main CRUD routes
router.route('/')
  .get(checkProgramAccess('Section'), getAllSections)
  .post(authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Section'), createSection);

// Fill in missing home rooms (must be before /:id)
router.post('/home-rooms/assign', authorize('admin', 'scheduling_officer', 'program_manager'), assignHomeRooms);

// Regenerate enrollment code route (must be before /:id)
router.put('/:id/regenerate-code', authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Section'), regenerateEnrollmentCode);

router.route('/:id')
  .get(checkProgramAccess('Section'), getSectionById)
  .put(authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Section'), updateSection)
  .delete(authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Section'), deleteSection);

module.exports = router;
