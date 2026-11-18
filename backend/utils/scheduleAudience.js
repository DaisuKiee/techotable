/**
 * Who a change to a class concerns.
 *
 * Both notification services ask this question, and they used to answer it
 * differently: the in-app one matched a section's students, while the email one
 * added `isActive: true`, a year level, a semester and an academic year on top.
 * Student records carry none of that reliably - there is no `isActive` field on
 * the model at all, year level is routinely unset, and a student's academic
 * year follows their own enrolment rather than the term a class belongs to - so
 * the email query matched nobody, and students were never told their timetable
 * had been published or changed.
 *
 * One definition now serves both, so they cannot drift apart again: a class
 * concerns the students whose section code matches it, plus anyone who joined
 * that class's space with an enrolment code (students who have no section code
 * of their own still get told).
 */

const Student = require('../models/Student.model');
const ClassSpace = require('../models/ClassSpace.model');

const USER_FIELDS = 'email firstName lastName';

/**
 * @param {{ sectionCodes?: string[], scheduleIds?: any[] }} where
 * @returns {Promise<object[]>} student documents, each with `user` populated
 */
const studentsFor = async ({ sectionCodes = [], scheduleIds = [] } = {}) => {
  const sections = [...new Set((sectionCodes || []).filter(Boolean))];
  const ids = [...new Set((scheduleIds || []).filter(Boolean).map(String))];
  if (!sections.length && !ids.length) return [];

  const [bySection, spaces] = await Promise.all([
    sections.length
      ? Student.find({ sectionCode: { $in: sections } }).populate('user', USER_FIELDS).lean()
      : [],
    ids.length
      ? ClassSpace.find({ schedule: { $in: ids } })
        .select('enrolledStudents.student')
        .populate({ path: 'enrolledStudents.student', populate: { path: 'user', select: USER_FIELDS } })
        .lean()
      : [],
  ]);

  // A student in the section who also joined the space must only count once.
  const byId = new Map();
  for (const student of bySection) {
    if (student?._id) byId.set(String(student._id), student);
  }
  for (const space of spaces) {
    for (const entry of space.enrolledStudents || []) {
      const student = entry?.student;
      if (student?._id) byId.set(String(student._id), student);
    }
  }
  return [...byId.values()];
};

/** The same people, as user ids - what the in-app notifications address. */
const studentUserIdsFor = async (where) => {
  const students = await studentsFor(where);
  return [...new Set(
    students
      .map((s) => s.user?._id || s.user)
      .filter(Boolean)
      .map(String)
  )];
};

/** The same people, as those who can actually receive an email. */
const emailableStudentsFor = async (where) => {
  const students = await studentsFor(where);
  return students.filter((s) => s.user?.email);
};

module.exports = { studentsFor, studentUserIdsFor, emailableStudentsFor };
