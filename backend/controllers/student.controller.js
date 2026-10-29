const crypto = require('crypto');
const Student = require('../models/Student.model');
const User = require('../models/User.model');
const Section = require('../models/Section.model');
const ClassSpace = require('../models/ClassSpace.model');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { sendError, AppError } = require('../middleware/error.middleware');
const { currentAcademicYearStart, formatAcademicYear } = require('../utils/teachingExperience');
const { notifySectionAssigned } = require('../services/inAppNotification.service');

// Never send password hashes or verification / reset tokens to the browser
const USER_FIELDS = 'firstName lastName middleName email profilePicture phoneNumber isActive isEmailVerified';
const STATUSES = ['enrolled', 'not_enrolled', 'dropped', 'graduated'];
const MIN_PASSWORD = 8;

/**
 * The term new students without a section start in: the latest term that
 * active sections are set up for, so they line up with the timetable even
 * when the office hasn't rolled over to the calendar's academic year yet.
 */
const defaultTerm = async () => {
  const latest = await Section.findOne({ isActive: { $ne: false } })
    .sort({ academicYear: -1, semester: -1 })
    .select('academicYear semester')
    .lean();
  return latest
    ? { academicYear: latest.academicYear, semester: latest.semester }
    : { academicYear: formatAcademicYear(currentAcademicYearStart()), semester: 1 };
};
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blank = (v) => v === undefined || v === null || String(v).trim() === '';
// Subject codes can contain spaces ("CC 111"), so only split on , ; or newlines
const cleanCodes = (codes) => [...new Set((Array.isArray(codes) ? codes : String(codes || '').split(/[,;\n]+/))
  .map((c) => String(c).trim().replace(/\s+/g, ' ').toUpperCase())
  .filter(Boolean))];

const populated = (id) => Student.findById(id).populate('user', USER_FIELDS);

/**
 * Section.currentStudents is a stored counter that nothing on this page kept
 * up to date. Recount it from the students actually assigned.
 */
const syncSectionCounts = async (...codes) => {
  const unique = [...new Set(codes.filter(Boolean).map((c) => String(c).toUpperCase()))];
  await Promise.all(unique.map(async (sectionCode) => {
    const count = await Student.countDocuments({
      sectionCode,
      enrollmentStatus: { $nin: ['dropped', 'graduated'] },
    });
    await Section.updateOne({ sectionCode }, { currentStudents: count });
  }));
};

/**
 * Take a student out of the class spaces they joined through an old section.
 * Without this, moving a student from BSIT-2A-D to BSIT-4A-D added the new
 * section's classes and kept every old one (9 + 6 = 15 "subjects").
 * Classes joined individually (irregular, by class code) are left alone.
 */
const leaveSectionClasses = async (student, oldSectionCode) => {
  if (!oldSectionCode || oldSectionCode === student.sectionCode) return;
  const spaces = await ClassSpace.find({ sectionCode: oldSectionCode, 'enrolledStudents.student': student._id }).select('_id').lean();
  if (!spaces.length) return;
  const ids = spaces.map((s) => s._id);
  await ClassSpace.updateMany(
    { _id: { $in: ids } },
    { $pull: { enrolledStudents: { student: student._id, enrollmentType: 'section' } } }
  );
  await Student.updateOne({ _id: student._id }, { $pull: { enrolledClasses: { $in: ids } } });
};

/**
 * Look up the section a student is being put in and check it can take them.
 * Returns the section, whose year level / AY / semester the student inherits.
 */
const resolveSection = async (code, program, studentId) => {
  const sectionCode = String(code).trim().toUpperCase();
  const section = await Section.findOne({ sectionCode });
  if (!section) throw new AppError(`Section ${sectionCode} does not exist.`, 400);
  if (section.isActive === false) throw new AppError(`Section ${sectionCode} is inactive.`, 400);
  if (program && section.program !== program) {
    throw new AppError(`Section ${sectionCode} belongs to ${section.program}, not ${program}.`, 400);
  }

  const others = await Student.countDocuments({
    sectionCode,
    enrollmentStatus: { $nin: ['dropped', 'graduated'] },
    ...(studentId && { _id: { $ne: studentId } }),
  });
  if (section.maxStudents && others >= section.maxStudents) {
    throw new AppError(`Section ${sectionCode} is full (${others}/${section.maxStudents}).`, 409);
  }
  return section;
};

const applySection = (student, section) => {
  student.sectionCode = section.sectionCode;
  student.yearLevel = section.yearLevel;
  student.academicYear = section.academicYear;
  student.semester = section.semester;
};

const isEmailTaken = async (email, exceptUserId) => {
  const existing = await User.findOne({ email: String(email).toLowerCase().trim() }).select('_id');
  return existing && String(existing._id) !== String(exceptUserId || '');
};

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin, Scheduling Officer, Program Manager, Faculty)
exports.getAllStudents = async (req, res) => {
  try {
    const { program, yearLevel, section, semester, academicYear, search, studentType, status, assignment } = req.query;

    const filter = {};
    // Program filter is injected by middleware for program managers
    if (program) filter.program = program;
    if (yearLevel) filter.yearLevel = parseInt(yearLevel, 10);
    if (section) filter.sectionCode = String(section).toUpperCase();
    if (semester) filter.semester = parseInt(semester, 10);
    if (academicYear) filter.academicYear = academicYear;
    if (studentType === 'unset') filter.studentType = null;
    else if (studentType) filter.studentType = studentType;
    if (status && STATUSES.includes(status)) filter.enrollmentStatus = status;
    if (assignment === 'assigned') filter.sectionCode = { $nin: [null, ''] };
    if (assignment === 'unassigned') filter.sectionCode = { $in: [null, ''] };

    // Search in the database instead of loading everyone and filtering in JS
    // (which also crashed on students whose account had been deleted)
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      const users = await User.find({
        role: 'student',
        $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { middleName: rx }],
      }).select('_id').lean();
      filter.$or = [
        { studentId: rx },
        { sectionCode: rx },
        { user: { $in: users.map((u) => u._id) } },
      ];
    }

    const students = await Student.find(filter)
      .populate('user', USER_FIELDS)
      .sort({ program: 1, yearLevel: 1, sectionCode: 1, studentId: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    sendError(res, error, 'Could not load students');
  }
};

// @desc    Get current student profile
// @route   GET /api/students/profile
// @access  Private (Student only)
exports.getMyProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id })
      .populate('user', USER_FIELDS)
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
    sendError(res, error, 'Could not load your profile');
  }
};

// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private (staff; a student only for their own record)
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', USER_FIELDS)
      .populate('enrolledClasses');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const { role, _id, program } = req.user;
    const own = student.user && String(student.user._id) === String(_id);
    if ((role === 'student' && !own) || (role === 'program_manager' && student.program !== program)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this student record'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    sendError(res, error, 'Could not load the student');
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.createStudent = async (req, res) => {
  let user;
  try {
    const {
      password,
      firstName,
      lastName,
      middleName,
      program,
      yearLevel,
      studentType,
      sectionCode,
      subjectCodes,
      contactNumber,
      address,
      guardianInfo,
      emergencyContact,
      notes,
    } = req.body;
    const email = String(req.body.email || '').toLowerCase().trim();
    const studentId = String(req.body.studentId || '').trim();

    const missing = [
      ['studentId', 'Student ID'], ['email', 'Email'], ['firstName', 'First name'],
      ['lastName', 'Last name'], ['program', 'Program'],
    ].filter(([k]) => blank(k === 'email' ? email : k === 'studentId' ? studentId : req.body[k])).map(([, label]) => label);
    if (missing.length) {
      return sendError(res, new AppError(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required.`));
    }
    if (!password || String(password).length < MIN_PASSWORD) {
      return sendError(res, new AppError(`Password must be at least ${MIN_PASSWORD} characters.`));
    }

    if (await Student.exists({ studentId }) || await User.exists({ studentId })) {
      return sendError(res, new AppError(`Student ID ${studentId} is already registered.`, 409));
    }
    if (await isEmailTaken(email)) {
      return sendError(res, new AppError(`${email} is already registered.`, 409));
    }

    const section = !blank(sectionCode) ? await resolveSection(sectionCode, program) : null;

    // Created by staff, so the address is vouched for: without this the
    // student could never log in (login requires a verified email).
    user = await User.create({
      email,
      password,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      middleName: middleName ? String(middleName).trim() : '',
      role: 'student',
      studentId,
      program,
      isEmailVerified: true,
    });

    const student = new Student({
      user: user._id,
      studentId,
      program,
      yearLevel: parseInt(yearLevel, 10) || null,
      studentType: studentType || 'regular',
      subjectCodes: cleanCodes(subjectCodes),
      ...(await defaultTerm()),
      contactNumber,
      address,
      guardianInfo,
      emergencyContact,
      notes,
      enrollmentStatus: section ? 'enrolled' : 'not_enrolled',
    });
    if (section) applySection(student, section);
    await student.save();
    if (section) {
      await syncSectionCounts(section.sectionCode);
      notifySectionAssigned(student, { from: null, to: section.sectionCode });
    }

    res.status(201).json({
      success: true,
      message: section
        ? `Student created and placed in ${section.sectionCode}`
        : 'Student created successfully',
      data: await populated(student._id),
    });
  } catch (error) {
    // Don't leave a login account behind without its student record
    if (user) await User.deleteOne({ _id: user._id }).catch(() => {});
    sendError(res, error, 'Could not create the student');
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const body = req.body;
    const user = student.user ? await User.findById(student.user) : null;

    // Check everything first, so a bad email can't leave half an update saved
    if (!blank(body.email) && user && await isEmailTaken(body.email, user._id)) {
      return sendError(res, new AppError(`${String(body.email).toLowerCase()} is already used by another account.`, 409));
    }
    for (const field of ['firstName', 'lastName']) {
      if (body[field] !== undefined && blank(body[field])) {
        return sendError(res, new AppError(`${field === 'firstName' ? 'First' : 'Last'} name cannot be empty.`));
      }
    }
    if (body.enrollmentStatus !== undefined && !STATUSES.includes(body.enrollmentStatus)) {
      return sendError(res, new AppError('Unknown enrollment status.'));
    }

    const previousSection = student.sectionCode;
    const program = body.program || student.program;

    let section = null;
    if (body.sectionCode !== undefined && !blank(body.sectionCode)) {
      section = await resolveSection(body.sectionCode, program, student._id);
    }

    const simple = ['program', 'studentType', 'contactNumber', 'address', 'guardianInfo', 'emergencyContact', 'notes'];
    simple.forEach((field) => {
      if (body[field] !== undefined) student[field] = body[field];
    });
    if (body.yearLevel !== undefined) student.yearLevel = parseInt(body.yearLevel, 10) || null;
    if (body.gpa !== undefined) student.gpa = blank(body.gpa) ? null : Number(body.gpa);
    if (body.subjectCodes !== undefined) student.subjectCodes = cleanCodes(body.subjectCodes);
    if (body.enrollmentStatus !== undefined) student.enrollmentStatus = body.enrollmentStatus;

    if (section) {
      applySection(student, section);
      if (student.enrollmentStatus === 'not_enrolled' && body.enrollmentStatus === undefined) {
        student.enrollmentStatus = 'enrolled';
      }
    } else if (body.sectionCode !== undefined) {
      student.sectionCode = null;
    } else if (body.program && previousSection) {
      // Moving to another program drops a section that belongs to the old one
      const current = await Section.findOne({ sectionCode: previousSection }).select('program');
      if (current && current.program !== body.program) student.sectionCode = null;
    }

    await student.save();

    if (user) {
      if (body.firstName !== undefined) user.firstName = String(body.firstName).trim();
      if (body.lastName !== undefined) user.lastName = String(body.lastName).trim();
      if (body.middleName !== undefined) user.middleName = String(body.middleName || '').trim();
      if (!blank(body.email)) user.email = String(body.email).toLowerCase().trim();
      if (body.phoneNumber !== undefined) user.phoneNumber = body.phoneNumber;
      if (body.program) user.program = body.program;
      if (user.isModified()) await user.save();
    }

    await leaveSectionClasses(student, previousSection);
    await syncSectionCounts(previousSection, student.sectionCode);
    notifySectionAssigned(student, { from: previousSection, to: student.sectionCode });

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: await populated(student._id),
    });
  } catch (error) {
    sendError(res, error, 'Could not update the student');
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Remove the record, its login and its class memberships together.
    // (Deactivating the login but keeping it blocked the email and student ID
    // from ever being registered again.)
    const classes = await ClassSpace.updateMany(
      { 'enrolledStudents.student': student._id },
      { $pull: { enrolledStudents: { student: student._id } } }
    );
    if (student.user) {
      await User.deleteOne({ _id: student.user, role: 'student' });
      await require('../models/Notification.model').deleteMany({ recipient: student.user });
    }
    await Student.deleteOne({ _id: student._id });
    await syncSectionCounts(student.sectionCode);

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
      data: { removedFromClasses: classes.modifiedCount || 0 }
    });
  } catch (error) {
    sendError(res, error, 'Could not delete the student');
  }
};

// @desc    Bulk import students from CSV
// @route   POST /api/students/bulk-import
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.bulkImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV file'
      });
    }

    const rows = [];
    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer.toString('utf8').replace(/^﻿/, ''))
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (!rows.length) {
      return sendError(res, new AppError('The file has no student rows.'));
    }

    const results = { success: [], failed: [] };
    const seenIds = new Set();
    const seenEmails = new Set();
    const touchedSections = new Set();
    // The multipart body isn't parsed when checkProgramAccess runs, so enforce
    // a program manager's program here
    const lockedProgram = req.user.role === 'program_manager' ? req.user.program : null;

    const term = await defaultTerm();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNo = i + 2; // header is row 1
      const studentId = String(row.studentId || '').trim();
      const email = String(row.email || '').toLowerCase().trim();
      const program = String(row.program || lockedProgram || '').trim().toUpperCase();
      const fail = (error) => results.failed.push({ row: rowNo, studentId: studentId || 'N/A', error });
      let user;

      try {
        const missing = ['studentId', 'email', 'firstName', 'lastName'].filter((k) => blank(row[k]));
        if (!program) missing.push('program');
        if (missing.length) { fail(`Missing ${missing.join(', ')}`); continue; }
        if (lockedProgram && program !== lockedProgram) { fail(`You can only import ${lockedProgram} students`); continue; }
        if (seenIds.has(studentId)) { fail('Student ID appears twice in this file'); continue; }
        if (seenEmails.has(email)) { fail('Email appears twice in this file'); continue; }
        seenIds.add(studentId);
        seenEmails.add(email);

        if (await Student.exists({ studentId }) || await User.exists({ studentId })) { fail('Student ID already exists'); continue; }
        if (await isEmailTaken(email)) { fail('Email already registered'); continue; }

        const password = !blank(row.password) ? String(row.password) : null;
        if (password && password.length < MIN_PASSWORD) { fail(`Password must be at least ${MIN_PASSWORD} characters`); continue; }

        const section = !blank(row.sectionCode) ? await resolveSection(row.sectionCode, program) : null;
        const tempPassword = password ? null : crypto.randomBytes(6).toString('base64url');

        user = await User.create({
          email,
          password: password || tempPassword,
          firstName: String(row.firstName).trim(),
          lastName: String(row.lastName).trim(),
          middleName: String(row.middleName || '').trim(),
          role: 'student',
          studentId,
          program,
          isEmailVerified: true,
        });

        const student = new Student({
          user: user._id,
          studentId,
          program,
          yearLevel: parseInt(row.yearLevel, 10) || null,
          studentType: ['regular', 'irregular'].includes(String(row.studentType).toLowerCase())
            ? String(row.studentType).toLowerCase()
            : 'regular',
          subjectCodes: cleanCodes(row.subjectCodes),
          academicYear: term.academicYear,
          semester: [1, 2].includes(parseInt(row.semester, 10)) ? parseInt(row.semester, 10) : term.semester,
          contactNumber: row.contactNumber,
          enrollmentStatus: section ? 'enrolled' : 'not_enrolled',
        });
        if (section) {
          applySection(student, section);
          touchedSections.add(section.sectionCode);
        }
        await student.save();

        results.success.push({
          row: rowNo,
          studentId,
          name: `${row.firstName} ${row.lastName}`.trim(),
          ...(tempPassword && { tempPassword }),
        });
      } catch (error) {
        if (user) await User.deleteOne({ _id: user._id }).catch(() => {});
        fail(error.name === 'AppError' ? error.message : (error.message || 'Could not import this row'));
      }
    }

    await syncSectionCounts(...touchedSections);

    const generated = results.success.filter((r) => r.tempPassword).length;
    res.status(200).json({
      success: true,
      message: `Imported ${results.success.length} of ${rows.length} students.`
        + (results.failed.length ? ` ${results.failed.length} failed.` : '')
        + (generated ? ` ${generated} got a generated password - share it with them.` : ''),
      data: results
    });
  } catch (error) {
    sendError(res, error, 'Could not import the file');
  }
};

// @desc    Get student statistics
// @route   GET /api/students/stats
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.getStats = async (req, res) => {
  try {
    // Program filter is injected by middleware for program managers
    const match = req.query.program ? { program: req.query.program } : {};
    const group = (field) => [{ $group: { _id: field, count: { $sum: 1 } } }, { $sort: { _id: 1 } }];

    const [facets] = await Student.aggregate([
      { $match: match },
      {
        $facet: {
          total: [{ $count: 'n' }],
          byProgram: group('$program'),
          byYearLevel: group('$yearLevel'),
          byStatus: group('$enrollmentStatus'),
          byType: group('$studentType'),
          unassigned: [{ $match: { sectionCode: { $in: [null, ''] } } }, { $count: 'n' }],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: facets.total[0]?.n || 0,
        unassigned: facets.unassigned[0]?.n || 0,
        byProgram: facets.byProgram,
        byYearLevel: facets.byYearLevel,
        byStatus: facets.byStatus,
        byType: facets.byType,
      }
    });
  } catch (error) {
    sendError(res, error, 'Could not load student statistics');
  }
};

// @desc    Assign (or clear, with sectionCode: null) a student's section
// @route   PUT /api/students/:id/assign-section
// @access  Private (Admin, Scheduling Officer, Program Manager)
exports.assignSectionCode = async (req, res) => {
  try {
    const { sectionCode, studentType } = req.body;

    if (sectionCode === undefined) {
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

    const previous = student.sectionCode;
    if (blank(sectionCode)) {
      student.sectionCode = null;
      if (student.enrollmentStatus === 'enrolled') student.enrollmentStatus = 'not_enrolled';
    } else {
      const section = await resolveSection(sectionCode, student.program, student._id);
      applySection(student, section);
      student.enrollmentStatus = 'enrolled';
    }
    if (studentType) student.studentType = studentType;

    await student.save();
    await leaveSectionClasses(student, previous);
    await syncSectionCounts(previous, student.sectionCode);
    notifySectionAssigned(student, { from: previous, to: student.sectionCode });

    res.status(200).json({
      success: true,
      message: student.sectionCode
        ? `Assigned to ${student.sectionCode}`
        : 'Removed from section',
      data: await populated(student._id)
    });
  } catch (error) {
    sendError(res, error, 'Could not assign the section');
  }
};

module.exports = exports;
