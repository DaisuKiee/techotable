const Faculty = require('../models/Faculty.model');
const User = require('../models/User.model');
const { validationResult } = require('express-validator');

// @desc    Get all faculty members
// @route   GET /api/faculty
// @access  Private
exports.getAllFaculty = async (req, res) => {
  try {
    const { 
      department, 
      isActive, 
      search, 
      specialization,
      program,
      minLoad,
      maxLoad 
    } = req.query;

    // Build query
    let query = {};

    if (department) {
      query.department = department;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (specialization) {
      query.specializations = { $in: [specialization] };
    }

    // Filter by program: only faculty who can teach in this program, meaning
    // they are either qualified for it or have taught it before.
    if (program) {
      query.$or = [
        { programs: program },
        { 'teachingHistory.program': program },
      ];
    }

    // Load filtering
    if (minLoad !== undefined || maxLoad !== undefined) {
      query.currentLoad = {};
      if (minLoad !== undefined) query.currentLoad.$gte = parseInt(minLoad);
      if (maxLoad !== undefined) query.currentLoad.$lte = parseInt(maxLoad);
    }

    let faculty = await Faculty.find(query)
      .populate('user', 'firstName lastName middleName email profilePicture')
      .sort({ createdAt: -1 });

    // Search by name (after population)
    if (search) {
      faculty = faculty.filter(f => {
        const fullName = `${f.user.firstName} ${f.user.middleName || ''} ${f.user.lastName}`.toLowerCase();
        const searchLower = search.toLowerCase();
        return fullName.includes(searchLower) || 
               f.employeeId.toLowerCase().includes(searchLower);
      });
    }

    res.status(200).json({
      success: true,
      count: faculty.length,
      data: faculty
    });

  } catch (error) {
    console.error('Get all faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching faculty members',
      error: error.message
    });
  }
};

// @desc    Get single faculty by ID
// @route   GET /api/faculty/:id
// @access  Private
exports.getFacultyById = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('user', 'firstName lastName middleName email profilePicture contactNumber');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: faculty
    });

  } catch (error) {
    console.error('Get faculty by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching faculty member',
      error: error.message
    });
  }
};

// @desc    Create new faculty member
// @route   POST /api/faculty
// @access  Private/Admin
exports.createFaculty = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      middleName,
      employeeId,
      department,
      position,
      qualifications,
      specializations,
      maxTeachingLoad,
      preferredTimeSlots,
      unavailableTimeSlots,
      contactNumber
    } = req.body;

    // Check if employee ID already exists
    const existingFaculty = await Faculty.findOne({ employeeId });
    if (existingFaculty) {
      return res.status(400).json({
        success: false,
        message: 'Faculty with this employee ID already exists'
      });
    }

    // Check if user with email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user account
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      role: 'faculty',
      firstName,
      lastName,
      middleName
    });

    // Create faculty profile
    const faculty = await Faculty.create({
      user: user._id,
      employeeId,
      department: department || 'CoTE',
      position,
      qualifications: qualifications || [],
      specializations: specializations || [],
      maxTeachingLoad: maxTeachingLoad || 24,
      currentLoad: 0,
      preferredTimeSlots: preferredTimeSlots || [],
      unavailableTimeSlots: unavailableTimeSlots || [],
      contactNumber
    });

    // Link faculty profile to user
    user.facultyProfile = faculty._id;
    await user.save();

    // Populate user data in response
    await faculty.populate('user', 'firstName lastName middleName email');

    res.status(201).json({
      success: true,
      message: 'Faculty member created successfully',
      data: faculty
    });

  } catch (error) {
    console.error('Create faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating faculty member',
      error: error.message
    });
  }
};

// @desc    Update faculty member
// @route   PUT /api/faculty/:id
// @access  Private/Admin
exports.updateFaculty = async (req, res) => {
  try {
    const {
      employeeId,
      department,
      position,
      qualifications,
      specializations,
      programs,
      experiencedSubjects,
      maxTeachingHours,
      maxTeachingLoad,
      preferredTimeSlots,
      unavailableTimeSlots,
      contactNumber,
      isActive
    } = req.body;

    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    // If user is faculty role, they can only update their own profile
    if (req.user.role === 'faculty') {
      const userFacultyId = req.user.facultyProfile?._id || req.user.facultyProfile;
      if (userFacultyId.toString() !== req.params.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own profile'
        });
      }
    }

    // Check if new employee ID conflicts
    if (employeeId && employeeId !== faculty.employeeId) {
      const existingFaculty = await Faculty.findOne({ employeeId });
      if (existingFaculty) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists'
        });
      }
      faculty.employeeId = employeeId;
    }

    // Update fields
    if (department) faculty.department = department;
    if (position) faculty.position = position;
    if (qualifications) faculty.qualifications = qualifications;
    if (specializations) faculty.specializations = specializations;
    if (programs) faculty.programs = programs;
    if (experiencedSubjects) faculty.experiencedSubjects = experiencedSubjects;
    if (maxTeachingHours !== undefined) faculty.maxTeachingHours = maxTeachingHours;
    if (maxTeachingLoad !== undefined) faculty.maxTeachingLoad = maxTeachingLoad;
    if (preferredTimeSlots) faculty.preferredTimeSlots = preferredTimeSlots;
    if (unavailableTimeSlots) faculty.unavailableTimeSlots = unavailableTimeSlots;
    if (contactNumber !== undefined) faculty.contactNumber = contactNumber;
    if (isActive !== undefined) faculty.isActive = isActive;

    await faculty.save();
    await faculty.populate('user', 'firstName lastName middleName email');

    res.status(200).json({
      success: true,
      message: 'Faculty member updated successfully',
      data: faculty
    });

  } catch (error) {
    console.error('Update faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating faculty member',
      error: error.message
    });
  }
};

// @desc    Delete faculty member (soft delete)
// @route   DELETE /api/faculty/:id
// @access  Private/Admin
exports.deleteFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    // Soft delete by deactivating
    faculty.isActive = false;
    await faculty.save();

    // Also deactivate user account
    const user = await User.findById(faculty.user);
    if (user) {
      user.isActive = false;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Faculty member deactivated successfully'
    });

  } catch (error) {
    console.error('Delete faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting faculty member',
      error: error.message
    });
  }
};

// @desc    Add qualification to faculty
// @route   POST /api/faculty/:id/qualifications
// @access  Private/Admin
exports.addQualification = async (req, res) => {
  try {
    const { degree, field, institution, yearObtained } = req.body;

    if (!degree || !field) {
      return res.status(400).json({
        success: false,
        message: 'Degree and field are required'
      });
    }

    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    faculty.qualifications.push({
      degree,
      field,
      institution,
      yearObtained
    });

    await faculty.save();
    await faculty.populate('user', 'firstName lastName middleName email');

    res.status(200).json({
      success: true,
      message: 'Qualification added successfully',
      data: faculty
    });

  } catch (error) {
    console.error('Add qualification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding qualification',
      error: error.message
    });
  }
};

// @desc    Add teaching history entry
// @route   POST /api/faculty/:id/teaching-history
// @access  Private/Admin
exports.addTeachingHistory = async (req, res) => {
  try {
    const { 
      subjectCode, 
      subjectName, 
      semester, 
      academicYear, 
      program,
      rating 
    } = req.body;

    if (!subjectCode || !subjectName || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Subject code, name, semester, and academic year are required'
      });
    }

    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    faculty.teachingHistory.push({
      subjectCode,
      subjectName,
      semester,
      academicYear,
      program,
      rating
    });

    await faculty.save();
    await faculty.populate('user', 'firstName lastName middleName email');

    res.status(200).json({
      success: true,
      message: 'Teaching history added successfully',
      data: faculty
    });

  } catch (error) {
    console.error('Add teaching history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding teaching history',
      error: error.message
    });
  }
};

// @desc    Get faculty workload statistics
// @route   GET /api/faculty/:id/workload
// @access  Private
exports.getFacultyWorkload = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('user', 'firstName lastName middleName');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    const workloadPercentage = (faculty.currentLoad / faculty.maxTeachingLoad) * 100;
    const remainingLoad = faculty.maxTeachingLoad - faculty.currentLoad;

    res.status(200).json({
      success: true,
      data: {
        facultyName: faculty.user.firstName + ' ' + faculty.user.lastName,
        employeeId: faculty.employeeId,
        currentLoad: faculty.currentLoad,
        maxTeachingLoad: faculty.maxTeachingLoad,
        remainingLoad,
        workloadPercentage: workloadPercentage.toFixed(2),
        status: workloadPercentage >= 100 ? 'overloaded' : 
                workloadPercentage >= 80 ? 'near_capacity' : 'available'
      }
    });

  } catch (error) {
    console.error('Get faculty workload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching faculty workload',
      error: error.message
    });
  }
};

// @desc    Get faculty by specialization
// @route   GET /api/faculty/specialization/:specialization
// @access  Private
exports.getFacultyBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;

    const faculty = await Faculty.find({
      specializations: { $in: [specialization] },
      isActive: true
    })
    .populate('user', 'firstName lastName middleName email')
    .sort({ currentLoad: 1 }); // Sort by load (lowest first)

    res.status(200).json({
      success: true,
      count: faculty.length,
      data: faculty
    });

  } catch (error) {
    console.error('Get faculty by specialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching faculty by specialization',
      error: error.message
    });
  }
};

// @desc    Get available faculty (not at max load)
// @route   GET /api/faculty/available
// @access  Private
exports.getAvailableFaculty = async (req, res) => {
  try {
    const { program } = req.query;

    const query = {
      isActive: true,
      $expr: { $lt: ['$currentLoad', '$maxTeachingLoad'] }
    };

    // Restrict to faculty qualified for (or previously teaching) this program.
    // For program managers this is injected by checkProgramAccess.
    if (program) {
      query.$or = [
        { programs: program },
        { 'teachingHistory.program': program },
      ];
    }

    const faculty = await Faculty.find(query)
    .populate('user', 'firstName lastName middleName email')
    .sort({ currentLoad: 1 });

    res.status(200).json({
      success: true,
      count: faculty.length,
      data: faculty
    });

  } catch (error) {
    console.error('Get available faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available faculty',
      error: error.message
    });
  }
};

// @desc    Update faculty current load
// @route   PUT /api/faculty/:id/load
// @access  Private/Admin
exports.updateFacultyLoad = async (req, res) => {
  try {
    const { loadChange } = req.body;

    if (loadChange === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Load change value is required'
      });
    }

    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    faculty.currentLoad += loadChange;

    // Prevent negative load
    if (faculty.currentLoad < 0) {
      faculty.currentLoad = 0;
    }

    await faculty.save();
    await faculty.populate('user', 'firstName lastName middleName email');

    res.status(200).json({
      success: true,
      message: 'Faculty load updated successfully',
      data: faculty
    });

  } catch (error) {
    console.error('Update faculty load error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating faculty load',
      error: error.message
    });
  }
};
