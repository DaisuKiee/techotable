const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  listTerms,
  getCurrent,
  deleteTerm,
  getArchive,
  getArchiveTerms,
  previewSchoolYear,
  saveSchoolYear,
} = require('../controllers/term.controller');

// Semesters are per program: program managers manage their own program's,
// admins and the scheduling office any program's (see the controller)
const STAFF = ['admin', 'scheduling_officer', 'program_manager'];

router.use(protect);

router.get('/current', getCurrent);
router.get('/archive/terms', authorize(...STAFF), getArchiveTerms);
router.get('/archive', authorize(...STAFF), getArchive);
router.get('/', authorize(...STAFF), listTerms);
router.post('/school-year/preview', authorize(...STAFF), previewSchoolYear);
router.put('/school-year', authorize(...STAFF), saveSchoolYear);
router.delete('/:id', authorize(...STAFF), deleteTerm);

module.exports = router;
