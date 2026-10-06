const Student = require('../models/Student.model');
const User = require('../models/User.model');
const csv = require('csv-parser');
const fs = require('fs');
const { Readable } = require('stream');

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.getAllStudents = async (req, res) => {
  try {
    const { program, yearLevel, section, semester, academicYear, search, studentType } = req.query;
    
    const filter = {};
    // Program filter is automatically injected by middleware for program managers
    if (program) filter.program = program;
    if (yearLevel) filter.yearLevel = parseInt(yearLevel);
    if (section) filter.section = section;
    if (semester) filter.semester = parseInt(semester);
    if (academicYear) filter.academicYear = academicYear;
    if (studentType) filter.studentType = studentType;
    
    const students = await Student.find(filter)
      .populate('user', 'firstName lastName middleName email profilePicture')
      .populate('enrolledClasses', 'className section')
      .sort({ program: 1, yearLevel: 1, section: 1, studentId: 1 });
    
    // Apply search filter if provided
    let filteredStudents = students;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredStudents = students.filter(student => 
        student.studentId.toLowerCase().includes(searchLower) ||
        student.user.firstName.toLowerCase().includes(searchLower) ||
        student.user.lastName.toLowerCase().includes(searchLower) ||
        student.user.email.toLowerCase().includes(searchLower)
      );
    }
    
    res.status(200).json({
      success: true,
      count: filteredStudents.length,
      data: filteredStudents
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get current student profile
// @route   GET /api/students/profile
// @access  Private (Student only)
exports.getMyProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id })
      .populate('user', '-password')
      .populate('enrolledClasses');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', '-password')
      .populate('enrolledClasses');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin, Scheduling Officer)
exports.createStudent = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      middleName,
      studentId,
      program,
      yearLevel,
      section,
      studentType,
      academicYear,
      semester,
      contactNumber,
      address,
      guardianInfo,
      emergencyContact
    } = req.body;
    
    // Check if student ID already exists
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student ID already exists'
      });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Create user account
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      middleName,
      role: 'student',
      studentId,
      program,
      yearLevel,
      section
    });
    
    // Create student profile
    const student = await Student.create({
      user: user._id,
      studentId,
      program,
      yearLevel,
      section,
      studentType: studentType || 'regular',
      academicYear: academicYear || '2024-2025',
      semester: semester || 1,
      contactNumber,
      address,
      guardianInfo,
      emergencyContact,
      enrollmentStatus: 'enrolled'
    });
    
    const populatedStudent = await Student.findById(student._id)
      .populate('user', '-password');
    
    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: populatedStudent
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    const allowedUpdates = [
      'program', 'yearLevel', 'section', 'studentType', 'academicYear', 'semester',
      'contactNumber', 'address', 'guardianInfo', 'emergencyContact', 'enrollmentStatus', 'gpa', 'notes',
      'sectionCode', 'subjectCodes'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });
    
    await student.save();
    
    // Update user info if provided
    if (req.body.firstName || req.body.lastName || req.body.middleName || req.body.email) {
      const user = await User.findById(student.user);
      if (user) {
        if (req.body.firstName) user.firstName = req.body.firstName;
        if (req.body.lastName) user.lastName = req.body.lastName;
        if (req.body.middleName) user.middleName = req.body.middleName;
        if (req.body.email) user.email = req.body.email;
        if (req.body.phoneNumber) user.phoneNumber = req.body.phoneNumber;
        if (req.body.bio) user.bio = req.body.bio;
        await user.save();
      }
    }
    
    const updatedStudent = await Student.findById(student._id)
      .populate('user', '-password')
      .populate('enrolledClasses');
    
    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin)
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Soft delete user account
    await User.findByIdAndUpdate(student.user, { isActive: false });
    
    // Delete student profile
    await Student.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Bulk import students from CSV
// @route   POST /api/students/bulk-import
// @access  Private (Admin, Scheduling Officer)
exports.bulkImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV file'
      });
    }
    
    const students = [];
    const errors = [];
    const csvBuffer = req.file.buffer.toString();
    
    // Parse CSV
    const stream = Readable.from(csvBuffer);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          students.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    const results = {
      success: [],
      failed: []
    };
    
    // Process each student
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      
      try {
        // Validate required fields
        if (!studentData.studentId || !studentData.email || !studentData.firstName || 
            !studentData.lastName || !studentData.program) {
          results.failed.push({
            row: i + 2,
            studentId: studentData.studentId || 'N/A',
            error: 'Missing required fields'
          });
          continue;
        }
        
        // Check if student already exists
        const existing = await Student.findOne({ studentId: studentData.studentId });
        if (existing) {
          results.failed.push({
            row: i + 2,
            studentId: studentData.studentId,
            error: 'Student ID already exists'
          });
          continue;
        }
        
        // Create user account
        const user = await User.create({
          email: studentData.email,
          password: studentData.password || 'student123', // Default password
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          middleName: studentData.middleName || '',
          role: 'student',
          studentId: studentData.studentId,
          program: studentData.program,
          yearLevel: parseInt(studentData.yearLevel) || 1,
          section: studentData.section || 'A'
        });
        
        // Create student profile
        const student = await Student.create({
          user: user._id,
          studentId: studentData.studentId,
          program: studentData.program,
          yearLevel: parseInt(studentData.yearLevel) || 1,
          section: studentData.section || 'A',
          studentType: studentData.studentType || 'regular',
          academicYear: studentData.academicYear || '2024-2025',
          semester: parseInt(studentData.semester) || 1,
          contactNumber: studentData.contactNumber,
          enrollmentStatus: 'enrolled'
        });
        
        results.success.push({
          row: i + 2,
          studentId: studentData.studentId,
          name: `${studentData.firstName} ${studentData.lastName}`
        });
      } catch (error) {
        results.failed.push({
          row: i + 2,
          studentId: studentData.studentId || 'N/A',
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Imported ${results.success.length} students. ${results.failed.length} failed.`,
      data: results
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get student statistics
// @route   GET /api/students/stats
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.getStats = async (req, res) => {
  try {
    // Build filter based on user role (program filter injected by middleware in req.query)
    const filter = {};
    if (req.query.program) {
      filter.program = req.query.program;
    }

    const totalStudents = await Student.countDocuments(filter);
    
    const byProgram = await Student.aggregate([
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $group: { _id: '$program', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    const byYearLevel = await Student.aggregate([
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $group: { _id: '$yearLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    const byStatus = await Student.aggregate([
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $group: { _id: '$enrollmentStatus', count: { $sum: 1 } } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        total: totalStudents,
        byProgram,
        byYearLevel,
        byStatus
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Assign section code to student
// @route   PUT /api/students/:id/assign-section
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.assignSectionCode = async (req, res) => {
  try {
    const { sectionCode, studentType } = req.body;
    
    if (!sectionCode) {
      return res.status(400).json({
        success: false,
        message: 'Section code is required'
      });
    }
    
    const student = await Student.findById(req.params.id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Update student with section code
    student.sectionCode = sectionCode.toUpperCase();
    student.studentType = studentType || student.studentType;
    student.enrollmentStatus = 'enrolled'; // Mark as enrolled when section is assigned
    
    await student.save();
    
    const updatedStudent = await Student.findById(student._id)
      .populate('user', '-password');
    
    res.status(200).json({
      success: true,
      message: 'Section code assigned successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Assign section code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = exports;
