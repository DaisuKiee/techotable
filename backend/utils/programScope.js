/**
 * Program isolation for program managers.
 *
 * Each of the program managers works on one program (BSIT, BSIE, BSFI,
 * BIT-AT, BIT-CT, BIT-ET, BSHM). Admins and the scheduling office see
 * everything. These helpers keep a manager inside their own program on the
 * routes that the generic checkProgramAccess middleware doesn't cover.
 */

const lazy = {
  get User() { return require('../models/User.model'); },
  get Faculty() { return require('../models/Faculty.model'); },
  get Schedule() { return require('../models/Schedule.model'); },
};

/** The program a request is limited to, or null for admins / scheduling office. */
const managerProgram = (req) => (req.user?.role === 'program_manager' ? req.user.program || '__none__' : null);

const deny = (res, program, what = 'records') => res.status(403).json({
  success: false,
  code: 'OTHER_PROGRAM',
  message: `You can only access ${program} ${what}.`,
});

/** A teacher belongs to a program when it's in their programs (or they have none yet). */
const facultyInProgram = (faculty, program) => {
  const programs = faculty?.programs || [];
  return programs.length === 0 || programs.includes(program);
};

/**
 * A teacher is borrowed into a program when they actually teach a published
 * class in it, which is the same rule the faculty list uses to show them with
 * a "Cross Referenced" badge. Their home program is unchanged.
 */
const isBorrowedInto = async (facultyId, program) => !!(await lazy.Schedule.exists({
  faculty: facultyId,
  program,
  status: 'published',
  isActive: true,
}));

/** User ids that belong to a program: its students and manager, and its faculty. */
const programUserIds = async (program) => {
  const [users, faculty] = await Promise.all([
    lazy.User.find({ program }).select('_id').lean(),
    lazy.Faculty.find({ programs: program }).select('user').lean(),
  ]);
  return [...new Set([...users.map((u) => String(u._id)), ...faculty.map((f) => f.user && String(f.user)).filter(Boolean)])];
};

/** For routes like /sections/program/:program/... - the URL can't name another program. */
const restrictProgramParam = (param = 'program') => (req, res, next) => {
  const program = managerProgram(req);
  if (program && String(req.params[param] || '').toUpperCase() !== program.toUpperCase()) {
    return deny(res, program);
  }
  return next();
};

/** For /faculty/:id routes: a manager only reads or changes their program's teachers. */
const facultyProgramGuard = async (req, res, next) => {
  try {
    const program = managerProgram(req);
    if (!program || !req.params.id) return next();
    const faculty = await lazy.Faculty.findById(req.params.id).select('programs').lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    if (!facultyInProgram(faculty, program)) return deny(res, program, 'faculty');
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * For reading one teacher: the manager's own, plus anyone borrowed into their
 * program.
 *
 * The faculty list already shows a borrowed teacher once their assignment is
 * published, so denying the profile behind it left the drawer saying it
 * couldn't load - the list offered a person the detail route refused. Reading
 * their load and the week they are already committed to is the point of
 * borrowing them; changing their record is not, so the writes above keep the
 * strict guard.
 */
const facultyReadGuard = async (req, res, next) => {
  try {
    const program = managerProgram(req);
    if (!program || !req.params.id) return next();
    const faculty = await lazy.Faculty.findById(req.params.id).select('programs').lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    if (facultyInProgram(faculty, program)) return next();
    if (await isBorrowedInto(req.params.id, program)) return next();
    return deny(res, program, 'faculty');
  } catch (error) {
    return next(error);
  }
};

/**
 * For /faculty/:id/approve and /reject, where :id is the applicant's *user*
 * id. facultyProgramGuard looked it up as a faculty id, so a program manager
 * approving anyone got "Faculty not found".
 */
const applicantProgramGuard = async (req, res, next) => {
  try {
    const program = managerProgram(req);
    if (!program || !req.params.id) return next();
    const user = await lazy.User.findById(req.params.id).select('facultyProfile').lean();
    if (!user) return res.status(404).json({ success: false, message: 'Faculty account not found' });
    const faculty = user.facultyProfile
      ? await lazy.Faculty.findById(user.facultyProfile).select('programs').lean()
      : null;
    if (faculty && !facultyInProgram(faculty, program)) return deny(res, program, 'faculty');
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  applicantProgramGuard,
  managerProgram,
  deny,
  facultyInProgram,
  programUserIds,
  restrictProgramParam,
  facultyProgramGuard,
  facultyReadGuard,
  isBorrowedInto,
};
