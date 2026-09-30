const Subject = require('../models/Subject.model');
const { validationResult } = require('express-validator');

// @desc    Get all subjects
// @route   GET /api/subjects
// @access  Private
exports.getAllSubjects = async (req, res) => {
  try {
    const { 
      program, 
      yearLevel, 
      semester, 
      isActive, 
      search 
    } = req.query;

    // Build query
    let query = {};

    if (program) {
      query.program = program;
    }

    if (yearLevel) {
      query.yearLevel = parseInt(yearLevel);
    }

    if (semester) {
      query.semester = parseInt(semester);
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { subjectCode: { $regex: search, $options: 'i' } },
        { subjectName: { $regex: search, $options: 'i' } }
      ];
    }

    const subjects = await Subject.find(query)
      .populate('prerequisites', 'subjectCode subjectName')
      .sort({ program: 1, yearLevel: 1, semester: 1, subjectCode: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });

  } catch (error) {
    console.error('Get all subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
};

// @desc    Get subject by ID
// @route   GET /api/subjects/:id
// @access  Private
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('prerequisites', 'subjectCode subjectName units');

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.status(200).json({
      success: true,
      data: subject
    });

  } catch (error) {
    console.error('Get subject by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subject',
      error: error.message
    });
  }
};

// @desc    Create new subject
// @route   POST /api/subjects
// @access  Private/Admin
exports.createSubject = async (req, res) => {
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
      subjectCode,
      subjectName,
      description,
      units,
      lectureHours,
      labHours,
      program,
      yearLevel,
      semester,
      prerequisites,
      requiredQualifications
    } = req.body;

    // Check if subject code already exists
    const existingSubject = await Subject.findOne({ 
      subjectCode: subjectCode.toUpperCase() 
    });
    
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject with this code already exists'
      });
    }

    // Verify prerequisites exist
    if (prerequisites && prerequisites.length > 0) {
      const prereqCount = await Subject.countDocuments({
        _id: { $in: prerequisites }
      });
      
      if (prereqCount !== prerequisites.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more prerequisite subjects not found'
        });
      }
    }

    // Create subject
    const subject = await Subject.create({
      subjectCode: subjectCode.toUpperCase(),
      subjectName,
      description,
      units,
      lectureHours,
      labHours: labHours || 0,
      program,
      yearLevel,
      semester,
      prerequisites: prerequisites || [],
      requiredQualifications: requiredQualifications || []
    });

    await subject.populate('prerequisites', 'subjectCode subjectName');

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: subject
    });

  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subject',
      error: error.message
    });
  }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
exports.updateSubject = async (req, res) => {
  try {
    const {
      subjectCode,
      subjectName,
      description,
      units,
      lectureHours,
      labHours,
      program,
      yearLevel,
      semester,
      prerequisites,
      requiredQualifications,
      isActive
    } = req.body;

    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check if new subject code conflicts
    if (subjectCode && subjectCode.toUpperCase() !== subject.subjectCode) {
      const existingSubject = await Subject.findOne({ 
        subjectCode: subjectCode.toUpperCase() 
      });
      
      if (existingSubject) {
        return res.status(400).json({
          success: false,
          message: 'Subject code already exists'
        });
      }
      subject.subjectCode = subjectCode.toUpperCase();
    }

    // Verify prerequisites if provided
    if (prerequisites && prerequisites.length > 0) {
      const prereqCount = await Subject.countDocuments({
        _id: { $in: prerequisites }
      });
      
      if (prereqCount !== prerequisites.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more prerequisite subjects not found'
        });
      }
    }

    // Update fields
    if (subjectName) subject.subjectName = subjectName;
    if (description !== undefined) subject.description = description;
    if (units !== undefined) subject.units = units;
    if (lectureHours !== undefined) subject.lectureHours = lectureHours;
    if (labHours !== undefined) subject.labHours = labHours;
    if (program) subject.program = program;
    if (yearLevel !== undefined) subject.yearLevel = yearLevel;
    if (semester !== undefined) subject.semester = semester;
    if (prerequisites !== undefined) subject.prerequisites = prerequisites;
    if (requiredQualifications !== undefined) subject.requiredQualifications = requiredQualifications;
    if (isActive !== undefined) subject.isActive = isActive;

    await subject.save();
    await subject.populate('prerequisites', 'subjectCode subjectName');

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: subject
    });

  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subject',
      error: error.message
    });
  }
};

// @desc    Delete subject (soft delete)
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Soft delete by deactivating
    subject.isActive = false;
    await subject.save();

    res.status(200).json({
      success: true,
      message: 'Subject deactivated successfully'
    });

  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting subject',
      error: error.message
    });
  }
};

// @desc    Get subjects by program and year level
// @route   GET /api/subjects/curriculum/:program/:yearLevel
// @access  Private
exports.getSubjectsByProgramAndYear = async (req, res) => {
  try {
    const { program, yearLevel } = req.params;

    const subjects = await Subject.find({
      program,
      yearLevel: parseInt(yearLevel),
      isActive: true
    })
    .populate('prerequisites', 'subjectCode subjectName')
    .sort({ semester: 1, subjectCode: 1 });

    // Group by semester
    const bySemester = {
      semester1: subjects.filter(s => s.semester === 1),
      semester2: subjects.filter(s => s.semester === 2)
    };

    res.status(200).json({
      success: true,
      program,
      yearLevel: parseInt(yearLevel),
      totalSubjects: subjects.length,
      data: bySemester
    });

  } catch (error) {
    console.error('Get subjects by program and year error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
};

// @desc    Get subject statistics
// @route   GET /api/subjects/stats
// @access  Private
exports.getSubjectStats = async (req, res) => {
  try {
    // Build filter based on user role (program filter injected by middleware)
    const filter = { isActive: true };
    if (req.query.program) {
      filter.program = req.query.program;
    }

    const stats = await Subject.aggregate([
      {
        $match: filter
      },
      {
        $group: {
          _id: '$program',
          totalSubjects: { $sum: 1 },
          totalUnits: { $sum: '$units' },
          totalLectureHours: { $sum: '$lectureHours' },
          totalLabHours: { $sum: '$labHours' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalStats = await Subject.aggregate([
      {
        $match: filter
      },
      {
        $group: {
          _id: null,
          totalSubjects: { $sum: 1 },
          totalUnits: { $sum: '$units' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        byProgram: stats,
        overall: totalStats[0] || { totalSubjects: 0, totalUnits: 0 }
      }
    });

  } catch (error) {
    console.error('Get subject stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subject statistics',
      error: error.message
    });
  }
};

// @desc    Bulk import subjects
// @route   POST /api/subjects/bulk-import
// @access  Private/Admin
exports.bulkImportSubjects = async (req, res) => {
  try {
    const { subjects } = req.body;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of subjects'
      });
    }

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const subjectData of subjects) {
      try {
        // Check if subject already exists
        const existing = await Subject.findOne({ 
          subjectCode: subjectData.subjectCode.toUpperCase() 
        });
        
        if (existing) {
          results.skipped.push({
            subjectCode: subjectData.subjectCode,
            reason: 'Already exists'
          });
          continue;
        }

        // Create subject
        const subject = await Subject.create({
          ...subjectData,
          subjectCode: subjectData.subjectCode.toUpperCase()
        });

        results.success.push({
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName
        });

      } catch (error) {
        results.failed.push({
          subjectCode: subjectData.subjectCode,
          reason: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bulk import completed',
      data: {
        total: subjects.length,
        imported: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results
      }
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk import',
      error: error.message
    });
  }
};

// @desc    Get subjects by qualification requirement
// @route   GET /api/subjects/qualification/:qualification
// @access  Private
exports.getSubjectsByQualification = async (req, res) => {
  try {
    const { qualification } = req.params;

    const subjects = await Subject.find({
      requiredQualifications: { $in: [qualification] },
      isActive: true
    })
    .populate('prerequisites', 'subjectCode subjectName')
    .sort({ program: 1, yearLevel: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });

  } catch (error) {
    console.error('Get subjects by qualification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
};

// @desc    Generate a unique subject code
// @route   POST /api/subjects/generate-code
// @access  Private (staff only)
exports.generateSubjectCode = async (req, res) => {
  try {
    const code = await Subject.generateUniqueSubjectCode();
    res.status(200).json({
      success: true,
      data: { subjectCode: code }
    });
  } catch (error) {
    console.error('Generate subject code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating subject code',
      error: error.message
    });
  }
};
