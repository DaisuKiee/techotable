const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllStudents,
  getStudentById,
  getMyProfile,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkImport,
  getStats,
  assignSectionCode
} = require('../controllers/student.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { checkProgramAccess } = require('../middleware/programAccess.middleware');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Get current student's profile (must be before /:id route)
router.get('/profile', protect, authorize('student'), getMyProfile);

// Statistics route (with program filtering for program managers)
router.get('/stats', protect, authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Student'), getStats);

// Bulk import route
router.post('/bulk-import', protect, authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Student'), upload.single('file'), bulkImport);

// CRUD routes
router.route('/')
  .get(protect, authorize('admin', 'scheduling_officer', 'program_manager', 'faculty'), checkProgramAccess('Student'), getAllStudents)
  .post(protect, authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Student'), createStudent);

// Assign section code route
router.put('/:id/assign-section', protect, authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Student'), assignSectionCode);

router.route('/:id')
  .get(protect, getStudentById)
  .put(protect, authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Student'), updateStudent)
  .delete(protect, authorize('admin', 'scheduling_officer', 'program_manager'), checkProgramAccess('Student'), deleteStudent);

module.exports = router;
