const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');

// Import models
const User = require('../models/User.model');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const ClassSpace = require('../models/ClassSpace.model');
const Student = require('../models/Student.model');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics (counts only, no full data)
// @access  Private (Admin, Scheduling Officer, Program Manager)
router.get(
  '/stats',
  protect,
  authorize('admin', 'scheduling_officer', 'program_manager'),
  async (req, res) => {
    try {
      // Use countDocuments() instead of find().length for better performance
      const [
        totalUsers,
        activeUsers,
        totalFaculty,
        activeFaculty,
        totalSubjects,
        totalRooms,
        totalSchedules,
        publishedSchedules,
        totalClasses,
        totalStudents,
        programStudents
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Faculty.countDocuments(),
        Faculty.countDocuments({ isActive: true }),
        Subject.countDocuments(),
        Room.countDocuments(),
        Schedule.countDocuments(),
        Schedule.countDocuments({ isPublished: true }),
        ClassSpace.countDocuments(),
        Student.countDocuments(),
        // Program-specific count for program managers
        req.user.role === 'program_manager' && req.user.program
          ? Student.countDocuments({ program: req.user.program })
          : 0
      ]);

      // Calculate inactive users
      const inactiveUsers = totalUsers - activeUsers;

      // Get program breakdown for program managers
      let programByYear = [];
      let programBySemester = [];
      
      if (req.user.role === 'program_manager' && req.user.program) {
        // Get year level distribution
        const yearAggregation = await Student.aggregate([
          { $match: { program: req.user.program } },
          {
            $project: {
              year: {
                $regexFind: { input: '$sectionCode', regex: /-(\d+)[A-Z]/ }
              }
            }
          },
          {
            $group: {
              _id: { $arrayElemAt: ['$year.captures', 0] },
              count: { $sum: 1 }
            }
          }
        ]);

        programByYear = yearAggregation.map(item => ({
          year: item._id || 'Unknown',
          count: item.count
        }));

        // Get semester distribution
        const semesterAggregation = await Student.aggregate([
          { $match: { program: req.user.program } },
          {
            $group: {
              _id: '$semester',
              count: { $sum: 1 }
            }
          }
        ]);

        programBySemester = semesterAggregation.map(item => ({
          semester: item._id,
          count: item.count
        }));
      }

      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          totalFaculty,
          activeFaculty,
          totalSubjects,
          totalRooms,
          totalSchedules,
          publishedSchedules,
          totalClasses,
          // Program manager specific
          programStudents,
          programSubjects: req.user.role === 'program_manager' && req.user.program
            ? await Subject.countDocuments({ program: req.user.program })
            : 0,
          programSchedules: req.user.role === 'program_manager' && req.user.program
            ? await Schedule.countDocuments({ program: req.user.program })
            : 0,
          programByYear,
          programBySemester
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard statistics',
        error: error.message
      });
    }
  }
);

module.exports = router;
