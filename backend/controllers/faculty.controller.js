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


// @desc    Analyze faculty background compatibility with subject using AI
// @route   POST /api/faculty/:id/analyze-subject-compatibility
// @access  Private (Admin, Scheduling Officer, Program Manager, Faculty)
exports.analyzeFacultySubjectCompatibility = async (req, res) => {
  try {
    const { subjectCode, subjectName, subjectDescription } = req.body;

    if (!subjectCode || !subjectName) {
      return res.status(400).json({
        success: false,
        message: 'Subject code and name are required'
      });
    }

    const faculty = await Faculty.findById(req.params.id)
      .populate('user', 'firstName lastName email');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    // Use Gemini AI to analyze compatibility
    const geminiService = require('../services/gemini.service');
    
    // Build comprehensive faculty background for AI analysis
    const facultyBackground = {
      name: `${faculty.user.firstName} ${faculty.user.lastName}`,
      position: faculty.position,
      employmentType: faculty.employmentType,
      education: {
        bachelors: faculty.bachelorsDegree,
        masters: faculty.mastersDegree,
        doctoral: faculty.doctoralDegree
      },
      specializations: faculty.specializations,
      qualifiedPrograms: faculty.programs,
      specialTraining: faculty.specialTraining,
      administrativeDesignation: faculty.administrativeDesignation,
      researchInvolvement: faculty.researchInvolvement,
      extensionInvolvement: faculty.extensionInvolvement,
      productionInvolvement: faculty.productionInvolvement,
      experiencedSubjects: faculty.experiencedSubjects,
      teachingHistory: faculty.teachingHistory
    };

    const subjectInfo = {
      code: subjectCode,
      name: subjectName,
      description: subjectDescription || 'No description provided'
    };

    // Fetch all subjects from database for RAG context
    const Subject = require('../models/Subject.model');
    const allSubjects = await Subject.find({ isActive: true })
      .select('code name description program yearLevel semester units type')
      .lean();

    // Call AI analysis with RAG context
    const analysis = await geminiService.analyzeFacultySubjectCompatibility(
      facultyBackground,
      subjectInfo,
      allSubjects
    );

    res.status(200).json({
      success: true,
      data: {
        faculty: {
          id: faculty._id,
          name: `${faculty.user.firstName} ${faculty.user.lastName}`,
          employeeId: faculty.employeeId
        },
        subject: subjectInfo,
        analysis
      }
    });

  } catch (error) {
    console.error('Analyze faculty subject compatibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing faculty-subject compatibility',
      error: error.message
    });
  }
};

// @desc    Get AI-powered background summary for faculty
// @route   GET /api/faculty/:id/background-summary
// @access  Private (Admin, Scheduling Officer, Program Manager, Faculty)
exports.getFacultyBackgroundSummary = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('user', 'firstName lastName email');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    // Use Gemini AI to generate comprehensive background summary
    const geminiService = require('../services/gemini.service');
    
    const facultyBackground = {
      name: `${faculty.user.firstName} ${faculty.user.lastName}`,
      position: faculty.position,
      employmentType: faculty.employmentType,
      education: {
        bachelors: faculty.bachelorsDegree,
        masters: faculty.mastersDegree,
        doctoral: faculty.doctoralDegree
      },
      specializations: faculty.specializations,
      qualifiedPrograms: faculty.programs,
      specialTraining: faculty.specialTraining,
      administrativeDesignation: faculty.administrativeDesignation,
      researchInvolvement: faculty.researchInvolvement,
      extensionInvolvement: faculty.extensionInvolvement,
      productionInvolvement: faculty.productionInvolvement,
      experiencedSubjects: faculty.experiencedSubjects,
      teachingHistory: faculty.teachingHistory
    };

    const summary = await geminiService.generateFacultyBackgroundSummary(facultyBackground);

    res.status(200).json({
      success: true,
      data: {
        faculty: {
          id: faculty._id,
          name: `${faculty.user.firstName} ${faculty.user.lastName}`,
          employeeId: faculty.employeeId
        },
        summary
      }
    });

  } catch (error) {
    console.error('Get faculty background summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating faculty background summary',
      error: error.message
    });
  }
};

// @desc    Get all pending faculty accounts
// @route   GET /api/faculty/pending
// @access  Private (Admin/Program Manager)
exports.getPendingFaculty = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      role: 'faculty',
      isPending: true,
      isActive: false
    })
      .populate('facultyProfile')
      .select('-password')
      .sort({ pendingApprovalDate: -1 });

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers
    });

  } catch (error) {
    console.error('Get pending faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending faculty accounts',
      error: error.message
    });
  }
};

// @desc    Approve faculty account
// @route   PUT /api/faculty/:id/approve
// @access  Private (Admin/Program Manager)
exports.approveFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.user._id;

    const user = await User.findById(id).populate('facultyProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Faculty account not found'
      });
    }

    if (!user.isPending) {
      return res.status(400).json({
        success: false,
        message: 'This account is not pending approval'
      });
    }

    // Approve user account
    user.isPending = false;
    user.isActive = true;
    user.approvedBy = approverId;
    user.approvedAt = new Date();
    await user.save();

    // Activate faculty profile
    if (user.facultyProfile) {
      const faculty = await Faculty.findById(user.facultyProfile);
      if (faculty) {
        faculty.isActive = true;
        await faculty.save();
      }
    }

    // Log activity
    try {
      const ActivityLog = require('../models/ActivityLog.model');
      await ActivityLog.create({
        userId: approverId,
        action: 'approve',
        resource: 'faculty',
        resourceId: user._id,
        details: `Approved faculty account for ${user.fullName} (${user.email})`
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
      // Don't fail the approval if logging fails
    }

    res.status(200).json({
      success: true,
      message: `Faculty account for ${user.fullName} has been approved`,
      data: user
    });

  } catch (error) {
    console.error('Approve faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving faculty account',
      error: error.message
    });
  }
};

// @desc    Reject faculty account
// @route   PUT /api/faculty/:id/reject
// @access  Private (Admin/Program Manager)
exports.rejectFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const rejecterId = req.user._id;

    const user = await User.findById(id).populate('facultyProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Faculty account not found'
      });
    }

    if (!user.isPending) {
      return res.status(400).json({
        success: false,
        message: 'This account is not pending approval'
      });
    }

    // Mark as rejected
    user.isPending = false;
    user.isActive = false;
    user.rejectedBy = rejecterId;
    user.rejectedAt = new Date();
    user.rejectionReason = reason || 'No reason provided';
    await user.save();

    // Optionally delete the faculty profile or keep it inactive
    // For now, we'll keep it but mark as inactive
    if (user.facultyProfile) {
      const faculty = await Faculty.findById(user.facultyProfile);
      if (faculty) {
        faculty.isActive = false;
        await faculty.save();
      }
    }

    // Log activity
    try {
      const ActivityLog = require('../models/ActivityLog.model');
      await ActivityLog.create({
        userId: rejecterId,
        action: 'reject',
        resource: 'faculty',
        resourceId: user._id,
        details: `Rejected faculty account for ${user.fullName} (${user.email}). Reason: ${reason || 'None'}`
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
      // Don't fail the rejection if logging fails
    }

    res.status(200).json({
      success: true,
      message: `Faculty account for ${user.fullName} has been rejected`,
      data: user
    });

  } catch (error) {
    console.error('Reject faculty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting faculty account',
      error: error.message
    });
  }
};
