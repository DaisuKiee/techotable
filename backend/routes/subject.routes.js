const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsByProgramAndYear,
  getSubjectStats,
  bulkImportSubjects,
  getSubjectsByQualification,
  generateSubjectCode
} = require('../controllers/subject.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { checkProgramAccess } = require('../middleware/programAccess.middleware');
const { isValidProgramCode } = require('../utils/programValidator');

// Validation middleware
const createSubjectValidation = [
  body('subjectCode')
    .trim()
    .notEmpty()
    .withMessage('Subject code is required')
    .isLength({ max: 20 })
    .withMessage('Subject code must be 20 characters or less'),
  body('subjectName')
    .trim()
    .notEmpty()
    .withMessage('Subject name is required'),
  body('units')
    .isInt({ min: 0, max: 6 })
    .withMessage('Units must be between 0 and 6'),
  body('lectureHours')
    .isInt({ min: 0 })
    .withMessage('Lecture hours must be a positive number'),
  body('program')
    .custom(async (value) => {
      // 'General' covers subjects shared across every program
      const valid = await isValidProgramCode(value, ['General']);
      if (!valid) {
        throw new Error(`'${value}' is not an active program in the database`);
      }
      return true;
    }),
  body('yearLevel')
    .isInt({ min: 1, max: 4 })
    .withMessage('Year level must be between 1 and 4'),
  body('semester')
    .isIn([1, 2])
    .withMessage('Semester must be 1 or 2')
];

// All routes require authentication
router.use(protect);

// Public subject routes (all authenticated users) - with program filtering for managers
router.get('/', checkProgramAccess('Subject'), getAllSubjects);
router.get('/stats', checkProgramAccess('Subject'), getSubjectStats);
router.get('/curriculum/:program/:yearLevel', getSubjectsByProgramAndYear);
router.get('/qualification/:qualification', getSubjectsByQualification);
router.get('/:id', checkProgramAccess('Subject'), getSubjectById);

// Generate subject code endpoint
router.post('/generate-code', authorize('admin', 'scheduling_officer', 'program_manager'), generateSubjectCode);

// Apply program access control for create/update/delete operations
// Admin/Scheduling Officer/Program Manager routes
router.post('/', authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Subject'), createSubjectValidation, createSubject);
router.post('/bulk-import', authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Subject'), bulkImportSubjects);
router.put('/:id', authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Subject'), updateSubject);
router.delete('/:id', authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Subject'), deleteSubject);

module.exports = router;
