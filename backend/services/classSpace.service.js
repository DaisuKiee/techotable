const ClassSpace = require('../models/ClassSpace.model');
const Student = require('../models/Student.model');

/**
 * Shared class-space lifecycle helpers.
 *
 * Lives in a service rather than a controller because both the class-space
 * controller and the schedule controller need it: a class space must exist for
 * every subject offering, whether the schedule was created manually, generated
 * by the AI, or saved in bulk from the schedule builder.
 */

/**
 * Get or create the ClassSpace for a schedule.
 *
 * Safe under concurrency: the unique index on `schedule` means a duplicate
 * insert fails with E11000, which we treat as "someone else just created it"
 * and re-read instead of surfacing an error.
 *
 * @param {object} schedule A Schedule document or lean object
 * @returns {Promise<object|null>} the ClassSpace document
 */
const ensureClassSpaceForSchedule = async (schedule) => {
  if (!schedule || !schedule._id) return null;

  const existing = await ClassSpace.findOne({ schedule: schedule._id });
  if (existing) {
    // Callers only ask for spaces of live schedules, so a space that was retired
    // with a since-restored schedule should come back rather than stay hidden.
    if (!existing.isActive && schedule.isActive !== false) {
      existing.isActive = true;
      await existing.save();
    }
    return existing;
  }

  // A space is meaningless without the subject it represents
  const subjectId = schedule.subject?._id || schedule.subject;
  if (!subjectId) return null;

  try {
    return await ClassSpace.create({
      schedule: schedule._id,
      subject: subjectId,
      faculty: schedule.faculty?._id || schedule.faculty || null,
      sectionCode: schedule.sectionCode,
      program: schedule.program,
      academicYear: schedule.academicYear,
      semester: schedule.semester,
      classCode: await ClassSpace.generateUniqueClassCode(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return ClassSpace.findOne({ schedule: schedule._id });
    }
    throw err;
  }
};

/**
 * Mirror a schedule's current faculty/section onto its class space.
 *
 * The space denormalises those fields so "the classes I teach" is a single
 * indexed query. Without this, reassigning a schedule to another teacher left
 * the class listed under the previous one.
 *
 * @param {object} schedule A Schedule document or lean object
 * @returns {Promise<object|null>} the class space, or null if there isn't one
 */
const syncClassSpaceForSchedule = async (schedule) => {
  if (!schedule?._id) return null;

  const space = await ensureClassSpaceForSchedule(schedule);
  if (!space) return null;

  const faculty = schedule.faculty?._id || schedule.faculty || null;
  const nextFaculty = faculty ? String(faculty) : null;
  const currentFaculty = space.faculty ? String(space.faculty) : null;

  let dirty = false;
  if (nextFaculty !== currentFaculty) {
    space.faculty = faculty;
    dirty = true;
  }
  if (schedule.sectionCode && space.sectionCode !== schedule.sectionCode) {
    space.sectionCode = schedule.sectionCode;
    dirty = true;
  }

  if (dirty) await space.save();
  return space;
};

/**
 * Retire the class space for a deleted schedule.
 *
 * Schedules are soft-deleted, and the space was previously left active, so the
 * class stayed in every student's and teacher's list forever - and
 * syncSectionEnrollment happily re-enrolled students into it on every load.
 * The space is deactivated rather than dropped so its announcements and
 * materials survive if the schedule is restored.
 *
 * @param {object} schedule A Schedule document or lean object
 * @returns {Promise<boolean>} whether a space was deactivated
 */
const deactivateClassSpaceForSchedule = async (schedule) => {
  if (!schedule?._id) return false;

  const result = await ClassSpace.updateMany(
    { schedule: schedule._id, isActive: true },
    { $set: { isActive: false } }
  );

  return (result.modifiedCount || 0) > 0;
};

/**
 * Create class spaces for many schedules, never letting one failure abort the
 * batch. Used by the bulk/AI save paths where a partial result is better than
 * rejecting the whole schedule set.
 *
 * @returns {Promise<{created: number, failed: number}>}
 */
const ensureClassSpacesForSchedules = async (schedules = []) => {
  let created = 0;
  let failed = 0;

  for (const schedule of schedules) {
    try {
      const space = await ensureClassSpaceForSchedule(schedule);
      if (space) created++;
    } catch (err) {
      failed++;
      console.error(
        `Could not create class space for schedule ${schedule?._id}:`,
        err.message
      );
    }
  }

  return { created, failed };
};

/**
 * Enroll a student in a space and mirror the link onto the Student document.
 * Idempotent.
 *
 * @param {object} classSpace ClassSpace document
 * @param {object} student Student document
 * @param {'section'|'subject'} enrollmentType
 */
const addStudentToSpace = async (classSpace, student, enrollmentType) => {
  if (!classSpace || !student) return;

  if (!classSpace.hasStudent(student._id)) {
    classSpace.enrolledStudents.push({ student: student._id, enrollmentType });
    await classSpace.save();
  }

  await Student.updateOne(
    { _id: student._id },
    { $addToSet: { enrolledClasses: classSpace._id } }
  );
};

/**
 * Bring a regular student's memberships in line with their section, so subjects
 * added to the section after they joined still appear.
 *
 * @returns {Promise<object[]>} the spaces the student is now in
 */
const syncSectionEnrollment = async (student) => {
  if (!student?.sectionCode) return [];

  const Schedule = require('../models/Schedule.model');
  const schedules = await Schedule.find({
    sectionCode: student.sectionCode,
    isActive: true,
  });

  if (!schedules.length) return [];

  // This runs on every "my classes" load, so do it in a few batched queries.
  // One-by-one it was ~2 round trips per subject: 4+ seconds for a 9-subject
  // section on a remote database, which held up the whole student dashboard.
  const existing = await ClassSpace.find({ schedule: { $in: schedules.map((s) => s._id) } });
  const bySchedule = new Map(existing.map((space) => [String(space.schedule), space]));

  const inactive = existing.filter((space) => !space.isActive).map((space) => space._id);
  if (inactive.length) {
    await ClassSpace.updateMany({ _id: { $in: inactive } }, { $set: { isActive: true } });
  }

  // Only schedules that have never had a space need creating (rare)
  const spaces = [...existing];
  for (const schedule of schedules) {
    if (bySchedule.has(String(schedule._id))) continue;
    const created = await ensureClassSpaceForSchedule(schedule);
    if (created) spaces.push(created);
  }

  const ids = spaces.map((space) => space._id);
  await ClassSpace.updateMany(
    { _id: { $in: ids }, 'enrolledStudents.student': { $ne: student._id } },
    { $push: { enrolledStudents: { student: student._id, enrollmentType: 'section', enrolledAt: new Date() } } }
  );
  await Student.updateOne(
    { _id: student._id },
    { $addToSet: { enrolledClasses: { $each: ids } } }
  );

  return spaces;
};

module.exports = {
  ensureClassSpaceForSchedule,
  ensureClassSpacesForSchedules,
  syncClassSpaceForSchedule,
  deactivateClassSpaceForSchedule,
  addStudentToSpace,
  syncSectionEnrollment,
};
