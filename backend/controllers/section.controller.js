const Section = require('../models/Section.model');
const ClassSpace = require('../models/ClassSpace.model');
const Room = require('../models/Room.model');
const { sendError } = require('../middleware/error.middleware');
const { checkHomeRoom, pickHomeRoom, assignMissingHomeRooms, moveSectionClasses } = require('../services/homeRoom.service');
const { managerProgram } = require('../utils/programScope');

/** Add `homeRoom` ({ _id, roomCode, roomName, capacity, roomType, isActive }) to plain section objects. */
const attachHomeRooms = async (sections) => {
  const ids = [...new Set(sections.map(s => s.room).filter(id => /^[a-f\d]{24}$/i.test(String(id || ''))))];
  if (ids.length === 0) return sections;
  const rooms = new Map((await Room.find({ _id: { $in: ids } }).select('roomCode roomName capacity roomType building floor isActive').lean())
    .map(r => [String(r._id), r]));
  sections.forEach(s => { s.homeRoom = rooms.get(String(s.room)) || null; });
  return sections;
};

// @desc    Get all sections
// @route   GET /api/sections
// @access  Private
exports.getAllSections = async (req, res) => {
  try {
    const { program, yearLevel, shift, academicYear, semester, isActive, lightweight } = req.query;
    
    const query = {};
    if (program) query.program = program;
    if (yearLevel) query.yearLevel = parseInt(yearLevel);
    if (shift) query.shift = shift;
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester);
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Lightweight mode: return only essential fields without population
    // This is MUCH faster for dropdowns and lists
    if (lightweight === 'true') {
      const sections = await Section.find(query)
        // `room` is needed by the schedule builder to pre-fill a section's
        // home room on dropped classes; it's one short id, so it stays light.
        .select('_id sectionCode program yearLevel sectionLetter shift academicYear semester enrollmentCode isActive room')
        .sort({ program: 1, yearLevel: 1, sectionLetter: 1 })
        .lean(); // Use lean() for faster queries
      await attachHomeRooms(sections);

      return res.status(200).json({
        success: true,
        count: sections.length,
        data: sections
      });
    }

    // Full mode: include all populated data
    const sections = await Section.find(query)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      })
      .sort({ program: 1, yearLevel: 1, sectionLetter: 1 })
      .lean();
    await attachHomeRooms(sections);

    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    sendError(res, error, 'Error fetching sections');
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
    sendError(res, error, 'Error fetching section');
  }
};

// @desc    Create new section
// @route   POST /api/sections
// @access  Private (Admin, Scheduling Officer)
exports.createSection = async (req, res) => {
  try {
    const { program, yearLevel, sectionLetter, shift, maxStudents, adviser, room, description } = req.body;
    // New sections belong to the current term unless one is given
    const term = await require('../services/academicTerm.service').getDefaultTerm(program);
    const academicYear = req.body.academicYear || term.academicYear;
    const semester = req.body.semester || term.semester;

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

    // Every section gets its own home room: the one picked, or the best free one.
    // `room` used to be ignored here, so a room chosen in the form was dropped.
    const draft = { academicYear, semester, shift, program, yearLevel: Number(yearLevel), maxStudents: maxStudents || 40 };
    let homeRoomId = null;
    let roomNote = null;
    if (room) {
      const check = await checkHomeRoom(draft, room);
      if (check.error) return res.status(409).json({ success: false, code: check.code || 'HOME_ROOM_INVALID', message: check.error });
      homeRoomId = String(check.room._id);
      roomNote = check.warning;
    } else {
      const pick = await pickHomeRoom(draft);
      homeRoomId = pick.room ? String(pick.room._id) : null;
      roomNote = pick.room
        ? pick.warning || `Home room: ${pick.room.roomCode}`
        : `No lecture room is free for the ${shift} shift, so this section has no home room yet. Add a room or free one up on the Rooms page.`;
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
      room: homeRoomId,
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

    const data = populatedSection.toObject();
    await attachHomeRooms([data]);
    res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data,
      roomNote
    });
  } catch (error) {
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    sendError(res, error, 'Error creating section');
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

    const { program, yearLevel, sectionLetter, shift, academicYear, semester, maxStudents, adviser, room, description, isActive, currentStudents } = req.body;

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

    // Home room: keep it dedicated. An explicit room is checked; an empty one
    // (or one that no longer works after a shift/term/size change) is replaced
    // with the best free room.
    let roomNote = null;
    const roomBefore = section.room;
    const placementChanged= section.isModified('shift') || section.isModified('academicYear') || section.isModified('semester');
    if (section.isActive !== false) {
      let needsPick = false;
      if (room !== undefined && room !== null && room !== '') {
        const check = await checkHomeRoom(section, room, { excludeId: section._id });
        if (check.error) return res.status(409).json({ success: false, code: check.code || 'HOME_ROOM_INVALID', message: check.error });
        section.room = String(check.room._id);
        roomNote = check.warning;
      } else if (room !== undefined || !section.room) {
        needsPick = true;
      } else if (placementChanged || section.isModified('maxStudents')) {
        const check = await checkHomeRoom(section, section.room, { excludeId: section._id });
        if (check.error) needsPick = true;
        else roomNote = check.warning;
      }
      if (needsPick) {
        const before = section.room;
        const pick = await pickHomeRoom(section, { excludeId: section._id });
        section.room = pick.room ? String(pick.room._id) : null;
        roomNote = pick.room
          ? pick.warning || (String(before || '') !== String(pick.room._id) ? `Home room is now ${pick.room.roomCode}.` : null)
          : `No lecture room is free for the ${section.shift} shift, so this section has no home room.`;
      }
    }
    if (currentStudents !== undefined) section.currentStudents = currentStudents;

    // Regenerate section code if key fields changed
    if (program || yearLevel || sectionLetter || shift) {
      section.sectionCode = `${section.program}-${section.yearLevel}${section.sectionLetter}-${section.shift.substring(0, 1)}`;
    }

    await section.save();

    // The section's classes follow its home room
    if (section.room && (String(roomBefore || '') !== String(section.room) || placementChanged)) {
      const { moved, clashes } = await moveSectionClasses(section);
      if (moved) roomNote = [roomNote, `${moved} class${moved === 1 ? '' : 'es'} moved to the new home room.`].filter(Boolean).join(' ');
      if (clashes.length) roomNote = [roomNote, `Check these overlaps: ${clashes.slice(0, 3).join('; ')}.`].filter(Boolean).join(' ');
    }

    const updatedSection = await Section.findById(section._id)
      .populate('adviser', 'employeeId user')
      .populate({
        path: 'adviser',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      });

    const data = updatedSection.toObject();
    await attachHomeRooms([data]);
    res.status(200).json({
      success: true,
      message: 'Section updated successfully',
      data,
      roomNote
    });
  } catch (error) {
    sendError(res, error, 'Error updating section');
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
    sendError(res, error, 'Error deleting section');
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
    sendError(res, error, 'Error fetching sections');
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
    sendError(res, error, 'Error fetching section statistics');
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
    sendError(res, error, 'Error regenerating enrollment code');
  }
};

// @desc    Give every active section without a valid home room its own room
// @route   POST /api/sections/home-rooms/assign
// @access  Private (Admin, Scheduling Officer, Program Manager - own program)
exports.assignHomeRooms = async (req, res) => {
  try {
    const program = managerProgram(req) || req.body?.program || undefined;
    const { academicYear, semester } = req.body || {};
    const result = await assignMissingHomeRooms({ program, academicYear, semester });
    const parts = [];
    if (result.assigned.length) parts.push(`${result.assigned.length} section${result.assigned.length === 1 ? '' : 's'} given a home room`);
    if (result.unassigned.length) parts.push(`${result.unassigned.length} still without one (no free lecture room)`);
    if (result.moved) parts.push(`${result.moved} class${result.moved === 1 ? '' : 'es'} moved into their section's home room`);
    if (result.clashes.length) parts.push(`check overlaps: ${result.clashes.slice(0, 3).join('; ')}`);
    res.status(200).json({
      success: true,
      message: parts.length ? `${parts.join('; ')}.` : 'Every section already has its own home room.',
      data: result,
    });
  } catch (error) {
    sendError(res, error, 'Error assigning home rooms');
  }
};
