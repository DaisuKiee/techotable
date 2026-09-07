const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulesByProgramAndYear,
  getFacultySchedule,
  checkConflicts,
  publishSchedule,
  batchPublishSchedules,
  batchDeleteSchedules,
  generateSchedule,
  previewSchedule,
  savePreviewedSchedules,
  bulkCreateSchedules,
  checkORToolsStatus
} = require('../controllers/schedule.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { checkProgramAccess } = require('../middleware/programAccess.middleware');

// Validation middleware
const createScheduleValidation = [
  body('academicYear').notEmpty().withMessage('Academic year is required'),
  body('semester').isIn([1, 2]).withMessage('Semester must be 1 or 2'),
  body('program').notEmpty().withMessage('Program is required'),
  body('yearLevel').isInt({ min: 1, max: 4 }).withMessage('Year level must be 1-4'),
  body('section').notEmpty().withMessage('Section is required'),
  body('sectionCode').notEmpty().withMessage('Section code is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('faculty').notEmpty().withMessage('Faculty is required'),
  body('room').notEmpty().withMessage('Room is required'),
  body('timeSlots').isArray({ min: 1 }).withMessage('At least one time slot is required')
];

// All routes require authentication
router.use(protect);

// Apply program access control for program managers
router.use(checkProgramAccess('Schedule'));

// Public schedule routes
router.get('/', getAllSchedules);
router.get('/ortools-status', checkORToolsStatus);
router.get('/program/:program/:yearLevel', getSchedulesByProgramAndYear);
router.get('/faculty/:facultyId', getFacultySchedule);
router.get('/:id', getScheduleById);
router.post('/check-conflicts', checkConflicts);

// Admin/Scheduling Officer/Program Manager routes
router.post('/', authorize('admin', 'scheduling_officer', 'program_manager'), createScheduleValidation, createSchedule);
router.post('/generate', authorize('admin', 'scheduling_officer', 'program_manager'), generateSchedule);
router.post('/preview', authorize('admin', 'scheduling_officer', 'program_manager'), previewSchedule);
router.post('/save-preview', authorize('admin', 'scheduling_officer', 'program_manager'), savePreviewedSchedules);
// Schedule builder "Save All": validates the whole batch, then writes all or nothing
router.post('/bulk', authorize('admin', 'scheduling_officer', 'program_manager'), bulkCreateSchedules);
router.post('/publish', authorize('admin', 'scheduling_officer', 'program_manager'), batchPublishSchedules);
router.post('/batch-delete', authorize('admin', 'scheduling_officer', 'program_manager'), batchDeleteSchedules);
router.put('/:id', authorize('admin', 'scheduling_officer', 'program_manager'), updateSchedule);
router.put('/:id/publish', authorize('admin', 'scheduling_officer', 'program_manager'), publishSchedule);
router.delete('/:id', authorize('admin', 'scheduling_officer', 'program_manager'), deleteSchedule);

module.exports = router;
