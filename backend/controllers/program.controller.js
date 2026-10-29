const Program = require('../models/Program.model');
const { invalidateProgramCache } = require('../utils/programValidator');
const { sendError } = require('../middleware/error.middleware');

// @desc    Get all programs
// @route   GET /api/programs
// @access  Public
exports.getAllPrograms = async (req, res) => {
  try {
    const { isActive } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const programs = await Program.find(query).sort({ code: 1 });

    res.status(200).json({
      success: true,
      count: programs.length,
      data: programs
    });
  } catch (error) {
    sendError(res, error, 'Error fetching programs');
  }
};

// @desc    Get single program by ID
// @route   GET /api/programs/:id
// @access  Public
exports.getProgramById = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    res.status(200).json({
      success: true,
      data: program
    });
  } catch (error) {
    sendError(res, error, 'Error fetching program');
  }
};

// @desc    Create new program
// @route   POST /api/programs
// @access  Private (Admin only)
exports.createProgram = async (req, res) => {
  try {
    const { code, name, description, department, duration, isActive } = req.body;

    // Check if program code already exists
    const existingProgram = await Program.findOne({ code: code.toUpperCase() });
    if (existingProgram) {
      return res.status(400).json({
        success: false,
        message: `Program with code '${code}' already exists`
      });
    }

    const program = await Program.create({
      code: code.toUpperCase(),
      name,
      description,
      department: department || 'CoTE',
      duration: duration || 4,
      isActive: isActive !== false
    });

    invalidateProgramCache();

    res.status(201).json({
      success: true,
      message: 'Program created successfully',
      data: program
    });
  } catch (error) {
    sendError(res, error, 'Error creating program');
  }
};

// @desc    Update program
// @route   PUT /api/programs/:id
// @access  Private (Admin only)
exports.updateProgram = async (req, res) => {
  try {
    const { code, name, description, department, duration, isActive } = req.body;

    const program = await Program.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    // Check if code is being changed and if new code already exists
    if (code && code.toUpperCase() !== program.code) {
      const existingProgram = await Program.findOne({ code: code.toUpperCase() });
      if (existingProgram) {
        return res.status(400).json({
          success: false,
          message: `Program with code '${code}' already exists`
        });
      }
      program.code = code.toUpperCase();
    }

    if (name) program.name = name;
    if (description !== undefined) program.description = description;
    if (department) program.department = department;
    if (duration !== undefined) program.duration = duration;
    if (isActive !== undefined) program.isActive = isActive;

    await program.save();

    invalidateProgramCache();

    res.status(200).json({
      success: true,
      message: 'Program updated successfully',
      data: program
    });
  } catch (error) {
    sendError(res, error, 'Error updating program');
  }
};

// @desc    Delete program
// @route   DELETE /api/programs/:id
// @access  Private (Admin only)
exports.deleteProgram = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    await program.deleteOne();

    invalidateProgramCache();

    res.status(200).json({
      success: true,
      message: 'Program deleted successfully'
    });
  } catch (error) {
    sendError(res, error, 'Error deleting program');
  }
};
