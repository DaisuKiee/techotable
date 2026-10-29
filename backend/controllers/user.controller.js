const User = require('../models/User.model');
const { sendError } = require('../middleware/error.middleware');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search } = req.query;

    // Build query
    let query = {};

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('facultyProfile')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    sendError(res, error, 'Error fetching users');
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('facultyProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    sendError(res, error, 'Error fetching user');
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, middleName, role, isActive } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (middleName !== undefined) user.middleName = middleName;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });

  } catch (error) {
    sendError(res, error, 'Error updating user');
  }
};

// @desc    Delete user (soft delete by deactivating)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Soft delete by deactivating
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    sendError(res, error, 'Error deleting user');
  }
};

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    const validRoles = ['admin', 'scheduling_officer', 'faculty', 'student'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const users = await User.find({ role, isActive: true })
      .select('-password')
      .populate('facultyProfile')
      .sort({ lastName: 1, firstName: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    sendError(res, error, 'Error fetching users by role');
  }
};

// @desc    Upload user avatar
// @route   POST /api/users/:id/avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is updating their own avatar or is admin
    if (user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this avatar'
      });
    }

    // Store avatar path (relative to uploads folder)
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    user.profilePicture = avatarPath;

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: updatedUser
    });

  } catch (error) {
    sendError(res, error, 'Error uploading avatar');
  }
};

// @desc    Delete user avatar
// @route   DELETE /api/users/:id/avatar
// @access  Private
exports.deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is deleting their own avatar or is admin
    if (user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this avatar'
      });
    }

    // Delete avatar file if exists
    if (user.profilePicture) {
      const fs = require('fs');
      const path = require('path');
      const avatarPath = path.join(__dirname, '..', user.profilePicture);
      
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    user.profilePicture = null;
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
      data: updatedUser
    });

  } catch (error) {
    sendError(res, error, 'Error deleting avatar');
  }
};
