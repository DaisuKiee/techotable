const mongoose = require('mongoose');
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
  looksLikeObjectId,
} = require('../utils/roomLabel');
const { notifyScheduleChange } = require('../services/emailNotification.service');
const { homeRoomResolver } = require('../services/homeRoom.service');
const { setClassSpacesPublished } = require('../services/classSpace.service');

/**
 * Draft vs published.
 *
 * A new, generated or edited-in-draft class is the scheduling office's working
 * copy: only staff see it, and nobody is notified. Publishing makes it
 * official - its teacher and the section's students see it in their schedule
 * and class list and are notified. Withdrawing (back to draft) hides it again
 * and tells them. Archived classes are past terms and stay visible.
 */
const STAFF_ROLES = ['admin', 'scheduling_officer', 'program_manager'];
const isStaff = (user) => STAFF_ROLES.includes(user?.role);
const OFFICIAL_ONLY = { status: { $ne: 'draft' } };

/**
 * Publish (published=true) or withdraw (false) a set of schedule documents and
 * tell the people affected. Returns the ones that actually changed.
 */
async function applyPublishState(schedules, published, actor) {
  const target = published ? 'published' : 'draft';
  const changing = schedules.filter((s) => s && s.isActive !== false && s.status !== target);
  if (!changing.length) return [];

  const ids = changing.map((s) => s._id);
  await Schedule.updateMany({ _id: { $in: ids } }, { $set: { status: target } });
  // Spaces may not exist yet for older rows; create them, then flip visibility
  await ensureClassSpacesForSchedules(changing);
  await setClassSpacesPublished(ids, published);

  const fresh = await Schedule.find({ _id: { $in: ids } })
    .populate('subject', 'subjectCode subjectName')
    .lean();

  if (fresh.length === 1) {
    notifyScheduleEvent(fresh[0], published ? 'published' : 'withdrawn', { actor });
  } else {
    notifyTimetableBatch(fresh, published ? 'published' : 'withdrawn');
  }
  if (published) {
    // Email the teacher and students of each newly official class
    Promise.allSettled(ids.map((id) => notifyScheduleChange(id, 'published')))
      .catch((err) => console.error('Publish emails failed:', err.message));
  }
  return fresh;
}
const {
  notifyScheduleEvent,
  notifyTimetableBatch,
  snapshotSchedule,
} = require('../services/inAppNotification.service');

const actorOf = (req) => (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || undefined : undefined);
const { sendError, sendValidationErrors } = require('../middleware/error.middleware');
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
      // Their own classes only, from their student record. This used to read
      // yearLevel/section off the User, which has neither, so the list came
      // back empty. Regular students follow their section; irregular students
      // the classes they joined.
      const Student = require('../models/Student.model');
      const ClassSpace = require('../models/ClassSpace.model');
      const student = await Student.findOne({ user: req.user._id }).select('studentType sectionCode enrolledClasses').lean();
      if (!student) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      if (student.studentType === 'irregular') {
        const spaces = await ClassSpace.find({ _id: { $in: student.enrolledClasses || [] } }).select('schedule').lean();
        query._id = { $in: spaces.map((sp) => sp.schedule) };
      } else {
        query.sectionCode = student.sectionCode || '__none__';
      }
      if (academicYear) query.academicYear = academicYear;
      if (semester) query.semester = parseInt(semester);
      Object.assign(query, OFFICIAL_ONLY);
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
      // Teachers never see drafts, whatever they ask for
      if (!isStaff(req.user)) {
        query.status = status && status !== 'draft' ? status : OFFICIAL_ONLY.status;
      }

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
      .populate('section', 'sectionCode program yearLevel semester shift')
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
    sendError(res, error, 'Error fetching schedules');
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

    // A draft doesn't exist yet as far as teachers and students are concerned
    if (!schedule || (!isStaff(req.user) && schedule.status === 'draft')) {
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
    sendError(res, error, 'Error fetching schedule');
  }
};

// @desc    Create new schedule
// @route   POST /api/schedules
// @access  Private/Admin
exports.createSchedule = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
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
      timeSlots,
      maxStudents
    } = req.body;

    // A section with a home room holds every class there, whatever room was sent
    const room = (await homeRoomResolver()({ sectionCode, academicYear, semester })) || req.body.room;
    if (!room) {
      return res.status(400).json({ success: false, message: 'Pick a room, or give the section a home room on the Sections page' });
    }

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
      subject,
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
    const existingBefore = existing ? snapshotSchedule(existing) : null;

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

      // Faculty load is computed from saved schedules (utils/facultyLoad), not kept in a counter.
    }

    // Every subject offering gets its class space, so the teacher can post and
    // students of the section are pulled in automatically.
    await ensureClassSpaceForSchedule(schedule);

    await schedule.populate([
      { path: 'subject', select: 'subjectCode subjectName units' },
      { path: 'faculty', populate: { path: 'user', select: 'firstName lastName' } }
    ]);

    // Students of the section and the teacher hear about it right away
    notifyScheduleEvent(schedule, existing ? 'updated' : 'created', { before: existingBefore, actor: actorOf(req) });

    res.status(201).json({
      success: true,
      message: existing
        ? 'Meeting time added to the existing class'
        : 'Schedule created successfully',
      merged: !!existing,
      data: schedule
    });

  } catch (error) {
    sendError(res, error, 'Error creating schedule');
  }
};

// @desc    Update schedule
// @route   PUT /api/schedules/:id
// @access  Private/Admin
exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('subject', 'subjectCode subjectName');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    const before = snapshotSchedule(schedule);

    const {
      faculty,
      room: requestedRoom,
      timeSlots,
      maxStudents,
      status,
      notes
    } = req.body;

    // A section with a home room keeps every class there. An older class saved
    // in another room is moved home on its next edit.
    const room = (await homeRoomResolver()(schedule)) || requestedRoom;

    // Re-check conflicts whenever anything that can clash changes.
    // Room was previously not a trigger, so moving a class into an occupied room
    // was accepted silently.
    const facultyChanged = faculty && faculty !== schedule.faculty.toString();
    const roomChanged = room && String(room) !== String(schedule.room);
    if (facultyChanged || roomChanged || timeSlots) {
      const conflicts = await checkScheduleConflicts({
        subject: schedule.subject, // Use the existing subject from the schedule
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

    // Faculty load is computed from saved schedules (utils/facultyLoad), not kept in a counter.
    // The counter this used to adjust drifted below zero (generated classes
    // never added to it, but deleting them subtracted), and a negative value
    // then failed validation on every save of that faculty profile.
    if (faculty && faculty !== String(schedule.faculty)) {
      schedule.faculty = faculty;
    }

    // Update other fields
    if (room) schedule.room = room;
    if (timeSlots) schedule.timeSlots = timeSlots;
    if (maxStudents !== undefined) schedule.maxStudents = maxStudents;
    if (notes !== undefined) schedule.notes = notes;
    // Publishing and withdrawing are handled after the save, so they announce
    // properly; archiving is the term roll-over's job, not an edit
    const publishTo = status === 'published' && schedule.status !== 'published' ? true
      : status === 'draft' && schedule.status === 'published' ? false
        : null;

    await schedule.save();

    // The class space denormalises faculty for the "classes I teach" query, so a
    // reassignment here has to be mirrored or the old teacher keeps the class.
    await syncClassSpaceForSchedule(schedule);

    await schedule.populate([
      { path: 'subject', select: 'subjectCode subjectName units' },
      { path: 'faculty', populate: { path: 'user', select: 'firstName lastName' } }
    ]);

    if (publishTo !== null) {
      await applyPublishState([schedule], publishTo, actorOf(req));
      schedule.status = publishTo ? 'published' : 'draft';
    } else {
      // In-app + live: says exactly what changed (time, room, instructor).
      // Silent for drafts: nobody but the office can see them yet.
      notifyScheduleEvent(schedule, 'updated', { before, actor: actorOf(req) });
    }

    // Send email notifications for changes to an official class (async, don't wait)
    if (publishTo === null && schedule.status === 'published') {
      notifyScheduleChange(schedule._id, 'updated')
        .then(result => {
          console.log(`📧 Schedule update notifications sent: ${result.total.sent}/${result.total.recipients}`);
        })
        .catch(err => {
          console.error('❌ Failed to send schedule update notifications:', err.message);
        });
    }

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: schedule
    });

  } catch (error) {
    sendError(res, error, 'Error updating schedule');
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

    // Faculty load is computed from saved schedules (utils/facultyLoad), not kept in a counter.

    // Soft delete
    schedule.isActive = false;
    await schedule.save();

    // The class space has to go with it. It was left active before, so a deleted
    // class kept appearing in the students' and teacher's class list with no way
    // to remove it, and syncSectionEnrollment kept re-enrolling students.
    await deactivateClassSpaceForSchedule(schedule);

    notifyScheduleEvent(schedule, 'removed', { actor: actorOf(req) });

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    sendError(res, error, 'Error deleting schedule');
  }
};

// Helper function to check schedule conflicts
async function checkScheduleConflicts({
  subject,
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

  // The room itself: deactivated, or blocked at this time (maintenance, events)
  const roomDoc = looksLikeObjectId(String(room || ''))
    ? await Room.findById(room).select('roomCode isActive unavailableTimeSlots').lean()
    : null;
  if (roomDoc && roomDoc.isActive === false) {
    add({
      type: 'room',
      message: `Room ${roomDoc.roomCode} is deactivated. Pick another room or restore it on the Rooms page`,
      day: timeSlots[0]?.day,
      time: '',
      conflictingSchedule: roomDoc.roomCode
    });
  }
  for (const newSlot of timeSlots) {
    for (const window of roomDoc?.unavailableTimeSlots || []) {
      if (window.day !== newSlot.day) continue;
      if (!checkTimeOverlap(newSlot.startTime, newSlot.endTime, window.startTime, window.endTime)) continue;
      add({
        type: 'room',
        message: `Room ${roomDoc.roomCode} is blocked ${window.startTime}–${window.endTime}${window.reason ? ` (${window.reason})` : ''}`,
        day: newSlot.day,
        time: `${window.startTime} - ${window.endTime}`,
        conflictingSchedule: roomDoc.roomCode
      });
    }
  }

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
          // EXCEPTION: NSTP is a combined class where one instructor teaches multiple sections simultaneously
          const isNewNSTP = (subject?.subjectCode || '').toUpperCase().includes('NSTP') ||
                           (subject?.subjectName || '').toUpperCase().includes('NSTP');
          const isExistingNSTP = (existingSchedule.subject?.subjectCode || '').toUpperCase().includes('NSTP') ||
                                (existingSchedule.subject?.subjectName || '').toUpperCase().includes('NSTP');
          
          // Only report conflict if NOT both NSTP (NSTP combined class is allowed)
          if (!(isNewNSTP && isExistingNSTP)) {
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
    if (!isStaff(req.user)) Object.assign(query, OFFICIAL_ONLY);

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
    sendError(res, error, 'Error fetching schedules');
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
    // A teacher's own view shows only official classes
    if (!isStaff(req.user)) Object.assign(query, OFFICIAL_ONLY);

    const schedules = await Schedule.find(query)
      .populate('subject', 'subjectCode subjectName units')
      .populate('faculty', 'firstName lastName department')
      .sort({ 'timeSlots.day': 1 });

    // Manually lookup rooms since room is stored as a string (ObjectId or room code)
    const roomIds = [...new Set(schedules.map(s => s.room).filter(Boolean))];
    const rooms = await Room.find({ 
      $or: [
        { _id: { $in: roomIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } },
        { roomCode: { $in: roomIds } }
      ]
    });
    
    // Create a map for quick lookup
    const roomMap = {};
    rooms.forEach(room => {
      roomMap[room._id.toString()] = room;
      roomMap[room.roomCode] = room;
    });

    // Attach room data to schedules
    const schedulesWithRooms = schedules.map(schedule => {
      const scheduleObj = schedule.toObject();
      const roomData = roomMap[scheduleObj.room];
      if (roomData) {
        scheduleObj.roomData = {
          _id: roomData._id,
          roomCode: roomData.roomCode,
          roomName: roomData.roomName,
          building: roomData.building
        };
      }
      return scheduleObj;
    });

    res.status(200).json({
      success: true,
      count: schedulesWithRooms.length,
      data: schedulesWithRooms
    });

  } catch (error) {
    sendError(res, error, 'Error fetching faculty schedule');
  }
};

// @desc    Check for conflicts
// @route   POST /api/schedules/check-conflicts
// @access  Private
exports.checkConflicts = async (req, res) => {
  try {
    // `subject` was used below but never read from the body, so every single
    // check failed with "subject is not defined"
    const { subject, faculty, room, sectionCode, timeSlots, academicYear, semester, program, yearLevel } = req.body;

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
                    // EXCEPTION: NSTP is a combined class where one instructor teaches multiple sections simultaneously
                    // Check if BOTH schedules are NSTP
                    const isNSTP1 = (schedule1.subject?.subjectCode || '').toUpperCase().includes('NSTP') ||
                                    (schedule1.subject?.subjectName || '').toUpperCase().includes('NSTP');
                    const isNSTP2 = (schedule2.subject?.subjectCode || '').toUpperCase().includes('NSTP') ||
                                    (schedule2.subject?.subjectName || '').toUpperCase().includes('NSTP');
                    
                    // If both are NSTP, this is NOT a conflict (it's a combined class)
                    if (!isNSTP1 || !isNSTP2) {
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
      subject,
      faculty,
      room,
      sectionCode,
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
    sendError(res, error, 'Error checking conflicts');
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

    const changed = await applyPublishState([schedule], true, actorOf(req));

    res.status(200).json({
      success: true,
      message: changed.length
        ? 'Published. The teacher and the section’s students were notified.'
        : 'This class was already published',
      data: { ...schedule.toObject(), status: 'published' }
    });

  } catch (error) {
    sendError(res, error, 'Error publishing schedule');
  }
};

// @desc    Publish many classes: { ids } or { program, yearLevel, semester, academicYear[, sectionCode] }
// @route   POST /api/schedules/publish
// @access  Private/Admin
exports.batchPublishSchedules = async (req, res) => {
  try {
    const query = await publishScope(req);
    if (query.error) return res.status(400).json({ success: false, message: query.error });

    const schedules = await Schedule.find({ ...query, isActive: true, status: { $ne: 'published' } });
    const changed = await applyPublishState(schedules, true, actorOf(req));

    res.status(200).json({
      success: true,
      message: changed.length
        ? `Published ${changed.length} class${changed.length === 1 ? '' : 'es'}. Teachers and students were notified.`
        : 'Everything selected is already published',
      count: changed.length
    });
  } catch (error) {
    sendError(res, error, 'Error publishing schedules');
  }
};

// @desc    Withdraw published classes back to draft: same body as publish
// @route   POST /api/schedules/unpublish
// @access  Private/Admin
exports.batchUnpublishSchedules = async (req, res) => {
  try {
    const query = await publishScope(req);
    if (query.error) return res.status(400).json({ success: false, message: query.error });

    const schedules = await Schedule.find({ ...query, isActive: true, status: 'published' });
    const changed = await applyPublishState(schedules, false, actorOf(req));

    res.status(200).json({
      success: true,
      message: changed.length
        ? `Moved ${changed.length} class${changed.length === 1 ? '' : 'es'} back to draft. Teachers and students were told it’s being changed.`
        : 'None of the selected classes were published',
      count: changed.length
    });
  } catch (error) {
    sendError(res, error, 'Error withdrawing schedules');
  }
};

/** Which classes a publish/unpublish request means; program managers stay in their program. */
async function publishScope(req) {
  const { ids, program, yearLevel, semester, academicYear, sectionCode } = req.body || {};
  const own = req.user.role === 'program_manager' ? req.user.program : null;
  if (Array.isArray(ids) && ids.length) {
    return { _id: { $in: ids }, ...(own ? { program: own } : {}) };
  }
  if (!program || !semester || !academicYear || (!yearLevel && !sectionCode)) {
    return { error: 'Pick the classes, or a program, term and year level (or section)' };
  }
  if (own && program !== own) return { error: `You can only publish ${own} classes` };
  return {
    program,
    semester: Number(semester),
    academicYear,
    ...(yearLevel ? { yearLevel: Number(yearLevel) } : {}),
    ...(sectionCode ? { sectionCode: String(sectionCode).toUpperCase() } : {}),
  };
}

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
      // Faculty load is computed from saved schedules (utils/facultyLoad), not kept in a counter.
      schedule.isActive = false;
      await schedule.save();
      await deactivateClassSpaceForSchedule(schedule);
      deletedCount++;
    }

    notifyTimetableBatch(schedules, 'removed');

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} schedule(s)`,
      count: deletedCount
    });

  } catch (error) {
    sendError(res, error, 'Error deleting schedules');
  }
};

/**
 * Objective weights the client may steer, as named presets.
 *
 * The solver already accepted a `weights` override but nothing ever sent one,
 * so every generation ran on the built-in defaults. Presets are used instead of
 * raw numbers so a request can't push the objective somewhere nonsensical.
 * `balanced` deliberately sends nothing and lets the solver's defaults stand.
 */
const SOLVER_PRIORITIES = {
  balanced: null,
  experience: { experience: 20, balance: 20 },
  workload: { experience: 5, balance: 120 },
  compact: { compact: 6, prefer_8am: 80 }
};

const resolveSolverWeights = (priority) =>
  SOLVER_PRIORITIES[priority] || undefined;

/**
 * Which engine a request runs on.
 *
 * 'ortools' means "OR-Tools, falling back to the built-in solver if it cannot
 * run here". 'builtin' forces the built-in solver. 'greedy' is what older
 * clients send; it used to select a first-fit heuristic and now gets the
 * built-in solver, which honours the same rules and priorities as OR-Tools.
 */
const resolveEngine = (method) =>
  (method === 'builtin' || method === 'greedy' ? 'builtin' : 'auto');

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
      method = 'ortools', // 'ortools' (with automatic fallback) or 'builtin'
      shift = 'Day',      // 'Day' or 'Night'
      timeLimit = 60,     // seconds for OR-Tools
      priority = 'balanced'  // which objective preset the solver should favour
    } = req.body;

    if (!academicYear || !semester || !program || !yearLevel || !section) {
      return res.status(400).json({
        success: false,
        message: 'Academic year, semester, program, year level, and section are required'
      });
    }

    // Both engines take the same input and enforce the same rules; see
    // resolveEngine. The old first-fit heuristic is no longer reachable from
    // here - it skipped any subject that no longer fit and could double-book.
    const { generateWithORTools } = require('../services/ortoolsBridge.service');

    const result = await generateWithORTools({
      academicYear,
      semester,
      program,
      yearLevel,
      section,
      shift,
      timeLimit,
      weights: resolveSolverWeights(priority),
      engine: resolveEngine(method)
    });

    if (result.success && result.schedules) {
      const savedSchedules = [];
      const errors = [];

      const homeRoomOf = homeRoomResolver();
      for (const scheduleData of result.schedules) {
        try {
          scheduleData.room = (await homeRoomOf(scheduleData)) || scheduleData.room;
          const schedule = await Schedule.create(scheduleData);
          savedSchedules.push(schedule);

          // Faculty load is computed from saved schedules (utils/facultyLoad).
          // The $inc on currentLoad that used to be here was dropped by
          // Mongoose: the field isn't in the Faculty schema.
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
      notifyTimetableBatch(savedSchedules, 'generated');
    }

    res.status(200).json({
      success: result.success,
      // `result.error` carries the solver's specific reason (a section that is
      // already full, no lab room, a load cap). Dropping it left the user with
      // a bare "Schedule generation failed".
      message: result.message
        || result.error
        || (result.success ? 'Schedule generated successfully' : 'Schedule generation failed'),
      method: result.method,
      engine: result.engine,
      blockers: result.blockers || [],
      conflicts: result.conflicts || [],
      diagnostics: result.diagnostics || [],
      data: result
    });

  } catch (error) {
    sendError(res, error, 'Error generating schedule');
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
      method = 'ortools',
      shift = 'Day',
      timeLimit = 60,
      priority = 'balanced'
    } = req.body;

    if (!academicYear || !semester || !program || !yearLevel || !section) {
      return res.status(400).json({
        success: false,
        message: 'Academic year, semester, program, year level, and section are required'
      });
    }

    const { previewWithORTools } = require('../services/ortoolsBridge.service');

    // Previewing and saving must run the same engine on the same input, or the
    // timetable saved is not the one that was reviewed.
    const solved = await previewWithORTools({
      academicYear,
      semester,
      program,
      yearLevel,
      section,
      shift,
      timeLimit,
      weights: resolveSolverWeights(priority),
      engine: resolveEngine(method)
    });

    const preview = {
      ...solved.preview,
      success: solved.success,
      message: solved.message,
      status: solved.status,
      blockers: solved.blockers || [],
      diagnostics: solved.diagnostics || [],
      skipped: solved.skipped || [],
      methodNote: solved.fellBack
        ? 'OR-Tools is unavailable on this server, so the built-in constraint solver was used'
        : `Preview generated with the ${solved.method}`,
    };

    res.status(200).json({
      success: preview.success,
      message: preview.message || (preview.success ? 'Schedule preview generated successfully' : 'Schedule preview generation failed'),
      method: solved.method,
      // The engine that actually ran - 'builtin' when OR-Tools fell back
      engine: solved.engine,
      fellBack: !!solved.fellBack,
      data: preview
    });

  } catch (error) {
    sendError(res, error, 'Error previewing schedule');
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

    const homeRoomOf = homeRoomResolver();
    for (const group of groups) {
      const scheduleData = group.merged;
      try {
        scheduleData.room = (await homeRoomOf(scheduleData)) || scheduleData.room;
        const existing = await findExistingOffering(scheduleData);

        if (existing) {
          // Already scheduled: add the meeting times, leave faculty load alone.
          savedSchedules.push(await appendSlotsToOffering(existing, scheduleData.timeSlots));
          continue;
        }

        const schedule = await Schedule.create(scheduleData);
        savedSchedules.push(schedule);

        // Faculty load is computed from saved schedules (utils/facultyLoad).
        // The $inc on currentLoad that used to be here was dropped by
        // Mongoose: the field isn't in the Faculty schema.
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
    notifyTimetableBatch(savedSchedules, 'generated');

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
    sendError(res, error, 'Error saving schedules');
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
    sendError(res, error, 'Error checking OR-Tools status');
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
    const homeRoomOf = homeRoomResolver();

    for (let i = 0; i < schedules.length; i++) {
      const row = schedules[i];
      const label = row?.subjectCode || `row ${i + 1}`;
      // Every class of a section with a home room goes there
      if (row && row.sectionCode) {
        const home = await homeRoomOf(row);
        if (home) row.room = home;
      }

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
        subject: row.subject,
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

      created.push(schedule);
    }

    // Each subject offering gets its class space so the teacher can post and the
    // section's students are enrolled automatically.
    const spaces = await ensureClassSpacesForSchedules(created);
    notifyTimetableBatch(created, 'generated');

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
    sendError(res, error, 'Error saving schedules');
  }
};

// @desc    Get schedule conflicts
// @route   GET /api/schedules/conflicts
// @access  Private (Admin/Scheduling Officer only)
exports.getConflicts = async (req, res) => {
  try {
    const { detectAllConflicts, getConflictSummary } = require('../services/conflictDetection.service');
    
    const { summary } = req.query;
    
    if (summary === 'true') {
      const conflictSummary = await getConflictSummary();
      return res.json({
        success: true,
        data: conflictSummary
      });
    }
    
    const conflicts = await detectAllConflicts();
    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    sendError(res, error, 'Failed to detect conflicts');
  }
};
