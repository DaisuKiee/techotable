const express = require('express');
const router = express.Router();
const {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram
} = require('../controllers/program.controller');
const { protect, authorize, optionalAuth } = require('../middleware/auth.middleware');

// The sign-up form needs the programme list before anyone has an account,
// so this one stays reachable - but an anonymous caller gets only the active
// programmes' code and name (see the controller), not the full records.
router.get('/', optionalAuth, getAllPrograms);
router.get('/:id', protect, getProgramById);

// Protected routes (Admin only)
router.post('/', protect, authorize('admin'), createProgram);
router.put('/:id', protect, authorize('admin'), updateProgram);
router.delete('/:id', protect, authorize('admin'), deleteProgram);

module.exports = router;
