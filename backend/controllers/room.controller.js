const Room = require('../models/Room.model');
const { validationResult } = require('express-validator');
const { sendError, sendValidationErrors } = require('../middleware/error.middleware');

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Private
exports.getAllRooms = async (req, res) => {
  try {
    const { 
      building, 
      roomType, 
      isActive, 
      search,
      minCapacity,
      maxCapacity,
      hasProjector,
      isAirconditioned
    } = req.query;

    // Build query
    let query = {};

    if (building) {
      query.building = building;
    }

    if (roomType) {
      query.roomType = roomType;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (minCapacity || maxCapacity) {
      query.capacity = {};
      if (minCapacity) query.capacity.$gte = parseInt(minCapacity);
      if (maxCapacity) query.capacity.$lte = parseInt(maxCapacity);
    }

    if (hasProjector !== undefined) {
      query.hasProjector = hasProjector === 'true';
    }

    if (isAirconditioned !== undefined) {
      query.isAirconditioned = isAirconditioned === 'true';
    }

    if (search) {
      query.$or = [
        { roomCode: { $regex: search, $options: 'i' } },
        { roomName: { $regex: search, $options: 'i' } }
      ];
    }

    const rooms = await Room.find(query)
      .sort({ building: 1, floor: 1, roomCode: 1 });

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });

  } catch (error) {
    sendError(res, error, 'Error fetching rooms');
  }
};

// @desc    Get room by ID
// @route   GET /api/rooms/:id
// @access  Private
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.status(200).json({
      success: true,
      data: room
    });

  } catch (error) {
    sendError(res, error, 'Error fetching room');
  }
};

// @desc    Create new room
// @route   POST /api/rooms
// @access  Private/Admin
exports.createRoom = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const {
      roomCode,
      roomName,
      building,
      floor,
      roomType,
      capacity,
      facilities,
      equipment,
      isAirconditioned,
      hasProjector,
      hasWhiteboard,
      notes
    } = req.body;

    // Check if room code already exists
    const existingRoom = await Room.findOne({ 
      roomCode: roomCode.toUpperCase() 
    });
    
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: 'Room with this code already exists'
      });
    }

    // Create room
    const room = await Room.create({
      roomCode: roomCode.toUpperCase(),
      roomName,
      building,
      floor,
      roomType,
      capacity,
      facilities: facilities || [],
      equipment: equipment || [],
      isAirconditioned: isAirconditioned || false,
      hasProjector: hasProjector || false,
      hasWhiteboard: hasWhiteboard !== undefined ? hasWhiteboard : true,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: room
    });

  } catch (error) {
    sendError(res, error, 'Error creating room');
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const {
      roomCode,
      roomName,
      building,
      floor,
      roomType,
      capacity,
      facilities,
      equipment,
      isAirconditioned,
      hasProjector,
      hasWhiteboard,
      isActive,
      unavailableTimeSlots,
      notes
    } = req.body;

    // Check if new room code conflicts
    if (roomCode && roomCode.toUpperCase() !== room.roomCode) {
      const existingRoom = await Room.findOne({ 
        roomCode: roomCode.toUpperCase() 
      });
      
      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: 'Room code already exists'
        });
      }
      room.roomCode = roomCode.toUpperCase();
    }

    // Update fields
    if (roomName) room.roomName = roomName;
    if (building) room.building = building;
    if (floor !== undefined) room.floor = floor;
    if (roomType) room.roomType = roomType;
    if (capacity !== undefined) room.capacity = capacity;
    if (facilities !== undefined) room.facilities = facilities;
    if (equipment !== undefined) room.equipment = equipment;
    if (isAirconditioned !== undefined) room.isAirconditioned = isAirconditioned;
    if (hasProjector !== undefined) room.hasProjector = hasProjector;
    if (hasWhiteboard !== undefined) room.hasWhiteboard = hasWhiteboard;
    if (isActive !== undefined) room.isActive = isActive;
    if (unavailableTimeSlots !== undefined) room.unavailableTimeSlots = unavailableTimeSlots;
    if (notes !== undefined) room.notes = notes;

    await room.save();

    res.status(200).json({
      success: true,
      message: 'Room updated successfully',
      data: room
    });

  } catch (error) {
    sendError(res, error, 'Error updating room');
  }
};

// @desc    Delete room (soft delete)
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    room.isActive = false;
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Room deactivated successfully'
    });

  } catch (error) {
    sendError(res, error, 'Error deleting room');
  }
};

// @desc    Get rooms by type
// @route   GET /api/rooms/type/:roomType
// @access  Private
exports.getRoomsByType = async (req, res) => {
  try {
    const { roomType } = req.params;

    const rooms = await Room.find({
      roomType,
      isActive: true
    }).sort({ capacity: -1 });

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });

  } catch (error) {
    sendError(res, error, 'Error fetching rooms');
  }
};

// @desc    Get available rooms (for specific capacity)
// @route   GET /api/rooms/available/:capacity
// @access  Private
exports.getAvailableRooms = async (req, res) => {
  try {
    const { capacity } = req.params;

    const rooms = await Room.find({
      capacity: { $gte: parseInt(capacity) },
      isActive: true
    }).sort({ capacity: 1 });

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });

  } catch (error) {
    sendError(res, error, 'Error fetching available rooms');
  }
};

// @desc    Get room statistics
// @route   GET /api/rooms/stats
// @access  Private
exports.getRoomStats = async (req, res) => {
  try {
    const stats = await Room.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$roomType',
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          avgCapacity: { $avg: '$capacity' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalStats = await Room.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: null,
          totalRooms: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          avgCapacity: { $avg: '$capacity' },
          withProjector: {
            $sum: { $cond: ['$hasProjector', 1, 0] }
          },
          withAircon: {
            $sum: { $cond: ['$isAirconditioned', 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        byType: stats,
        overall: totalStats[0] || {}
      }
    });

  } catch (error) {
    sendError(res, error, 'Error fetching room statistics');
  }
};
