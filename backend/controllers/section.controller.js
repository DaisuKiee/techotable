const Section = require('../models/Section.model');
const ClassSpace = require('../models/ClassSpace.model');

// @desc    Get all sections
// @route   GET /api/sections
// @access  Private
exports.getAllSections = async (req, res) => {
  try {
    const { program, yearLevel, shift, academicYear, semester, isActive } = req.query;
    
    const query = {};
    if (program) query.program = program;
    if (yearLevel) query.yearLevel = parseInt(yearLevel);
    if (shift) query.shift = shift;
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester);
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const sections = await Section.find(query)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      })
      .sort({ program: 1, yearLevel: 1, sectionLetter: 1 });

    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sections',
      error: error.message
    });
  }
};

// @desc    Get section by ID
// @route   GET /api/sections/:id
// @access  Private
exports.getSectionById = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      });

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    res.status(200).json({
      success: true,
      data: section
    });
  } catch (error) {
    console.error('Get section error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching section',
      error: error.message
    });
  }
};

// @desc    Create new section
// @route   POST /api/sections
// @access  Private (Admin, Scheduling Officer)
exports.createSection = async (req, res) => {
  try {
    const { program, yearLevel, sectionLetter, shift, academicYear, semester, maxStudents, adviser, description } = req.body;

    // Validate that faculty can only have one advisory role
    if (adviser && adviser !== '') {
      const existingAdvisory = await Section.findOne({ 
        adviser: adviser,
        isActive: true 
      });
      
      if (existingAdvisory) {
        return res.status(400).json({
          success: false,
          message: `This faculty is already assigned as adviser to section ${existingAdvisory.sectionCode}. Each faculty can only advise one section.`
        });
      }
    }

    // Auto-generate section code: PROGRAM-YEAR-LETTER-SHIFT
    const sectionCode = `${program}-${yearLevel}${sectionLetter}-${shift.substring(0, 1)}`;

    // Check if section already exists
    const existingSection = await Section.findOne({ sectionCode });
    if (existingSection) {
      return res.status(400).json({
        success: false,
        message: `Section ${sectionCode} already exists`
      });
    }

    // Generate unique enrollment code
    let enrollmentCode;
    let isUnique = false;
    const section = new Section({
      sectionCode,
      program,
      yearLevel,
      sectionLetter,
      shift,
      academicYear,
      semester,
      maxStudents: maxStudents || 40,
      adviser: adviser && adviser !== '' ? adviser : null,
      description: description || ''
    });

    // Keep generating until we get a unique code
    while (!isUnique) {
      enrollmentCode = section.generateEnrollmentCode();
      const existing = await Section.findOne({ enrollmentCode });
      if (!existing) {
        isUnique = true;
      }
    }

    section.enrollmentCode = enrollmentCode;
    await section.save();

    // No ClassSpace is created here on purpose.
    // A ClassSpace represents one SUBJECT offering, so spaces are created from
    // schedules (see classSpace.controller.ensureClassSpaceForSchedule). The
    // section's enrollmentCode above is the single code regular students use to
    // join, which then enrolls them in every subject of the section.

    const populatedSection = await Section.findById(section._id)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data: populatedSection
    });
  } catch (error) {
    console.error('Create section error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: 'Error creating section',
      error: error.message
    });
  }
};

// @desc    Update section
// @route   PUT /api/sections/:id
// @access  Private (Admin, Scheduling Officer)
exports.updateSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    const { program, yearLevel, sectionLetter, shift, academicYear, semester, maxStudents, adviser, description, isActive, currentStudents } = req.body;

    // Validate that faculty can only have one advisory role
    // Only check if adviser is being changed and is not empty
    if (adviser !== undefined && adviser !== '' && adviser !== null) {
      // Check if this is a different adviser than the current one
      const currentAdviserId = section.adviser?.toString();
      const newAdviserId = adviser.toString();
      
      if (currentAdviserId !== newAdviserId) {
        const existingAdvisory = await Section.findOne({ 
          adviser: adviser,
          _id: { $ne: section._id }, // Exclude current section
          isActive: true 
        });
        
        if (existingAdvisory) {
          return res.status(400).json({
            success: false,
            message: `This faculty is already assigned as adviser to section ${existingAdvisory.sectionCode}. Each faculty can only advise one section.`
          });
        }
      }
    }

    // Update fields
    if (program) section.program = program;
    if (yearLevel) section.yearLevel = yearLevel;
    if (sectionLetter) section.sectionLetter = sectionLetter;
    if (shift) section.shift = shift;
    if (academicYear) section.academicYear = academicYear;
    if (semester) section.semester = semester;
    if (maxStudents !== undefined) section.maxStudents = maxStudents;
    if (adviser !== undefined) section.adviser = adviser && adviser !== '' ? adviser : null;
    if (description !== undefined) section.description = description;
    if (isActive !== undefined) section.isActive = isActive;
    if (currentStudents !== undefined) section.currentStudents = currentStudents;

    // Regenerate section code if key fields changed
    if (program || yearLevel || sectionLetter || shift) {
      section.sectionCode = `${section.program}-${section.yearLevel}${section.sectionLetter}-${section.shift.substring(0, 1)}`;
    }

    await section.save();

    const updatedSection = await Section.findById(section._id)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      });

    res.status(200).json({
      success: true,
      message: 'Section updated successfully',
      data: updatedSection
    });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating section',
      error: error.message
    });
  }
};

// @desc    Delete section
// @route   DELETE /api/sections/:id
// @access  Private (Admin, Scheduling Officer)
exports.deleteSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    await section.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting section',
      error: error.message
    });
  }
};

// @desc    Get sections by program and year
// @route   GET /api/sections/program/:program/year/:year
// @access  Private
exports.getSectionsByProgramAndYear = async (req, res) => {
  try {
    const { program, year } = req.params;
    const { shift } = req.query;

    const query = {
      program: program.toUpperCase(),
      yearLevel: parseInt(year),
      isActive: true
    };

    if (shift) {
      query.shift = shift;
    }

    const sections = await Section.find(query)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      })
      .sort({ sectionLetter: 1 });

    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('Get sections by program and year error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sections',
      error: error.message
    });
  }
};

// @desc    Get section statistics
// @route   GET /api/sections/stats
// @access  Private
exports.getSectionStats = async (req, res) => {
  try {
    const totalSections = await Section.countDocuments({ isActive: true });
    const daySections = await Section.countDocuments({ isActive: true, shift: 'Day' });
    const nightSections = await Section.countDocuments({ isActive: true, shift: 'Night' });

    // Get sections by program
    const sectionsByProgram = await Section.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$program', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Get sections by shift
    const sectionsByShift = await Section.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$shift', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalSections,
        day: daySections,
        night: nightSections,
        byProgram: sectionsByProgram,
        byShift: sectionsByShift
      }
    });
  } catch (error) {
    console.error('Get section stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching section statistics',
      error: error.message
    });
  }
};

// @desc    Regenerate enrollment code for a section
// @route   PUT /api/sections/:id/regenerate-code
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.regenerateEnrollmentCode = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Generate new unique enrollment code
    let enrollmentCode;
    let isUnique = false;

    while (!isUnique) {
      enrollmentCode = section.generateEnrollmentCode();
      const existing = await Section.findOne({ 
        enrollmentCode,
        _id: { $ne: section._id }
      });
      if (!existing) {
        isUnique = true;
      }
    }

    section.enrollmentCode = enrollmentCode;
    await section.save();

    const updatedSection = await Section.findById(section._id)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      });

    res.status(200).json({
      success: true,
      message: 'Enrollment code regenerated successfully',
      data: updatedSection
    });
  } catch (error) {
    console.error('Regenerate enrollment code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error regenerating enrollment code',
      error: error.message
    });
  }
};
