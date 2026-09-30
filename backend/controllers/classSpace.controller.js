const ClassSpace = require('../models/ClassSpace.model');
const Schedule = require('../models/Schedule.model');
const Section = require('../models/Section.model');
const Student = require('../models/Student.model');
const Subject = require('../models/Subject.model');
const { validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');
const { notifyAnnouncement, notifyMaterial } = require('../services/emailNotification.service');
const { 
  notifyAnnouncementCreated, 
  notifyMaterialUploaded 
} = require('../services/inAppNotification.service');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Populate spec used wherever a class space is returned to the client. */
const CLASS_POPULATE = [
  { path: 'subject', select: 'subjectCode subjectName units description' },
  { path: 'faculty', select: 'employeeId', populate: { path: 'user', select: 'firstName lastName email profilePicture' } },
  { path: 'schedule', select: 'timeSlots room shift academicYear semester status' },
];

const DETAIL_POPULATE = [
  ...CLASS_POPULATE,
  { path: 'announcements.postedBy', select: 'firstName lastName role' },
  { path: 'materials.uploadedBy', select: 'firstName lastName role' },
  {
    path: 'enrolledStudents.student',
    select: 'studentId studentType sectionCode',
    populate: { path: 'user', select: 'firstName lastName email profilePicture' },
  },
];

/** The Student document for the logged-in user, or null. */
const getStudentFor = (user) => Student.findOne({ user: user._id });

// Shared with the schedule controller: `Schedule.room` is a String holding a
// Room id, so it can't be populated and needs resolving to a label.
const { attachNestedScheduleRoomLabels: attachRoomLabels } = require('../utils/roomLabel');


const {
  ensureClassSpaceForSchedule,
  addStudentToSpace,
  syncSectionEnrollment,
} = require('../services/classSpace.service');

/**
 * Can this user read/write in this class space?
 * Returns { canRead, canPost, reason }.
 */
const resolveAccess = async (user, classSpace) => {
  // Admins and scheduling officers see everything
  if (user.role === 'admin' || user.role === 'scheduling_officer') {
    return { canRead: true, canPost: true };
  }

  // Program managers are limited to their own program
  if (user.role === 'program_manager') {
    const sameProgram = !classSpace.program || classSpace.program === user.program;
    return {
      canRead: sameProgram,
      canPost: sameProgram,
      reason: sameProgram ? undefined : `This class belongs to ${classSpace.program}, not ${user.program}`,
    };
  }

  // Faculty may post only in the classes they teach
  if (user.role === 'faculty') {
    // user.facultyProfile might be populated (object with _id) or just an ObjectId
    const userFacultyId = user.facultyProfile?._id || user.facultyProfile;
    // classSpace.faculty might also be populated or just an ObjectId
    const classFacultyId = classSpace.faculty?._id || classSpace.faculty;
    
    const owns =
      userFacultyId &&
      classFacultyId &&
      userFacultyId.toString() === classFacultyId.toString();
    
    return {
      canRead: true,
      canPost: !!owns,
      reason: owns ? undefined : 'You can only post in classes you teach',
    };
  }

  // Students may read only classes they are enrolled in
  if (user.role === 'student') {
    const student = await getStudentFor(user);
    const enrolled = student && classSpace.hasStudent(student._id);
    return {
      canRead: !!enrolled,
      canPost: false,
      reason: enrolled ? undefined : 'You are not enrolled in this class',
    };
  }

  return { canRead: false, canPost: false, reason: 'Not authorized' };
};

/* ------------------------------------------------------------------ *
 * Listing
 * ------------------------------------------------------------------ */

// @desc    Get all class spaces (staff view)
// @route   GET /api/classSpaces
// @access  Private (admin, scheduling_officer, program_manager, faculty)
exports.getAllClassSpaces = async (req, res) => {
  try {
    const { academicYear, semester, program, sectionCode, isActive } = req.query;

    const query = {};
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester, 10);
    if (sectionCode) query.sectionCode = sectionCode.toUpperCase();
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Program managers only ever see their own program.
    // checkProgramAccess also injects req.query.program for them.
    if (req.user.role === 'program_manager') {
      query.program = req.user.program;
    } else if (program) {
      query.program = program;
    }

    // Faculty see the classes they teach
    if (req.user.role === 'faculty') {
      query.faculty = req.user.facultyProfile;
    }

    const classSpaces = await ClassSpace.find(query)
      .populate(CLASS_POPULATE)
      .sort({ sectionCode: 1, createdAt: -1 })
      .lean();

    await attachRoomLabels(classSpaces);

    res.status(200).json({
      success: true,
      count: classSpaces.length,
      data: classSpaces,
    });
  } catch (error) {
    console.error('Get all class spaces error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class spaces',
      error: error.message,
    });
  }
};

// @desc    Get the current user's class spaces
// @route   GET /api/classSpaces/my-classes
// @access  Private
exports.getMyClassSpaces = async (req, res) => {
  try {
    /* ---------------- Faculty ---------------- */
    if (req.user.role === 'faculty') {
      if (!req.user.facultyProfile) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          message: 'No faculty profile is linked to your account',
        });
      }

      // Make sure every schedule this teacher owns has a space
      const schedules = await Schedule.find({
        faculty: req.user.facultyProfile,
        isActive: true,
      });
      for (const s of schedules) {
        await ensureClassSpaceForSchedule(s);
      }

      const classSpaces = await ClassSpace.find({
        faculty: req.user.facultyProfile,
        isActive: true,
      })
        .populate(CLASS_POPULATE)
        .sort({ sectionCode: 1 })
        .lean();

      await attachRoomLabels(classSpaces);

      return res.status(200).json({
        success: true,
        count: classSpaces.length,
        role: 'faculty',
        data: classSpaces,
      });
    }

    /* ---------------- Student ---------------- */
    if (req.user.role === 'student') {
      const student = await getStudentFor(req.user);

      if (!student) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          enrolled: false,
          message: 'No student profile is linked to your account',
        });
      }

      const isIrregular = student.studentType === 'irregular';

      // Nothing joined yet - tell the client which code to ask for
      const hasJoinedSomething = isIrregular
        ? (student.subjectCodes || []).length > 0
        : !!student.sectionCode;

      if (!hasJoinedSomething) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          enrolled: false,
          studentType: student.studentType,
          codeType: isIrregular ? 'subject' : 'section',
          profile: {
            studentId: student.studentId,
            program: student.program,
            studentType: student.studentType,
            sectionCode: student.sectionCode || null,
            subjectCodes: student.subjectCodes || [],
            academicYear: student.academicYear,
            semester: student.semester,
            enrollmentStatus: student.enrollmentStatus,
          },
          message: isIrregular
            ? 'Enter a subject class code to join a class'
            : 'Enter your section enrollment code to join your section',
        });
      }

      // Regular students: keep membership in step with their section, so
      // subjects added to the section after they joined still show up.
      if (!isIrregular) {
        await syncSectionEnrollment(student);
      }

      const classSpaces = await ClassSpace.find({
        'enrolledStudents.student': student._id,
        isActive: true,
      })
        .populate(CLASS_POPULATE)
        .sort({ sectionCode: 1 })
        .lean();

      await attachRoomLabels(classSpaces);

      return res.status(200).json({
        success: true,
        count: classSpaces.length,
        enrolled: true,
        studentType: student.studentType,
        codeType: isIrregular ? 'subject' : 'section',
        sectionCode: student.sectionCode || null,
        subjectCodes: student.subjectCodes || [],
        // Enough profile detail for the student dashboard, so it doesn't have to
        // fetch every student record and pick itself out client-side.
        profile: {
          studentId: student.studentId,
          program: student.program,
          studentType: student.studentType,
          sectionCode: student.sectionCode || null,
          subjectCodes: student.subjectCodes || [],
          academicYear: student.academicYear,
          semester: student.semester,
          enrollmentStatus: student.enrollmentStatus,
        },
        data: classSpaces,
      });
    }

    /* ---------------- Staff ---------------- */
    const query = { isActive: true };
    if (req.user.role === 'program_manager') query.program = req.user.program;

    const classSpaces = await ClassSpace.find(query)
      .populate(CLASS_POPULATE)
      .sort({ sectionCode: 1 })
      .lean();

    await attachRoomLabels(classSpaces);

    return res.status(200).json({
      success: true,
      count: classSpaces.length,
      role: req.user.role,
      data: classSpaces,
    });
  } catch (error) {
    console.error('Get my classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class spaces',
      error: error.message,
    });
  }
};

// @desc    Get one class space
// @route   GET /api/classSpaces/:id
// @access  Private (must be a member, the teacher, or staff)
exports.getClassSpaceById = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id).populate(DETAIL_POPULATE);

    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const access = await resolveAccess(req.user, classSpace);
    if (!access.canRead) {
      return res.status(403).json({
        success: false,
        message: access.reason || 'Not authorized to view this class',
      });
    }

    const data = classSpace.toObject();
    await attachRoomLabels([data]);

    // Students never need to see the join code or the full roster
    if (req.user.role === 'student') {
      delete data.classCode;
      data.enrolledCount = classSpace.enrolledStudents.length;
      delete data.enrolledStudents;
    }

    res.status(200).json({ success: true, canPost: access.canPost, data });
  } catch (error) {
    console.error('Get class space error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class space',
      error: error.message,
    });
  }
};

/* ------------------------------------------------------------------ *
 * Enrollment
 * ------------------------------------------------------------------ */

// @desc    Join by code. Section code for regular students, subject class code for irregular.
// @route   POST /api/classSpaces/join
// @access  Private (students)
exports.joinByCode = async (req, res) => {
  try {
    const raw = (req.body.code || req.body.enrollmentCode || '').toString().toUpperCase().trim();

    if (!raw) {
      return res.status(400).json({ success: false, message: 'An enrollment code is required' });
    }

    const student = await getStudentFor(req.user);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'No student profile is linked to your account. Contact your program manager.',
      });
    }

    /* ---- irregular: the code identifies ONE subject ---- */
    if (student.studentType === 'irregular') {
      const classSpace = await ClassSpace.findOne({ classCode: raw, isActive: true })
        .populate('subject', 'subjectCode subjectName units program');

      if (!classSpace) {
        return res.status(404).json({
          success: false,
          message: 'Invalid subject class code. Irregular students join one subject at a time.',
        });
      }

      if (classSpace.hasStudent(student._id)) {
        return res.status(400).json({
          success: false,
          message: `You have already joined ${classSpace.subject?.subjectCode}`,
        });
      }

      await addStudentToSpace(classSpace, student, 'subject');

      const subjectCode = classSpace.subject?.subjectCode;
      await Student.updateOne(
        { _id: student._id },
        {
          $addToSet: { subjectCodes: subjectCode },
          $set: { enrollmentStatus: 'enrolled' },
        }
      );

      return res.status(200).json({
        success: true,
        joined: 'subject',
        message: `Joined ${subjectCode} - ${classSpace.subject?.subjectName}`,
        data: {
          classSpaceId: classSpace._id,
          subjectCode,
          subjectName: classSpace.subject?.subjectName,
          sectionCode: classSpace.sectionCode,
        },
      });
    }

    /* ---- regular: the code identifies a SECTION ---- */
    const section = await Section.findOne({ enrollmentCode: raw, isActive: true }).populate({
      path: 'adviser',
      populate: { path: 'user', select: 'firstName lastName' },
    });

    if (!section) {
      // Give a precise error if they pasted a subject code by mistake
      const asClass = await ClassSpace.findOne({ classCode: raw, isActive: true });
      if (asClass) {
        return res.status(400).json({
          success: false,
          message:
            'That is a subject class code. Regular students join with a section enrollment code from their program manager.',
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Invalid section enrollment code. Please check and try again.',
      });
    }

    if (student.sectionCode === section.sectionCode) {
      return res.status(400).json({
        success: false,
        message: `You are already enrolled in ${section.sectionCode}`,
      });
    }

    if (section.currentStudents >= section.maxStudents) {
      return res.status(400).json({ success: false, message: 'This section is already full' });
    }

    const previousSectionCode = student.sectionCode;

    // Move the student to the new section
    student.sectionCode = section.sectionCode;
    student.enrollmentStatus = 'enrolled';
    student.academicYear = section.academicYear;
    student.semester = section.semester;
    await student.save();

    // Leaving a section must release the old seat, otherwise the counter drifts
    if (previousSectionCode && previousSectionCode !== section.sectionCode) {
      await Section.updateOne(
        { sectionCode: previousSectionCode, currentStudents: { $gt: 0 } },
        { $inc: { currentStudents: -1 } }
      );

      const oldSpaces = await ClassSpace.find({ sectionCode: previousSectionCode });
      for (const cs of oldSpaces) {
        if (cs.removeStudent(student._id)) await cs.save();
      }
      await Student.updateOne(
        { _id: student._id },
        { $pull: { enrolledClasses: { $in: oldSpaces.map(s => s._id) } } }
      );
    }

    await Section.updateOne({ _id: section._id }, { $inc: { currentStudents: 1 } });

    // Enroll into every subject the section takes
    const joined = await syncSectionEnrollment(student);

    return res.status(200).json({
      success: true,
      joined: 'section',
      message: `Enrolled in ${section.sectionCode} with ${joined.length} ${
        joined.length === 1 ? 'subject' : 'subjects'
      }`,
      data: {
        sectionCode: section.sectionCode,
        program: section.program,
        yearLevel: section.yearLevel,
        shift: section.shift,
        academicYear: section.academicYear,
        semester: section.semester,
        classCount: joined.length,
        adviser: section.adviser?.user
          ? `${section.adviser.user.firstName} ${section.adviser.user.lastName}`
          : null,
      },
    });
  } catch (error) {
    console.error('Join by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining class',
      error: error.message,
    });
  }
};

// @desc    Leave a class space (irregular students drop a single subject)
// @route   POST /api/classSpaces/:id/leave
// @access  Private (students)
exports.leaveClassSpace = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id).populate('subject', 'subjectCode');
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const student = await getStudentFor(req.user);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const entry = classSpace.findEnrollment(student._id);
    if (!entry) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this class' });
    }

    // Section-based membership is driven by the section, not per class
    if (entry.enrollmentType === 'section') {
      return res.status(400).json({
        success: false,
        message:
          'This class comes from your section. Ask your program manager to change your section.',
      });
    }

    classSpace.removeStudent(student._id);
    await classSpace.save();

    await Student.updateOne(
      { _id: student._id },
      {
        $pull: {
          enrolledClasses: classSpace._id,
          subjectCodes: classSpace.subject?.subjectCode,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Left ${classSpace.subject?.subjectCode || 'class'}`,
    });
  } catch (error) {
    console.error('Leave class space error:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving class',
      error: error.message,
    });
  }
};

// @desc    Regenerate a class space's join code
// @route   PUT /api/classSpaces/:id/regenerate-code
// @access  Private (teacher of the class, or staff)
exports.regenerateClassCode = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const access = await resolveAccess(req.user, classSpace);
    if (!access.canPost) {
      return res.status(403).json({ success: false, message: access.reason || 'Not authorized' });
    }

    classSpace.classCode = await ClassSpace.generateUniqueClassCode();
    await classSpace.save();

    res.status(200).json({
      success: true,
      message: 'Class code regenerated',
      data: { classCode: classSpace.classCode },
    });
  } catch (error) {
    console.error('Regenerate class code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error regenerating class code',
      error: error.message,
    });
  }
};

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

// @desc    Post an announcement
// @route   POST /api/classSpaces/:id/announcements
// @access  Private (teacher of the class, or staff)
exports.postAnnouncement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const access = await resolveAccess(req.user, classSpace);
    if (!access.canPost) {
      return res.status(403).json({ success: false, message: access.reason || 'Not authorized' });
    }

    const { title, content, isPinned } = req.body;

    classSpace.announcements.push({
      title,
      content,
      isPinned: isPinned === true || isPinned === 'true',
      postedBy: req.user._id,
    });

    await classSpace.save();
    await classSpace.populate('announcements.postedBy', 'firstName lastName role');

    const newAnnouncement = classSpace.announcements[classSpace.announcements.length - 1];

    // Send email notifications to enrolled students (async, don't wait)
    notifyAnnouncement(classSpace._id, newAnnouncement._id)
      .then(result => {
        console.log(`📧 Announcement email notifications sent: ${result.sent}/${result.total}`);
      })
      .catch(err => {
        console.error('❌ Failed to send announcement email notifications:', err.message);
      });

    // Create in-app notifications (async, don't wait)
    notifyAnnouncementCreated(classSpace._id, newAnnouncement._id)
      .then(result => {
        console.log(`🔔 Announcement in-app notifications created: ${result.recipients} users`);
      })
      .catch(err => {
        console.error('❌ Failed to create announcement in-app notifications:', err.message);
      });

    res.status(201).json({
      success: true,
      message: 'Announcement posted',
      data: newAnnouncement,
    });
  } catch (error) {
    console.error('Post announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error posting announcement',
      error: error.message,
    });
  }
};

// @desc    Update an announcement
// @route   PUT /api/classSpaces/:id/announcements/:announcementId
// @access  Private (author or admin)
exports.updateAnnouncement = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const announcement = classSpace.announcements.id(req.params.announcementId);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const isAuthor = announcement.postedBy.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the author can edit this announcement',
      });
    }

    const { title, content, isPinned } = req.body;
    if (title !== undefined) announcement.title = title;
    if (content !== undefined) announcement.content = content;
    if (isPinned !== undefined) announcement.isPinned = isPinned === true || isPinned === 'true';
    announcement.editedAt = new Date();

    await classSpace.save();
    await classSpace.populate('announcements.postedBy', 'firstName lastName role');

    res.status(200).json({ success: true, message: 'Announcement updated', data: announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message,
    });
  }
};

// @desc    Delete an announcement
// @route   DELETE /api/classSpaces/:id/announcements/:announcementId
// @access  Private (author or admin)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const announcement = classSpace.announcements.id(req.params.announcementId);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const isAuthor = announcement.postedBy.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the author can delete this announcement',
      });
    }

    // Mongoose 7 removed subdoc.remove(); pull by id instead
    classSpace.announcements.pull({ _id: req.params.announcementId });
    await classSpace.save();

    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message,
    });
  }
};

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

// @desc    Upload a material
// @route   POST /api/classSpaces/:id/materials
// @access  Private (teacher of the class, or staff)
exports.uploadMaterial = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach a file' });
    }

    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const access = await resolveAccess(req.user, classSpace);
    if (!access.canPost) {
      // Don't leave an orphan file behind on a rejected upload
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ success: false, message: access.reason || 'Not authorized' });
    }

    const { title, description } = req.body;

    classSpace.materials.push({
      title: title || req.file.originalname,
      description: description || '',
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      uploadedBy: req.user._id,
    });

    await classSpace.save();
    await classSpace.populate('materials.uploadedBy', 'firstName lastName role');

    const newMaterial = classSpace.materials[classSpace.materials.length - 1];

    // Send email notifications to enrolled students (async, don't wait)
    notifyMaterial(classSpace._id, newMaterial._id)
      .then(result => {
        console.log(`📧 Material email notifications sent: ${result.sent}/${result.total}`);
      })
      .catch(err => {
        console.error('❌ Failed to send material email notifications:', err.message);
      });

    // Create in-app notifications (async, don't wait)
    notifyMaterialUploaded(classSpace._id, newMaterial._id)
      .then(result => {
        console.log(`🔔 Material in-app notifications created: ${result.recipients} users`);
      })
      .catch(err => {
        console.error('❌ Failed to create material in-app notifications:', err.message);
      });

    res.status(201).json({
      success: true,
      message: 'Material uploaded',
      data: newMaterial,
    });
  } catch (error) {
    console.error('Upload material error:', error);
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({
      success: false,
      message: 'Error uploading material',
      error: error.message,
    });
  }
};

// @desc    Delete a material
// @route   DELETE /api/classSpaces/:id/materials/:materialId
// @access  Private (uploader or admin)
exports.deleteMaterial = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const material = classSpace.materials.id(req.params.materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const isUploader = material.uploadedBy.toString() === req.user._id.toString();
    if (!isUploader && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the uploader can delete this material',
      });
    }

    // Remove the file, but never let a missing file block the DB update
    try {
      const uploadRoot = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
      await fs.unlink(path.join(uploadRoot, path.basename(material.fileUrl)));
    } catch (fileError) {
      console.warn('Could not delete file from disk:', fileError.message);
    }

    // Mongoose 7 removed subdoc.remove(); pull by id instead
    classSpace.materials.pull({ _id: req.params.materialId });
    await classSpace.save();

    res.status(200).json({ success: true, message: 'Material deleted' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting material',
      error: error.message,
    });
  }
};

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

// @desc    Create a class space for a schedule
// @route   POST /api/classSpaces
// @access  Private (admin, scheduling_officer, program_manager)
exports.createClassSpace = async (req, res) => {
  try {
    const { scheduleId } = req.body;
    if (!scheduleId) {
      return res.status(400).json({ success: false, message: 'scheduleId is required' });
    }

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (req.user.role === 'program_manager' && schedule.program !== req.user.program) {
      return res.status(403).json({
        success: false,
        message: `You can only create class spaces for ${req.user.program}`,
      });
    }

    const existing = await ClassSpace.findOne({ schedule: scheduleId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A class space already exists for this schedule',
        data: existing,
      });
    }

    const classSpace = await ensureClassSpaceForSchedule(schedule);
    await Schedule.updateOne({ _id: schedule._id }, { classSpace: classSpace._id });
    await classSpace.populate(CLASS_POPULATE);

    res.status(201).json({ success: true, message: 'Class space created', data: classSpace });
  } catch (error) {
    console.error('Create class space error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating class space',
      error: error.message,
    });
  }
};

// @desc    Update a class space
// @route   PUT /api/classSpaces/:id
// @access  Private (teacher of the class, or staff)
exports.updateClassSpace = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    const access = await resolveAccess(req.user, classSpace);
    if (!access.canPost) {
      return res.status(403).json({ success: false, message: access.reason || 'Not authorized' });
    }

    if (req.body.isActive !== undefined) {
      classSpace.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }

    await classSpace.save();
    await classSpace.populate(CLASS_POPULATE);

    res.status(200).json({ success: true, message: 'Class space updated', data: classSpace });
  } catch (error) {
    console.error('Update class space error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating class space',
      error: error.message,
    });
  }
};

// @desc    Deactivate a class space
// @route   DELETE /api/classSpaces/:id
// @access  Private (admin)
exports.deleteClassSpace = async (req, res) => {
  try {
    const classSpace = await ClassSpace.findById(req.params.id);
    if (!classSpace) {
      return res.status(404).json({ success: false, message: 'Class space not found' });
    }

    classSpace.isActive = false;
    await classSpace.save();

    res.status(200).json({ success: true, message: 'Class space deactivated' });
  } catch (error) {
    console.error('Delete class space error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting class space',
      error: error.message,
    });
  }
};


// @desc    Enroll student using class code (self-enrollment)
// @route   POST /api/classSpaces/enroll-by-code
// @access  Private (student only)
exports.enrollByCode = async (req, res) => {
  try {
    const { classCode } = req.body;

    if (!classCode) {
      return res.status(400).json({
        success: false,
        message: 'Class code is required'
      });
    }

    // Find the class space
    const classSpace = await ClassSpace.findOne({ classCode: classCode.toUpperCase() })
      .populate('subject', 'subjectCode subjectName')
      .populate('schedule', 'timeSlots');

    if (!classSpace) {
      return res.status(404).json({
        success: false,
        message: 'Invalid class code. Please check and try again.'
      });
    }

    if (!classSpace.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This class is no longer active.'
      });
    }

    // Get the student record
    const student = await Student.findOne({ user: req.user._id });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found. Please contact administration.'
      });
    }

    // Check if already enrolled
    if (classSpace.hasStudent(student._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this class.'
      });
    }

    // Check for time conflicts with existing enrollments
    const studentClasses = await ClassSpace.find({
      'enrolledStudents.student': student._id,
      isActive: true
    }).populate('schedule', 'timeSlots');

    // Simple conflict check
    if (classSpace.schedule && classSpace.schedule.timeSlots) {
      for (const existingClass of studentClasses) {
        if (existingClass.schedule && existingClass.schedule.timeSlots) {
          // Check for time slot overlaps
          const hasConflict = classSpace.schedule.timeSlots.some(newSlot =>
            existingClass.schedule.timeSlots.some(existingSlot =>
              newSlot.day === existingSlot.day &&
              timeSlotsOverlap(newSlot, existingSlot)
            )
          );

          if (hasConflict) {
            return res.status(400).json({
              success: false,
              message: `Schedule conflict detected with ${existingClass.subject?.subjectName || 'another class'}.`,
              conflict: {
                subjectName: existingClass.subject?.subjectName,
                subjectCode: existingClass.subject?.subjectCode
              }
            });
          }
        }
      }
    }

    // Enroll the student as 'subject' type (irregular student)
    classSpace.enrolledStudents.push({
      student: student._id,
      enrollmentType: 'subject',
      enrolledAt: new Date()
    });

    await classSpace.save();

    // Add subject code to student's subjectCodes array
    if (!student.subjectCodes.includes(classSpace.subject.toString())) {
      student.subjectCodes.push(classSpace.subject.toString());
    }

    // Update student type to irregular if not already
    if (student.studentType !== 'irregular') {
      student.studentType = 'irregular';
    }

    // Update enrollment status
    if (student.enrollmentStatus === 'not_enrolled') {
      student.enrollmentStatus = 'enrolled';
    }

    await student.save();

    // Fetch updated class space with full details
    const updatedClassSpace = await ClassSpace.findById(classSpace._id)
      .populate(CLASS_POPULATE);

    res.status(200).json({
      success: true,
      message: `Successfully enrolled in ${classSpace.subject?.subjectName}!`,
      data: updatedClassSpace
    });

  } catch (error) {
    console.error('Enroll by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enrolling in class',
      error: error.message
    });
  }
};

// Helper function to check if time slots overlap
function timeSlotsOverlap(slot1, slot2) {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);

  return start1 < end2 && start2 < end1;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// @desc    Drop/unenroll from a class (student self-drop)
// @route   DELETE /api/classSpaces/:id/unenroll
// @access  Private (student only)
exports.unenrollFromClass = async (req, res) => {
  try {
    const { id } = req.params;

    const classSpace = await ClassSpace.findById(id)
      .populate('subject', 'subjectCode subjectName');

    if (!classSpace) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Get student record
    const student = await Student.findOne({ user: req.user._id });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    // Check if enrolled
    if (!classSpace.hasStudent(student._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this class'
      });
    }

    // Check enrollment type - students can only drop subject-type enrollments (irregular)
    const enrollment = classSpace.findEnrollment(student._id);
    if (enrollment && enrollment.enrollmentType === 'section') {
      return res.status(400).json({
        success: false,
        message: 'Cannot drop this class. Please contact your program manager to change section enrollment.'
      });
    }

    // Remove from class space
    classSpace.removeStudent(student._id);
    await classSpace.save();

    // Remove subject code from student
    student.subjectCodes = student.subjectCodes.filter(
      code => code.toString() !== classSpace.subject.toString()
    );

    // If no more subject codes and no section code, set to not_enrolled
    if (student.subjectCodes.length === 0 && !student.sectionCode) {
      student.enrollmentStatus = 'not_enrolled';
      student.studentType = 'regular'; // Reset to regular
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: `Successfully dropped ${classSpace.subject?.subjectName}`,
      data: { classId: id }
    });

  } catch (error) {
    console.error('Unenroll from class error:', error);
    res.status(500).json({
      success: false,
      message: 'Error dropping class',
      error: error.message
    });
  }
};
