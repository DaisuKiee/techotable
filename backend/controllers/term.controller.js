const AcademicTerm = require('../models/AcademicTerm.model');
const SectionArchive = require('../models/SectionArchive.model');
const Section = require('../models/Section.model');
const Schedule = require('../models/Schedule.model');
const { sendError, AppError } = require('../middleware/error.middleware');
const terms = require('../services/academicTerm.service');
const { attachScheduleRoomLabels } = require('../utils/roomLabel');
const { managerProgram } = require('../utils/programScope');

/*
 * Semesters are per program. A program manager only ever sees and changes
 * their own program's terms; admins and the scheduling office pick a program
 * (or set up a school year for all programs at once).
 */

const DAY = 86400000;
// Semesters run about 4-5 months; outside these hard limits it's a typo
const MIN_DAYS = 30;
const MAX_DAYS = 240;

const actorOf = (req) => `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || undefined;

/** Programs a request may read: the manager's own, or the one asked for (or all). */
const readScope = (req) => {
  const own = managerProgram(req);
  if (own) return own;
  return req.query.program ? String(req.query.program) : null;
};

/** Programs a write applies to. Managers: their own. Others: one program or ALL. */
const writePrograms = async (req) => {
  const own = managerProgram(req);
  if (own) return [own];
  const wanted = req.body.program;
  const all = await terms.activePrograms();
  if (!wanted) throw new AppError('Choose a program (or All programs).');
  if (wanted === 'ALL') return all;
  if (!all.includes(wanted)) throw new AppError(`${wanted} is not an active program.`);
  return [wanted];
};

/** Check dates and overlaps within one program. Returns { start, end } or throws AppError. */
const validateDates = async ({ program, startDate, endDate, excludeIds = [], label = 'A term' }) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new AppError(`${label}: enter a valid start and end date.`);
  if (end <= start) throw new AppError(`${label}: the end date must be after the start date.`);
  const days = Math.round((end - start) / DAY);
  if (days < MIN_DAYS) throw new AppError(`${label} must be at least ${MIN_DAYS} days long (this is ${days}).`);
  if (days > MAX_DAYS) throw new AppError(`${label} can't be longer than ${Math.round(MAX_DAYS / 30)} months (this is ${Math.round(days / 30.44)}).`);

  const overlap = await AcademicTerm.findOne({
    program,
    _id: { $nin: excludeIds },
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean();
  if (overlap) {
    throw new AppError(`${label} overlaps ${program} ${terms.termLabel(overlap)} (${overlap.startDate.toDateString()} - ${overlap.endDate.toDateString()}).`, 409);
  }
  return { start, end };
};

/** Live and archived counts per program and term, in one pass per collection. */
const countsByTerm = async (program) => {
  const match = program ? { program } : {};
  const group = (Model, extra) => Model.aggregate([
    { $match: { ...match, ...extra } },
    { $group: { _id: { p: '$program', y: '$academicYear', s: '$semester' }, n: { $sum: 1 } } },
  ]);
  const [sections, archived, schedules, archivedSchedules] = await Promise.all([
    group(Section, { isActive: { $ne: false } }),
    group(SectionArchive, {}),
    group(Schedule, { isActive: true }),
    group(Schedule, { status: 'archived' }),
  ]);
  const map = new Map();
  const put = (list, key) => list.forEach(({ _id, n }) => {
    const k = `${_id.p}|${_id.y}|${_id.s}`;
    map.set(k, { ...(map.get(k) || {}), [key]: n });
  });
  put(sections, 'sections');
  put(archived, 'archivedSections');
  put(schedules, 'schedules');
  put(archivedSchedules, 'archivedSchedules');
  return map;
};

// @desc    Terms of a program (or all, for admins), newest first, with status and counts
// @route   GET /api/terms?program=
// @access  Private (staff)
exports.listTerms = async (req, res) => {
  try {
    const programs = await terms.activePrograms();
    // No program chosen (scheduling office's first visit): show the first one
    const program = readScope(req) || (req.query.all === 'true' ? null : programs[0] || null);
    const [list, counts] = await Promise.all([
      AcademicTerm.find(program ? { program } : {}).sort({ startDate: -1 }).lean(),
      countsByTerm(program),
    ]);
    const now = new Date();
    res.json({
      success: true,
      program,
      programs: managerProgram(req) ? [program] : programs,
      data: list.map((t) => ({
        ...terms.describe(t, now),
        counts: { sections: 0, archivedSections: 0, schedules: 0, archivedSchedules: 0, ...(counts.get(`${t.program}|${t.academicYear}|${t.semester}`) || {}) },
      })),
    });
  } catch (error) {
    sendError(res, error, 'Could not load academic terms');
  }
};

// @desc    A program's current term (managers and students: their own program)
// @route   GET /api/terms/current?program=
// @access  Private (everyone)
exports.getCurrent = async (req, res) => {
  try {
    const program = managerProgram(req) || (req.user.role === 'student' ? req.user.program : null) || req.query.program || null;
    if (!program) {
      // Admin / scheduling office with no program chosen: a summary per program
      const programs = await terms.activePrograms();
      const per = await Promise.all(programs.map(async (p) => {
        const t = await terms.getCurrentTerm(p);
        return { program: p, term: t ? terms.describe(t) : null };
      }));
      const fallback = terms.calendarTerm();
      return res.json({
        success: true,
        data: { ...fallback, label: terms.termLabel(fallback) },
        isSet: false,
        perProgram: per,
        configured: per.filter((x) => x.term).length,
      });
    }
    const current = await terms.getCurrentTerm(program);
    if (current) return res.json({ success: true, program, data: terms.describe(current), isSet: true });
    const fallback = await terms.getDefaultTerm(program);
    res.json({ success: true, program, data: { ...fallback, label: terms.termLabel(fallback) }, isSet: false });
  } catch (error) {
    sendError(res, error, 'Could not load the current term');
  }
};

// @desc    Delete a term that hasn't started and has nothing scheduled
// @route   DELETE /api/terms/:id
// @access  Private (admin, scheduling officer, that program's manager)
exports.deleteTerm = async (req, res) => {
  try {
    const term = await AcademicTerm.findById(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });
    const own = managerProgram(req);
    if (own && term.program !== own) {
      return res.status(403).json({ success: false, code: 'OTHER_PROGRAM', message: `You can only change ${own} semesters.` });
    }
    if (term.appliedAt) throw new AppError('This term has started and has records attached, so it can’t be deleted.');
    const used = await Schedule.countDocuments({ program: term.program, academicYear: term.academicYear, semester: term.semester });
    if (used) throw new AppError(`${used} ${term.program} schedule${used === 1 ? '' : 's'} already use this term. Remove them first.`);
    await term.deleteOne();
    terms.clearCache();
    res.json({ success: true, message: `${term.program} ${terms.termLabel(term)} deleted` });
  } catch (error) {
    sendError(res, error, 'Could not delete the term');
  }
};

// @desc    Archived sections of a past term, with what each one took
// @route   GET /api/terms/archive?academicYear=&semester=&program=
// @access  Private (staff)
exports.getArchive = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const semester = Number(req.query.semester);
    if (!academicYear || !semester) throw new AppError('Choose an academic year and semester.');
    const program = readScope(req);
    const scope = { academicYear, semester, ...(program && { program }) };

    const [snapshots, schedules] = await Promise.all([
      SectionArchive.find(scope).populate({ path: 'adviser', select: 'user', populate: { path: 'user', select: 'firstName lastName' } }).sort({ sectionCode: 1 }).lean(),
      Schedule.find({ ...scope, status: 'archived' })
        .populate('subject', 'subjectCode subjectName units')
        .populate({ path: 'faculty', select: 'user employeeId', populate: { path: 'user', select: 'firstName lastName' } })
        .select('sectionCode subject faculty room timeSlots program')
        .lean(),
    ]);
    await attachScheduleRoomLabels(schedules);

    const bySection = new Map();
    schedules.forEach((s) => {
      if (!bySection.has(s.sectionCode)) bySection.set(s.sectionCode, []);
      bySection.get(s.sectionCode).push({
        _id: s._id,
        subjectCode: s.subject?.subjectCode,
        subjectName: s.subject?.subjectName,
        units: s.subject?.units || 0,
        faculty: s.faculty?.user ? `${s.faculty.user.firstName} ${s.faculty.user.lastName}` : null,
        room: s.roomLabel || null,
        timeSlots: s.timeSlots || [],
      });
    });

    // Sections that had archived classes but no snapshot still show up
    const codes = new Set(snapshots.map((s) => s.sectionCode));
    const extra = [...bySection.keys()].filter((c) => !codes.has(c)).map((code) => ({
      _id: `schedules-${code}`, sectionCode: code, academicYear, semester, studentCount: null, students: [], scheduleCount: bySection.get(code).length,
    }));

    res.json({
      success: true,
      data: [...snapshots, ...extra]
        .sort((a, b) => a.sectionCode.localeCompare(b.sectionCode))
        .map((s) => ({
          ...s,
          adviserName: s.adviser?.user ? `${s.adviser.user.firstName} ${s.adviser.user.lastName}` : null,
          classes: (bySection.get(s.sectionCode) || []).sort((a, b) => (a.subjectCode || '').localeCompare(b.subjectCode || '')),
        })),
    });
  } catch (error) {
    sendError(res, error, 'Could not load the archive');
  }
};

// @desc    Terms that have archived records (for the archive picker)
// @route   GET /api/terms/archive/terms?program=
// @access  Private (staff)
exports.getArchiveTerms = async (req, res) => {
  try {
    const program = readScope(req);
    const match = program ? { program } : {};
    const [a, b] = await Promise.all([
      SectionArchive.aggregate([{ $match: match }, { $group: { _id: { y: '$academicYear', s: '$semester' }, sections: { $sum: 1 } } }]),
      Schedule.aggregate([{ $match: { ...match, status: 'archived' } }, { $group: { _id: { y: '$academicYear', s: '$semester' }, classes: { $sum: 1 } } }]),
    ]);
    const map = new Map();
    a.forEach((x) => map.set(`${x._id.y}|${x._id.s}`, { academicYear: x._id.y, semester: x._id.s, sections: x.sections, classes: 0 }));
    b.forEach((x) => {
      const k = `${x._id.y}|${x._id.s}`;
      map.set(k, { academicYear: x._id.y, semester: x._id.s, sections: 0, ...(map.get(k) || {}), classes: x.classes });
    });
    res.json({
      success: true,
      data: [...map.values()]
        .sort((x, y) => terms.termKey(y.academicYear, y.semester) - terms.termKey(x.academicYear, x.semester))
        .map((t) => ({ ...t, label: terms.termLabel(t) })),
    });
  } catch (error) {
    sendError(res, error, 'Could not load archived terms');
  }
};

/* ---------------- Whole school year (1st, 2nd, optional summer) ---------------- */

const PARTS = [
  { key: 'first', semester: 1, label: '1st Semester' },
  { key: 'second', semester: 2, label: '2nd Semester' },
  { key: 'summer', semester: 3, label: 'Summer' },
];

/**
 * Check one program's school year: each semester valid, in order (2nd starts
 * after the 1st ends, summer after the 2nd), and no clash with its other years.
 */
const checkSchoolYear = async (program, academicYear, body) => {
  if (!/^\d{4}-\d{4}$/.test(academicYear || '')) throw new AppError('Choose a school year like 2026-2027.');
  const existing = await AcademicTerm.find({ program, academicYear }).lean();
  const ids = existing.map((t) => t._id);
  const parts = [];
  for (const part of PARTS) {
    const dates = body[part.key];
    if (!dates || (!dates.startDate && !dates.endDate)) {
      if (part.key !== 'summer') throw new AppError(`Set the start and end dates of the ${part.label}.`);
      continue;
    }
    const { start, end } = await validateDates({ program, ...dates, excludeIds: ids, label: `The ${part.label}` });
    parts.push({ ...part, start, end, existing: existing.find((t) => t.semester === part.semester) || null });
  }
  for (let i = 1; i < parts.length; i += 1) {
    if (parts[i].start <= parts[i - 1].end) {
      throw new AppError(`The ${parts[i].label} must start after the ${parts[i - 1].label} ends (${parts[i - 1].end.toDateString()}).`);
    }
  }
  const summerStarted = existing.find((t) => t.semester === 3 && t.appliedAt);
  if (summerStarted && !parts.some((p) => p.semester === 3)) {
    throw new AppError(`${program}'s summer term has already started, so it can’t be removed.`);
  }
  return { parts, existing };
};

// @desc    What saving a school year would do, per program
// @route   POST /api/terms/school-year/preview
// @access  Private (admin, scheduling officer, program manager)
exports.previewSchoolYear = async (req, res) => {
  try {
    const { academicYear } = req.body;
    const programs = await writePrograms(req);
    const now = new Date();
    const results = [];
    for (const program of programs) {
      const { parts } = await checkSchoolYear(program, academicYear, req.body);
      const starting = parts.find((p) => p.semester !== 3 && p.start <= now && now <= new Date(p.end.getTime() + 86399999) && !p.existing?.appliedAt);
      results.push({
        program,
        startsNow: starting ? { semester: starting.semester, label: `${starting.label} · AY ${academicYear}` } : null,
        effects: starting ? await terms.previewApply({ program, academicYear, semester: starting.semester }) : null,
        semesters: parts.map((p) => ({ semester: p.semester, ...terms.describe({ academicYear, semester: p.semester, startDate: p.start, endDate: p.end }, now) })),
      });
    }
    const starting = results.filter((r) => r.startsNow);
    res.json({
      success: true,
      data: {
        programs: results.map((r) => r.program),
        perProgram: results,
        semesters: results[0]?.semesters || [],
        startsNow: starting[0]?.startsNow || null,
        effects: starting.length ? {
          sectionsToMove: starting.reduce((n, r) => n + (r.effects?.sectionsToMove || 0), 0),
          schedulesToArchive: starting.reduce((n, r) => n + (r.effects?.schedulesToArchive || 0), 0),
          programs: starting.map((r) => r.program),
        } : null,
      },
    });
  } catch (error) {
    // Validation problems are shown in the form, not as a failure
    if (error.name === 'AppError') return res.json({ success: true, data: { invalid: error.message } });
    sendError(res, error, 'Could not preview the school year');
  }
};

// @desc    Create or update a school year's semesters for a program (or all)
// @route   PUT /api/terms/school-year
// @access  Private (admin, scheduling officer, program manager)
exports.saveSchoolYear = async (req, res) => {
  try {
    const { academicYear, notes } = req.body;
    const programs = await writePrograms(req);

    // Check every program first so nothing is half-saved
    const checked = [];
    for (const program of programs) checked.push({ program, ...(await checkSchoolYear(program, academicYear, req.body)) });

    const applied = [];
    for (const { program, parts, existing } of checked) {
      for (const part of parts) {
        if (part.existing) {
          await AcademicTerm.updateOne({ _id: part.existing._id }, { $set: { startDate: part.start, endDate: part.end, ...(notes !== undefined && { notes }) } });
        } else {
          await AcademicTerm.create({ program, academicYear, semester: part.semester, startDate: part.start, endDate: part.end, notes, createdBy: req.user._id });
        }
      }
      const summer = existing.find((t) => t.semester === 3);
      if (summer && !parts.some((p) => p.semester === 3) && !summer.appliedAt) await AcademicTerm.deleteOne({ _id: summer._id });
    }
    terms.clearCache();

    // A semester covering today starts now, program by program
    for (const program of programs) {
      const current = await terms.getCurrentTerm(program, { fresh: true });
      if (current && current.academicYear === academicYear && !current.appliedAt && terms.describe(current).status === 'current') {
        applied.push(await terms.applyTerm(current, { actor: actorOf(req) }));
      }
    }

    const moved = applied.filter((a) => !a.calendarOnly);
    const scopeLabel = programs.length === 1 ? programs[0] : `${programs.length} programs`;
    res.json({
      success: true,
      message: moved.length
        ? `${scopeLabel}: school year ${academicYear} saved and the current semester has started.`
        : `${scopeLabel}: school year ${academicYear} saved`,
      data: (await AcademicTerm.find({ academicYear, program: { $in: programs } }).sort({ program: 1, semester: 1 }).lean()).map((t) => terms.describe(t)),
      applied: moved.length ? {
        sectionsMoved: moved.reduce((n, a) => n + a.sectionsMoved, 0),
        schedulesArchived: moved.reduce((n, a) => n + a.schedulesArchived, 0),
        programs: moved.map((a) => a.program),
      } : null,
    });
  } catch (error) {
    sendError(res, error, 'Could not save the school year');
  }
};
