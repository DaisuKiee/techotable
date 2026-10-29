const express = require('express');
const router = express.Router();
const multer = require('multer');
const { AppError } = require('../middleware/error.middleware');
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
  // Browsers report CSVs as text/csv, application/vnd.ms-excel, text/plain or
  // application/octet-stream depending on the OS, so check the extension
  fileFilter: (req, file, cb) => {
    if (/\.csv$/i.test(file.originalname || '')) {
      cb(null, true);
    } else {
      cb(new AppError('Only .csv files can be imported. In Excel use File > Save As > CSV.', 400));
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
