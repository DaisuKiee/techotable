const mongoose = require('mongoose');
const Schedule = require('../models/Schedule.model');

/**
 * Real teaching load per faculty member, derived from their saved classes.
 *
 * Faculty documents carried a `currentLoad` counter that the schedule
 * generator tried to $inc - but `currentLoad` is not in the Faculty schema,
 * so Mongoose's strict mode silently dropped every one of those updates. The
 * stored value stayed 0 for everyone, and the generator's load cap never
 * counted classes a teacher already had. Load is now always computed from the
 * schedules themselves, so it can't drift.
 *
 *  - hours: scheduled meeting time per week (from the time slots, which is
 *    what the teacher actually stands in front of a class for)
 *  - units: the subjects' unit values (what the generator's load cap uses)
 *  - classes: number of class offerings
 *
 * @param {Object}   [opts]
 * @param {Array}    [opts.facultyIds]   limit to these faculty (ObjectIds or strings)
 * @param {String}   [opts.academicYear] limit to one term...
 * @param {Number}   [opts.semester]     ...when both are given
 * @returns {Promise<Map<string, {hours:number, units:number, classes:number}>>}
 */
async function getFacultyLoads({ facultyIds, academicYear, semester } = {}) {
  const match = { isActive: true, faculty: { $ne: null } };
  if (facultyIds) {
    match.faculty = { $in: facultyIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  }
  if (academicYear && semester) {
    match.academicYear = academicYear;
    match.semester = Number(semester);
  }

  const rows = await Schedule.aggregate([
    { $match: match },
    { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subject' } },
    {
      $project: {
        faculty: 1,
        timeSlots: 1,
        units: { $ifNull: [{ $first: '$subject.units' }, 0] },
        subjectHours: {
          $add: [
            { $ifNull: [{ $first: '$subject.lectureHours' }, 0] },
            { $ifNull: [{ $first: '$subject.labHours' }, 0] },
          ],
        },
      },
    },
  ]);

  const toMinutes = (t) => {
    const [h, m] = String(t || '').split(':');
    return parseInt(h, 10) * 60 + (parseInt(m, 10) || 0);
  };

  const loads = new Map();
  for (const row of rows) {
    const key = String(row.faculty);
    const minutes = (row.timeSlots || []).reduce((sum, s) => {
      const d = toMinutes(s.endTime) - toMinutes(s.startTime);
      return sum + (d > 0 ? d : 0);
    }, 0);
    // A class saved without time slots yet still counts its subject's hours
    const hours = minutes > 0 ? minutes / 60 : Number(row.subjectHours) || 0;

    const entry = loads.get(key) || { hours: 0, units: 0, classes: 0 };
    entry.hours += hours;
    entry.units += Number(row.units) || 0;
    entry.classes += 1;
    loads.set(key, entry);
  }

  for (const entry of loads.values()) entry.hours = Math.round(entry.hours * 10) / 10;
  return loads;
}

const EMPTY_LOAD = Object.freeze({ hours: 0, units: 0, classes: 0 });

module.exports = { getFacultyLoads, EMPTY_LOAD };
