const express = require('express');
const router = express.Router();
const {
  getAllRooms,
  getRoomById,
  getRoomSchedule,
  getRoomImpact,
  findFreeRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  restoreRoom,
  getRoomsByType,
  getAvailableRooms,
  getRoomStats
} = require('../controllers/room.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const MANAGERS = ['admin', 'scheduling_officer', 'program_manager'];

// All routes require authentication. Input is validated in the controller
// (cleanRoomInput), which covers updates too - the old express-validator
// chain only ran on create.
router.use(protect);

router.get('/', getAllRooms);
router.get('/stats', getRoomStats);
router.get('/available', findFreeRooms);
router.get('/available/:capacity', getAvailableRooms);
router.get('/type/:roomType', getRoomsByType);
router.get('/:id/schedule', getRoomSchedule);
router.get('/:id/impact', authorize(...MANAGERS), getRoomImpact);
router.get('/:id', getRoomById);

router.post('/', authorize(...MANAGERS), createRoom);
router.put('/:id', authorize(...MANAGERS), updateRoom);
router.patch('/:id/restore', authorize(...MANAGERS), restoreRoom);
router.delete('/:id', authorize(...MANAGERS), deleteRoom);

module.exports = router;
