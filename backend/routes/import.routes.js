const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  importExcel,
  importStudentsExcel,
  importFacultyExcel,
  importSubjectsExcel,
  downloadTemplate
} = require('../controllers/import.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Configure multer for Excel file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for Excel files
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// Template download routes (GET). Program managers manage their program's
// subjects (they can add and bulk-import them), so they can download templates
// too; the file is a blank guide and carries no data.
router.get('/template/:type', protect, authorize('admin', 'scheduling_officer', 'program_manager'), downloadTemplate);

// Import routes (POST)
router.post('/excel', protect, authorize('admin', 'scheduling_officer'), upload.single('file'), importExcel);
router.post('/students', protect, authorize('admin', 'scheduling_officer'), upload.single('file'), importStudentsExcel);
router.post('/faculty', protect, authorize('admin', 'scheduling_officer'), upload.single('file'), importFacultyExcel);
// Program managers may import subjects, but the controller scopes the rows to
// their own program so they cannot create subjects for another program.
router.post('/subjects', protect, authorize('admin', 'scheduling_officer', 'program_manager'), upload.single('file'), importSubjectsExcel);

module.exports = router;
