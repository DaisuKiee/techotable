const Schedule = require('../models/Schedule.model');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const Room = require('../models/Room.model');
const { validationResult } = require('express-validator');
const {
  ensureClassSpaceForSchedule,
  ensureClassSpacesForSchedules,
  syncClassSpaceForSchedule,
  deactivateClassSpaceForSchedule,
} = require('../services/classSpace.service');
const {
  attachScheduleRoomLabels,
  loadRoomsByRawValues,
  labelFor,
} = require('../utils/roomLabel');
// One subject for one section in one term is ONE Schedule document holding all
// of its meeting times, so it maps to exactly one class space.
const {
  groupRowsByOffering,
  mergeTimeSlots,
  findExistingOffering,
  appendSlotsToOffering,
} = require('../services/scheduleOffering.service');

// @desc    Get all schedules
// @route   GET /api/schedules
// @access  Private
exports.getAllSchedules = async (req, res) => {
  try {
    const { 
      academicYear, 
      semester, 
      program, 
      yearLevel,
      section,
      sectionCode,
      shift,
      status,
      faculty,
      search
    } = req.query;

    // Build query
    let query = { isActive: true }; // Only show active schedules

    // ROLE-BASED FILTERING
    // Students: Only see schedules for their program, year level, and section
    if (req.user.role === 'student') {
      query.program = req.user.program;
      query.yearLevel = req.user.yearLevel;
      query.section = req.user.section;
      // Override any query params that students shouldn't be able to change
    }
    // Faculty: Only see schedules where they are assigned (handled by separate endpoint)
    // For general viewing, faculty can see all schedules (to coordinate with students)
    // Program Managers: Filter by their assigned program (handled by programAccess middleware)
    // Admin & Scheduling Officers: See all schedules
    else {
      // Apply filters from query params for authorized users
      if (academicYear) query.academicYear = academicYear;
      if (semester) query.semester = parseInt(semester);
      if (program) query.program = program;
      if (yearLevel) query.yearLevel = parseInt(yearLevel);
      if (status) query.status = status;
      if (faculty) query.faculty = faculty;

      // Section and shift were previously ignored, so the schedule builder
      // received every section of the year level. That made the grid look fully
      // booked with other sections' classes and blocked drops.
      if (sectionCode) query.sectionCode = sectionCode.toUpperCase();
      if (section) query.section = section;
      if (shift) query.shift = shift;

      if (search) {
        query.$or = [
          { sectionCode: { $regex: search, $options: 'i' } },
          { section: { $regex: search, $options: 'i' } }
        ];
      }
    }

    const schedules = await Schedule.find(query)
      .populate('subject', 'subjectCode subjectName units lectureHours labHours')
      .populate({
        path: 'faculty',
        select: 'employeeId',
        populate: {
          path: 'user',
          select: 'firstName lastName'
        }
      })
      .sort({ program: 1, yearLevel: 1, section: 1 })
      .lean();

    // `room` holds a Room id in a String field, so it can't be populated.
    // Resolve it to a display label instead of leaking the raw id to the UI.
    await attachScheduleRoomLabels(schedules);

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });

  } catch (error) {
    console.error('Get all schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedules',
      error: error.message
    });
  }
};

// @desc    Get schedule by ID
// @route   GET /api/schedules/:id
// @access  Private
exports.getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('subject')
      .populate({
        path: 'faculty',
        populate: {
          path: 'user',
          select: 'firstName lastName middleName email'
        }
      })
      .populate('classSpace');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Get schedule by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedule',
      error: error.message
    });
  }
};

// @desc    Create new schedule
// @route   POST /api/schedules
// @access  Private/Admin
exports.createSchedule = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      academicYear,
      semester,
      program,
      yearLevel,
      section,
      sectionCode,
      shift,
      subject,
      faculty,
      room,
      timeSlots,
      maxStudents
    } = req.body;

    // Verify subject exists
    const subjectExists = await Subject.findById(subject);
    if (!subjectExists) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Verify faculty exists
    const facultyExists = await Faculty.findById(faculty);
    if (!facultyExists) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Is this subject already scheduled for this section? If so this request is
    // another meeting time for the SAME class, not a second class. Creating a
    // second document here is what produced duplicate "My Classes" cards.
    const existing = await findExistingOffering({ subject, sectionCode, academicYear, semester });

    if (existing) {
      const sameFaculty = String(existing.faculty) === String(faculty);
      const sameRoom = String(existing.room) === String(room);
      if (!sameFaculty || !sameRoom) {
        return res.status(400).json({
          success: false,
          message: `${subjectExists.subjectCode} is already scheduled for ${sectionCode} with a different `
            + `${!sameFaculty ? 'instructor' : 'room'}. Update that class instead of creating another one.`,
          data: existing
        });
      }
    }

    // Check for conflicts
    const conflicts = await checkScheduleConflicts({
      faculty,
      room,
      sectionCode,
      timeSlots,
      academicYear,
      semester,
      // Adding a meeting time to an existing class must not clash with itself
      excludeScheduleId: existing?._id
    });

    if (conflicts.hasConflict) {
      return res.status(400).json({
        success: false,
        message: 'Schedule conflicts detected',
        conflicts: conflicts.details
      });
    }

    let schedule;

    if (existing) {
      // Faculty load stays as it is: the offering was counted when it was first
      // created, and another meeting time is not another subject.
      schedule = await appendSlotsToOffering(existing, timeSlots);
    } else {
      // `shift` must be passed explicitly: it was previously omitted here, so the
      // schema default of 'Day' was applied and every Night section was stored as Day.
      schedule = await Schedule.create({
        academicYear,
        semester,
        program,
        yearLevel,
        section,
        sectionCode,
        shift: shift || 'Day',
        subject,
        faculty,
        room,
        timeSlots: mergeTimeSlots(timeSlots),
        maxStudents: maxStudents || 40,
        generatedBy: 'manual'
      });

      // Update faculty load
      await Faculty.findByIdAndUpdate(faculty, {
        $inc: { currentLoad: subjectExists.units }
      });
    }

    // Every subject offering gets its class space, so the teacher can post and
    // students of the section are pulled in automatically.
    await ensureClassSpaceForSchedule(schedule);

    await schedule.populate([
      { path: 'subject', select: 'subjectCode subjectName units' },
      { path: 'faculty', populate: { path: 'user', select: 'firstName lastName' } }
    ]);

    res.status(201).json({
      success: true,
      message: existing
        ? 'Meeting time added to the existing class'
        : 'Schedule created successfully',
      merged: !!existing,
      data: schedule
    });

  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating schedule',
      error: error.message
    });
  }
};

// @desc    Update schedule
// @route   PUT /api/schedules/:id
// @access  Private/Admin
exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    const {
      faculty,
      room,
      timeSlots,
      maxStudents,
      status,
      notes
    } = req.body;

    // Re-check conflicts whenever anything that can clash changes.
    // Room was previously not a trigger, so moving a class into an occupied room
    // was accepted silently.
    const facultyChanged = faculty && faculty !== schedule.faculty.toString();
    const roomChanged = room && String(room) !== String(schedule.room);
    if (facultyChanged || roomChanged || timeSlots) {
      const conflicts = await checkScheduleConflicts({
        faculty: faculty || schedule.faculty,
        room: room || schedule.room,
        sectionCode: schedule.sectionCode,
        timeSlots: timeSlots || schedule.timeSlots,
        academicYear: schedule.academicYear,
        semester: schedule.semester,
        excludeScheduleId: schedule._id
      });

      if (conflicts.hasConflict) {
        return res.status(400).json({
          success: false,
          message: 'Schedule conflicts detected',
          conflicts: conflicts.details
        });
      }
    }

    // Update faculty load if faculty changed
    if (faculty && faculty !== schedule.faculty.toString()) {
      const subjectData = await Subject.findById(schedule.subject);
      const units = subjectData.units;

      // Decrease old faculty load
      await Faculty.findByIdAndUpdate(schedule.faculty, {
        $inc: { currentLoad: -units }
      });

      // Increase new faculty load
      await Faculty.findByIdAndUpdate(faculty, {
        $inc: { currentLoad: units }
      });

      schedule.faculty = faculty;
    }

    // Update other fields
    if (room) schedule.room = room;
    if (timeSlots) schedule.timeSlots = timeSlots;
    if (maxStudents !== undefined) schedule.maxStudents = maxStudents;
    if (status) schedule.status = status;
    if (notes !== undefined) schedule.notes = notes;

    await schedule.save();

    // The class space denormalises faculty for the "classes I teach" query, so a
    // reassignment here has to be mirrored or the old teacher keeps the class.
    await syncClassSpaceForSchedule(schedule);

    await schedule.populate([
      { path: 'subject', select: 'subjectCode subjectName units' },
      { path: 'faculty', populate: { path: 'user', select: 'firstName lastName' } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating schedule',
      error: error.message
    });
  }
};

// @desc    Delete schedule
// @route   DELETE /api/schedules/:id
// @access  Private/Admin
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('subject', 'units');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Decrease faculty load
    await Faculty.findByIdAndUpdate(schedule.faculty, {
      $inc: { currentLoad: -schedule.subject.units }
    });

    // Soft delete
    schedule.isActive = false;
    await schedule.save();

    // The class space has to go with it. It was left active before, so a deleted
    // class kept appearing in the students' and teacher's class list with no way
    // to remove it, and syncSectionEnrollment kept re-enrolling students.
    await deactivateClassSpaceForSchedule(schedule);

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting schedule',
      error: error.message
    });
  }
};

// Helper function to check schedule conflicts
async function checkScheduleConflicts({
  faculty,
  room,
  sectionCode,
  timeSlots,
  academicYear,
  semester,
  excludeScheduleId = null
}) {
  const conflicts = {
    hasConflict: false,
    details: []
  };

  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    return conflicts;
  }

  // Build base query
  let query = {
    academicYear,
    semester,
    isActive: true
  };

  if (excludeScheduleId) {
    query._id = { $ne: excludeScheduleId };
  }

  // Get all schedules for the same semester
  const existingSchedules = await Schedule.find(query)
    .populate({
      path: 'faculty',
      select: 'employeeId',
      populate: { path: 'user', select: 'firstName lastName' }
    })
    .populate('subject', 'subjectCode')
    .lean();

  // Resolve room ids so the message names the room instead of an id
  const roomsById = await loadRoomsByRawValues([
    room,
    ...existingSchedules.map(s => s.room)
  ]);
  const roomLabel = (raw) => labelFor(roomsById.get(String(raw))) || raw;

  // Avoid reporting the same clash once per overlapping hour
  const seen = new Set();
  const add = (detail) => {
    const fingerprint = `${detail.type}|${detail.day}|${detail.time}|${detail.conflictingSchedule}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    conflicts.hasConflict = true;
    conflicts.details.push(detail);
  };

  for (const newSlot of timeSlots) {
    for (const existingSchedule of existingSchedules) {
      for (const existingSlot of existingSchedule.timeSlots || []) {
        if (newSlot.day !== existingSlot.day) continue;

        const hasTimeOverlap = checkTimeOverlap(
          newSlot.startTime,
          newSlot.endTime,
          existingSlot.startTime,
          existingSlot.endTime
        );
        if (!hasTimeOverlap) continue;

        const time = `${existingSlot.startTime} - ${existingSlot.endTime}`;
        const against = existingSchedule.subject?.subjectCode
          ? `${existingSchedule.sectionCode} (${existingSchedule.subject.subjectCode})`
          : existingSchedule.sectionCode;

        // Faculty double-booking.
        // `faculty` may be null if the referenced Faculty document was deleted,
        // so read the id defensively rather than through `.faculty._id`.
        const existingFacultyId = existingSchedule.faculty?._id || existingSchedule.faculty;
        if (faculty && existingFacultyId && existingFacultyId.toString() === faculty.toString()) {
          const name = existingSchedule.faculty?.user
            ? `${existingSchedule.faculty.user.firstName} ${existingSchedule.faculty.user.lastName}`
            : 'This instructor';
          add({
            type: 'faculty',
            message: `${name} is already teaching ${against} at this time`,
            day: newSlot.day,
            time,
            conflictingSchedule: existingSchedule.sectionCode
          });
        }

        // Room double-booking
        if (room && existingSchedule.room && String(existingSchedule.room) === String(room)) {
          add({
            type: 'room',
            message: `Room ${roomLabel(room)} is already used by ${against} at this time`,
            day: newSlot.day,
            time,
            conflictingSchedule: existingSchedule.sectionCode
          });
        }

        // Section double-booking. This was previously not checked at all, so a
        // section could be given two subjects in the same hour as long as the
        // faculty and room differed.
        if (
          sectionCode &&
          existingSchedule.sectionCode &&
          String(existingSchedule.sectionCode).toUpperCase() === String(sectionCode).toUpperCase()
        ) {
          add({
            type: 'section',
            message: `Section ${existingSchedule.sectionCode} already has ${
              existingSchedule.subject?.subjectCode || 'a class'
            } at this time`,
            day: newSlot.day,
            time,
            conflictingSchedule: existingSchedule.sectionCode
          });
        }
      }
    }
  }

  return conflicts;
}

// Helper function to check time overlap
function checkTimeOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return (s1 < e2 && e1 > s2);
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// @desc    Get schedules by program and year
// @route   GET /api/schedules/program/:program/:yearLevel
// @access  Private
exports.getSchedulesByProgramAndYear = async (req, res) => {
  try {
    const { program, yearLevel } = req.params;
    const { academicYear, semester } = req.query;

    const query = {
      program,
      yearLevel: parseInt(yearLevel),
      isActive: true
    };

    // STUDENT FILTERING: Students can only see their own section
    if (req.user.role === 'student') {
      // Verify the requested program and year match the student's
      if (program !== req.user.program || parseInt(yearLevel) !== req.user.yearLevel) {
        return res.status(403).json({
          success: false,
          message: 'You can only view schedules for your program and year level'
        });
      }
      query.section = req.user.section;
    }

    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester);

    const schedules = await Schedule.find(query)
      .populate('subject', 'subjectCode subjectName units')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .sort({ section: 1 });

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });

  } catch (error) {
    console.error('Get schedules by program error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedules',
      error: error.message
    });
  }
};

// @desc    Get faculty schedule
// @route   GET /api/schedules/faculty/:facultyId
// @access  Private
exports.getFacultySchedule = async (req, res) => {
  try {
    const { facultyId } = req.params;
    const { academicYear, semester } = req.query;

    const query = {
      faculty: facultyId,
      isActive: true
    };

    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester);

    const schedules = await Schedule.find(query)
      .populate('subject', 'subjectCode subjectName units')
      .sort({ 'timeSlots.day': 1 });

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });

  } catch (error) {
    console.error('Get faculty schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching faculty schedule',
      error: error.message
    });
  }
};

// @desc    Check for conflicts
// @route   POST /api/schedules/check-conflicts
// @access  Private
exports.checkConflicts = async (req, res) => {
  try {
    const { faculty, room, timeSlots, academicYear, semester, program, yearLevel } = req.body;

    // Check if this is a batch check (by program/year) or single schedule check
    if (program && semester && academicYear && !timeSlots) {
      // Batch conflict check for all schedules in program/year/semester
      const query = {
        semester,
        academicYear,
        isActive: true
      };
      
      if (program) query.program = program;
      if (yearLevel) query.yearLevel = yearLevel;
      
      const schedules = await Schedule.find(query)
        .populate({
          path: 'faculty',
          select: 'employeeId',
          populate: { path: 'user', select: 'firstName lastName' }
        })
        .populate('subject', 'subjectCode')
        .lean();

      await attachScheduleRoomLabels(schedules);

      const allConflicts = [];

      // Check each pair of schedules for conflicts
      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const schedule1 = schedules[i];
          const schedule2 = schedules[j];

          // Check for conflicts between these two schedules
          for (const slot1 of schedule1.timeSlots) {
            for (const slot2 of schedule2.timeSlots) {
              if (slot1.day === slot2.day) {
                const overlap = checkTimeOverlap(
                  slot1.startTime,
                  slot1.endTime,
                  slot2.startTime,
                  slot2.endTime
                );

                if (overlap) {
                  // Faculty conflict. Read ids defensively: populate yields null
                  // when the referenced Faculty was deleted, and `.faculty._id`
                  // on null throws and 500s the whole conflict check.
                  const f1 = schedule1.faculty?._id || schedule1.faculty;
                  const f2 = schedule2.faculty?._id || schedule2.faculty;
                  if (f1 && f2 && f1.toString() === f2.toString()) {
                    const name = schedule1.faculty?.user
                      ? `${schedule1.faculty.user.firstName || ''} ${schedule1.faculty.user.lastName || ''}`.trim()
                      : 'An instructor';
                    allConflicts.push({
                      type: 'faculty',
                      message: `${name} has overlapping classes`,
                      day: slot1.day,
                      time: `${slot1.startTime} - ${slot1.endTime}`,
                      schedule1: schedule1.sectionCode,
                      schedule2: schedule2.sectionCode
                    });
                  }

                  // Room conflict
                  if (schedule1.room && schedule2.room && String(schedule1.room) === String(schedule2.room)) {
                    allConflicts.push({
                      type: 'room',
                      message: `Room ${schedule1.roomLabel || schedule1.room} is double-booked`,
                      day: slot1.day,
                      time: `${slot1.startTime} - ${slot1.endTime}`,
                      schedule1: schedule1.sectionCode,
                      schedule2: schedule2.sectionCode
                    });
                  }

                  // Section conflict: the same section cannot sit in two
                  // classes at once. Previously never checked.
                  if (
                    schedule1.sectionCode &&
                    schedule2.sectionCode &&
                    String(schedule1.sectionCode).toUpperCase() === String(schedule2.sectionCode).toUpperCase()
                  ) {
                    allConflicts.push({
                      type: 'section',
                      message: `Section ${schedule1.sectionCode} has two classes at the same time (${
                        schedule1.subject?.subjectCode || '?'
                      } and ${schedule2.subject?.subjectCode || '?'})`,
                      day: slot1.day,
                      time: `${slot1.startTime} - ${slot1.endTime}`,
                      schedule1: schedule1.sectionCode,
                      schedule2: schedule2.sectionCode
                    });
                  }
                }
              }
            }
          }
        }
      }

      return res.status(200).json({
        success: true,
        hasConflict: allConflicts.length > 0,
        conflicts: allConflicts
      });
    }

    // Single schedule conflict check (original behavior)
    // Validate required fields for single mode
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'timeSlots array is required for single schedule conflict check'
      });
    }

    const conflicts = await checkScheduleConflicts({
      faculty,
      room,
      timeSlots,
      academicYear,
      semester
    });

    res.status(200).json({
      success: true,
      hasConflict: conflicts.hasConflict,
      conflicts: conflicts.details
    });

  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking conflicts',
      error: error.message
    });
  }
};

// @desc    Publish schedule
// @route   PUT /api/schedules/:id/publish
// @access  Private/Admin
exports.publishSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    schedule.status = 'published';
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Schedule published successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Publish schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing schedule',
      error: error.message
    });
  }
};

// @desc    Batch publish schedules (publish all for a program/year/semester)
// @route   POST /api/schedules/publish
// @access  Private/Admin
exports.batchPublishSchedules = async (req, res) => {
  try {
    const { program, yearLevel, semester, academicYear } = req.body;

    if (!program || !yearLevel || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Program, year level, semester, and academic year are required'
      });
    }

    // Update all matching schedules to published
    const result = await Schedule.updateMany(
      {
        program,
        yearLevel,
        semester,
        academicYear,
        isActive: true
      },
      {
        $set: { status: 'published' }
      }
    );

    res.status(200).json({
      success: true,
      message: `Published ${result.modifiedCount} schedule(s) successfully`,
      count: result.modifiedCount
    });

  } catch (error) {
    console.error('Batch publish error:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing schedules',
      error: error.message
    });
  }
};

// @desc    Batch delete schedules by IDs
// @route   POST /api/schedules/batch-delete
// @access  Private/Admin
exports.batchDeleteSchedules = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No schedule IDs provided for deletion'
      });
    }

    const schedules = await Schedule.find({ _id: { $in: ids }, isActive: true })
      .populate('subject', 'units');

    let deletedCount = 0;
    for (const schedule of schedules) {
      if (schedule.faculty && schedule.subject?.units) {
        await Faculty.findByIdAndUpdate(schedule.faculty, {
          $inc: { currentLoad: -schedule.subject.units }
        });
      }
      schedule.isActive = false;
      await schedule.save();
      await deactivateClassSpaceForSchedule(schedule);
      deletedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} schedule(s)`,
      count: deletedCount
    });

  } catch (error) {
    console.error('Batch delete schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting schedules',
      error: error.message
    });
  }
};

// @desc    Generate schedule automatically
// @route   POST /api/schedules/generate
// @access  Private/Admin
exports.generateSchedule = async (req, res) => {
  try {
    const { 
      academicYear, 
      semester, 
      program, 
      yearLevel, 
      section,            // Single section identifier (e.g., 'A', 'B', 'C')
      method = 'greedy',  // 'greedy' or 'ortools'
      shift = 'Day',      // 'Day' or 'Night'
      timeLimit = 60,     // seconds for OR-Tools
      useAIRecommendations = false  // Use AI RAG for faculty recommendations
    } = req.body;

    if (!academicYear || !semester || !program || !yearLevel || !section) {
      return res.status(400).json({
        success: false,
        message: 'Academic year, semester, program, year level, and section are required'
      });
    }

    let result;

    // Choose generation method
    if (method === 'ortools') {
      // Use Google OR-Tools constraint solver
      const { generateWithORTools } = require('../services/ortoolsBridge.service');
      
      result = await generateWithORTools({
        academicYear,
        semester,
        program,
        yearLevel,
        section,
        shift,
        timeLimit
      });

      // If OR-Tools succeeded, save the schedules
      if (result.success && result.schedules) {
        const savedSchedules = [];
        const errors = [];

        for (const scheduleData of result.schedules) {
          try {
            const schedule = await Schedule.create(scheduleData);
            savedSchedules.push(schedule);

            // Update faculty load
            if (scheduleData.faculty) {
              const subject = await Subject.findById(scheduleData.subject);
              if (subject) {
                await Faculty.findByIdAndUpdate(scheduleData.faculty, {
                  $inc: { currentLoad: subject.units }
                });
              }
            }
          } catch (error) {
            errors.push({
              subject: scheduleData.metadata?.subjectCode || 'Unknown',
              error: error.message
            });
          }
        }

        // One class space per saved offering. Failures here are logged and
        // counted rather than thrown, so a partial save still succeeds.
        await ensureClassSpacesForSchedules(savedSchedules);

        result.savedSchedules = savedSchedules;
        result.saveErrors = errors;
      }

    } else {
      // Use greedy algorithm
      const { generateScheduleForProgram } = require('../services/scheduleGenerator.service');

      result = await generateScheduleForProgram({
        academicYear,
        semester,
        program,
        yearLevel,
        section,
        shift,
        useAIRecommendations: useAIRecommendations === true || useAIRecommendations === 'true'
      });
    }

    res.status(200).json({
      success: result.success,
      // `result.error` carries the solver's specific reason (a section that is
      // already full, no lab room, a load cap). Dropping it left the user with
      // a bare "Schedule generation failed".
      message: result.message
        || result.error
        || (result.success ? 'Schedule generated successfully' : 'Schedule generation failed'),
      method: method === 'ortools' ? 'Google OR-Tools CP-SAT' : 'Greedy Algorithm',
      aiUsed: result.aiUsed || false,
      blockers: result.blockers || [],
      diagnostics: result.diagnostics || [],
      data: result
    });

  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating schedule',
      error: error.message
    });
  }
};

// @desc    Preview schedule generation (doesn't save to DB)
// @route   POST /api/schedules/preview
// @access  Private/Admin
exports.previewSchedule = async (req, res) => {
  try {
    const { 
      academicYear, 
      semester, 
      program, 
      yearLevel, 
      section,
      method = 'greedy',
      shift = 'Day',
      timeLimit = 60,
      useAIRecommendations = false
    } = req.body;

    if (!academicYear || !semester || !program || !yearLevel || !section) {
      return res.status(400).json({
        success: false,
        message: 'Academic year, semester, program, year level, and section are required'
      });
    }

    let preview;

    // Choose generation method
    if (method === 'ortools') {
      // Previously this silently fell back to the greedy algorithm, so choosing
      // OR-Tools in the preview dialog produced a greedy timetable and then
      // saving it ran the solver - a different schedule from the one reviewed.
      const { previewWithORTools } = require('../services/ortoolsBridge.service');

      const solved = await previewWithORTools({
        academicYear,
        semester,
        program,
        yearLevel,
        section,
        shift,
        timeLimit,
      });

      preview = {
        ...solved.preview,
        success: solved.success,
        message: solved.message,
        status: solved.status,
        blockers: solved.blockers || [],
        diagnostics: solved.diagnostics || [],
        skipped: solved.skipped || [],
        methodNote: 'Preview generated with Google OR-Tools CP-SAT',
      };
    } else {
      // Use greedy algorithm - preview only
      const { previewScheduleForProgram } = require('../services/scheduleGenerator.service');

      preview = await previewScheduleForProgram({
        academicYear,
        semester,
        program,
        yearLevel,
        section,
        shift,
        useAIRecommendations: useAIRecommendations === true || useAIRecommendations === 'true'
      });
    }

    res.status(200).json({
      success: preview.success,
      message: preview.message || (preview.success ? 'Schedule preview generated successfully' : 'Schedule preview generation failed'),
      method: method === 'ortools' ? 'Google OR-Tools CP-SAT' : 'Greedy Algorithm',
      aiUsed: preview.aiUsed || false,
      data: preview
    });

  } catch (error) {
    console.error('Preview schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error previewing schedule',
      error: error.message
    });
  }
};

// @desc    Save previewed schedules to database
// @route   POST /api/schedules/save-preview
// @access  Private/Admin
exports.savePreviewedSchedules = async (req, res) => {
  try {
    const { schedules } = req.body;

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No schedules provided to save'
      });
    }

    const savedSchedules = [];
    const errors = [];

    // Fold rows belonging to the same subject offering together, so a preview
    // that lists a subject's meetings separately still saves as one class.
    const { groups, errors: groupErrors } = groupRowsByOffering(schedules);
    errors.push(...groupErrors.map(e => ({ subject: e.subject, error: e.error })));

    for (const group of groups) {
      const scheduleData = group.merged;
      try {
        const existing = await findExistingOffering(scheduleData);

        if (existing) {
          // Already scheduled: add the meeting times, leave faculty load alone.
          savedSchedules.push(await appendSlotsToOffering(existing, scheduleData.timeSlots));
          continue;
        }

        const schedule = await Schedule.create(scheduleData);
        savedSchedules.push(schedule);

        // Update faculty load
        if (scheduleData.faculty) {
          const subject = await Subject.findById(scheduleData.subject);
          if (subject) {
            await Faculty.findByIdAndUpdate(scheduleData.faculty, {
              $inc: { currentLoad: subject.units }
            });
          }
        }
      } catch (error) {
        errors.push({
          subject: scheduleData.metadata?.subjectCode || scheduleData.subjectCode || 'Unknown',
          error: error.message
        });
      }
    }

    // One class space per saved offering, so the classes appear for the
    // teacher and the section's students without any extra step.
    const spaces = await ensureClassSpacesForSchedules(savedSchedules);

    res.status(201).json({
      success: true,
      message: `Successfully saved ${savedSchedules.length} schedule(s)`,
      saved: savedSchedules.length,
      failed: errors.length,
      classSpacesCreated: spaces.created,
      data: savedSchedules,
      errors: errors
    });

  } catch (error) {
    console.error('Save previewed schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving schedules',
      error: error.message
    });
  }
};

// @desc    Check OR-Tools availability
// @route   GET /api/schedules/ortools-status
// @access  Private/Admin
exports.checkORToolsStatus = async (req, res) => {
  try {
    const { checkORToolsAvailability } = require('../services/ortoolsBridge.service');
    
    const status = await checkORToolsAvailability();
    
    res.status(200).json({
      success: true,
      ortools: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking OR-Tools status',
      error: error.message
    });
  }
};

// @desc    Create many schedules in one request (schedule builder "Save All")
// @route   POST /api/schedules/bulk
// @access  Private/Admin
//
// The builder used to POST one schedule per row in a loop. If row 3 of 8 failed,
// rows 1-2 were already persisted but the client still held all 8 as pending, so
// pressing Save All again created duplicates and double-counted faculty load.
//
// This validates every row first and only writes if all of them pass, so the
// client can safely clear its pending list on success and keep it on failure.
exports.bulkCreateSchedules = async (req, res) => {
  try {
    const { schedules } = req.body;

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty schedules array is required'
      });
    }

    const MAX_ROWS = 200;
    if (schedules.length > MAX_ROWS) {
      return res.status(400).json({
        success: false,
        message: `Too many schedules in one request (max ${MAX_ROWS})`
      });
    }

    // ---------- 1. validate every row before writing anything ----------
    const errors = [];
    const prepared = [];

    // Cache lookups so N rows don't mean N identical queries
    const subjectCache = new Map();
    const facultyCache = new Map();

    for (let i = 0; i < schedules.length; i++) {
      const row = schedules[i];
      const label = row?.subjectCode || `row ${i + 1}`;

      const required = ['subject', 'faculty', 'room', 'program', 'yearLevel', 'section', 'sectionCode', 'semester', 'academicYear'];
      const missing = required.filter(k => row?.[k] === undefined || row?.[k] === null || row?.[k] === '');
      if (missing.length > 0) {
        errors.push({ index: i, subject: label, error: `Missing: ${missing.join(', ')}` });
        continue;
      }

      if (!Array.isArray(row.timeSlots) || row.timeSlots.length === 0) {
        errors.push({ index: i, subject: label, error: 'At least one time slot is required' });
        continue;
      }

      if (!subjectCache.has(String(row.subject))) {
        subjectCache.set(String(row.subject), await Subject.findById(row.subject).select('units subjectCode').lean());
      }
      const subjectDoc = subjectCache.get(String(row.subject));
      if (!subjectDoc) {
        errors.push({ index: i, subject: label, error: 'Subject not found' });
        continue;
      }

      if (!facultyCache.has(String(row.faculty))) {
        facultyCache.set(String(row.faculty), await Faculty.findById(row.faculty).select('_id').lean());
      }
      if (!facultyCache.get(String(row.faculty))) {
        errors.push({ index: i, subject: label, error: 'Faculty not found' });
        continue;
      }

      prepared.push({ index: i, label, subjectDoc, row });
    }

    // ---------- 1b. fold blocks of the same offering into one row ----------
    // The builder places a class cell by cell, so a 4-hour lab arrives as
    // several rows. Written as-is they became several Schedule documents and
    // therefore several class spaces for one subject. One offering = one row
    // carrying all of its meeting times.
    const { groups, errors: groupErrors } = groupRowsByOffering(
      prepared.map(p => ({ ...p.row, index: p.index, label: p.label }))
    );
    errors.push(...groupErrors);

    const offerings = [];
    for (const group of groups) {
      const row = group.merged;
      const label = row.label;
      const index = row.index;
      const subjectDoc = subjectCache.get(String(row.subject));

      // The offering may already be saved - a later drop extends it rather than
      // starting a second copy of the same class.
      const existing = await findExistingOffering(row);

      if (existing) {
        const sameFaculty = String(existing.faculty) === String(row.faculty);
        const sameRoom = String(existing.room) === String(row.room);
        if (!sameFaculty || !sameRoom) {
          errors.push({
            index,
            subject: label,
            error: `${label} is already scheduled for ${row.sectionCode} with a different `
              + `${!sameFaculty ? 'instructor' : 'room'}. Edit the existing class instead of adding a second one.`
          });
          continue;
        }
      }

      offerings.push({ index, label, row, subjectDoc, existing });
    }

    // ---------- 2. conflicts against saved rows AND within this batch ----------
    for (const item of offerings) {
      const { row, index, label, existing } = item;

      const conflicts = await checkScheduleConflicts({
        faculty: row.faculty,
        room: row.room,
        sectionCode: row.sectionCode,
        timeSlots: row.timeSlots,
        academicYear: row.academicYear,
        semester: row.semester,
        // Extending an offering must not clash with itself
        excludeScheduleId: existing?._id
      });

      if (conflicts.hasConflict) {
        errors.push({
          index,
          subject: label,
          error: conflicts.details[0]?.message || 'Schedule conflict',
          conflicts: conflicts.details
        });
      }
    }

    // Within-batch clashes never hit the DB check, since none of these rows are
    // saved yet. Compare each pair directly.
    for (let a = 0; a < offerings.length; a++) {
      for (let b = a + 1; b < offerings.length; b++) {
        const A = offerings[a].row;
        const B = offerings[b].row;
        if (A.academicYear !== B.academicYear || String(A.semester) !== String(B.semester)) continue;

        for (const sa of A.timeSlots) {
          for (const sb of B.timeSlots) {
            if (sa.day !== sb.day) continue;
            if (!checkTimeOverlap(sa.startTime, sa.endTime, sb.startTime, sb.endTime)) continue;

            const where = `${sa.day} ${sa.startTime}`;
            if (String(A.faculty) === String(B.faculty)) {
              errors.push({
                index: offerings[b].index,
                subject: offerings[b].label,
                error: `Same instructor as ${offerings[a].label} at ${where}`
              });
            }
            if (String(A.room) === String(B.room)) {
              errors.push({
                index: offerings[b].index,
                subject: offerings[b].label,
                error: `Same room as ${offerings[a].label} at ${where}`
              });
            }
            if (String(A.sectionCode).toUpperCase() === String(B.sectionCode).toUpperCase()) {
              errors.push({
                index: offerings[b].index,
                subject: offerings[b].label,
                error: `Section already has ${offerings[a].label} at ${where}`
              });
            }
          }
        }
      }
    }

    // ---------- 3. all-or-nothing ----------
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${errors.length} schedule(s) could not be saved. Nothing was written.`,
        saved: 0,
        failed: errors.length,
        errors
      });
    }

    const created = [];
    let extended = 0;

    for (const { row, subjectDoc, existing } of offerings) {
      if (existing) {
        // Extend the class that is already there. Faculty load is untouched:
        // giving a subject another meeting time does not add a subject to the
        // teacher's load, and it was counted when the offering was created.
        await appendSlotsToOffering(existing, row.timeSlots);
        created.push(existing);
        extended++;
        continue;
      }

      const schedule = await Schedule.create({
        academicYear: row.academicYear,
        semester: row.semester,
        program: row.program,
        yearLevel: row.yearLevel,
        section: row.section,
        sectionCode: row.sectionCode,
        shift: row.shift || 'Day',
        subject: row.subject,
        faculty: row.faculty,
        room: row.room,
        timeSlots: row.timeSlots,
        maxStudents: row.maxStudents || 40,
        generatedBy: 'manual'
      });

      await Faculty.findByIdAndUpdate(row.faculty, { $inc: { currentLoad: subjectDoc.units } });
      created.push(schedule);
    }

    // Each subject offering gets its class space so the teacher can post and the
    // section's students are enrolled automatically.
    const spaces = await ensureClassSpacesForSchedules(created);

    const populated = await Schedule.find({ _id: { $in: created.map(c => c._id) } })
      .populate('subject', 'subjectCode subjectName units')
      .populate({
        path: 'faculty',
        select: 'employeeId',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .lean();

    await attachScheduleRoomLabels(populated);

    // Blocks of the same subject collapse into one class, so the number of
    // classes saved is usually smaller than the number of blocks drawn. Say so,
    // otherwise the count looks like rows were silently dropped.
    const blocks = prepared.length;
    const classes = created.length;
    let message = `Saved ${classes} class${classes === 1 ? '' : 'es'}`;
    if (blocks > classes) message += ` from ${blocks} blocks`;
    if (extended > 0) message += ` (${extended} added to an existing class)`;

    res.status(201).json({
      success: true,
      message,
      saved: classes,
      blocks,
      extended,
      failed: 0,
      classSpacesCreated: spaces.created,
      data: populated
    });

  } catch (error) {
    console.error('Bulk create schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving schedules',
      error: error.message
    });
  }
};
