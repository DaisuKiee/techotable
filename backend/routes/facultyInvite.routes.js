const express = require('express');
const { protect, authorize } = require('../middleware/auth.middleware');
const { listInvites, createInvite, revokeInvite } = require('../controllers/facultyInvite.controller');

const router = express.Router();

router.use(protect, authorize('admin', 'scheduling_officer', 'program_manager'));

router.get('/', listInvites);
router.post('/', createInvite);
router.delete('/:id', revokeInvite);

module.exports = router;
