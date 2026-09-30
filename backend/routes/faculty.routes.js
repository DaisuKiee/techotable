const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  addQualification,
  addTeachingHistory,
  getFacultyWorkload,
  getFacultyBySpecialization,
  getAvailableFaculty,
  updateFacultyLoad
} = require('../controllers/faculty.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { checkProgramAccess } = require('../middleware/programAccess.middleware');

// Validation middleware
const createFacultyValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),
  body('position')
    .trim()
    .notEmpty()
    .withMessage('Position is required')
];

// All routes require authentication
router.use(protect);

// Public faculty routes (all authenticated users)
// checkProgramAccess forces req.query.program = user.program for program managers,
// so a manager cannot widen their own scope by editing the query string.
router.get('/', checkProgramAccess('Faculty'), getAllFaculty);
router.get('/available', checkProgramAccess('Faculty'), getAvailableFaculty);
router.get('/specialization/:specialization', getFacultyBySpecialization);
router.get('/:id', getFacultyById);
router.get('/:id/workload', getFacultyWorkload);

// Admin/Scheduling Officer/Program Manager only routes
router.post('/', authorize('admin', 'scheduling_officer', 'program_manager'), createFacultyValidation, createFaculty);
// Faculty can update their own profile, others need admin/scheduling_officer/program_manager role
router.put('/:id', authorize('admin', 'scheduling_officer', 'program_manager', 'faculty'), updateFaculty);
router.delete('/:id', authorize('admin', 'scheduling_officer', 'program_manager'), deleteFaculty);
router.post('/:id/qualifications', authorize('admin', 'scheduling_officer', 'program_manager', 'faculty'), addQualification);
router.post('/:id/teaching-history', authorize('admin', 'scheduling_officer', 'program_manager'), addTeachingHistory);
router.put('/:id/load', authorize('admin', 'scheduling_officer', 'program_manager'), updateFacultyLoad);

module.exports = router;
