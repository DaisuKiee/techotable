const mongoose = require('mongoose');

/**
 * A ClassSpace is one subject offering for one section - the Google-Classroom
 * style room where the assigned teacher posts announcements and materials and
 * where enrolled students read them.
 *
 * There is exactly one ClassSpace per Schedule (subject + faculty + section).
 *
 * Two ways in:
 *   - Regular students join a SECTION using Section.enrollmentCode, which
 *     enrolls them in every ClassSpace for that section.
 *   - Irregular students join a SINGLE subject using this ClassSpace's own
 *     `classCode`.
 */

const AnnouncementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const MaterialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  fileUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: Number,
  fileType: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const EnrolledStudentSchema = new mongoose.Schema({
  // Refs Student (the academic record), not User - Student carries
  // studentType, sectionCode and subjectCodes.
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  // 'section' = pulled in by joining the section with a section code
  // 'subject'  = joined this one subject directly with the class code
  enrollmentType: {
    type: String,
    enum: ['section', 'subject'],
    default: 'section'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const ClassSpaceSchema = new mongoose.Schema({
  // The subject offering this space belongs to.
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true
  },

  // Denormalised from the Schedule so the common queries (list my classes,
  // list a section's classes) don't need a populate chain or a second round trip.
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    default: null
  },
  sectionCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  program: {
    type: String,
    trim: true
  },
  academicYear: {
    type: String,
    trim: true
  },
  semester: {
    type: Number,
    enum: [1, 2]
  },

  // Join code for THIS subject. Irregular students use this to join a single
  // subject without joining the whole section.
  classCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },

  announcements: [AnnouncementSchema],
  materials: [MaterialSchema],
  enrolledStudents: [EnrolledStudentSchema],

  isActive: {
    type: Boolean,
    default: true
  },

  // Mirrors the schedule's status. A draft class exists for the scheduling
  // office only: its teacher and students don't see it until it's published.
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// One space per subject offering. Enforced in the DB so the lazy
// get-or-create path can't race two spaces into existence for one schedule.
ClassSpaceSchema.index({ schedule: 1 }, { unique: true });

// Listing queries
ClassSpaceSchema.index({ sectionCode: 1, isActive: 1 });
ClassSpaceSchema.index({ faculty: 1, isActive: 1 });
ClassSpaceSchema.index({ 'enrolledStudents.student': 1 });

/** Random 8-char join code. Ambiguous characters (0/O, 1/I) are excluded. */
ClassSpaceSchema.statics.generateClassCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/** Generate a class code that isn't already taken. */
ClassSpaceSchema.statics.generateUniqueClassCode = async function () {
  // Bounded so a pathological collision streak can't spin forever
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = this.generateClassCode();
    const clash = await this.exists({ classCode: code });
    if (!clash) return code;
  }
  throw new Error('Could not generate a unique class code after 20 attempts');
};

/**
 * Normalise a ref to its id string.
 *
 * `enrolledStudents.student` is an ObjectId normally, but a full Student
 * document once populated. Calling .toString() on a populated document does
 * NOT yield the id, so compare through this instead.
 */
const refId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

/** Is this student enrolled here? Accepts a Student id or populated document. */
ClassSpaceSchema.methods.hasStudent = function (studentId) {
  const target = refId(studentId);
  if (!target) return false;
  return this.enrolledStudents.some(e => refId(e.student) === target);
};

/** The enrollment entry for a student (carries enrollmentType), or undefined. */
ClassSpaceSchema.methods.findEnrollment = function (studentId) {
  const target = refId(studentId);
  if (!target) return undefined;
  return this.enrolledStudents.find(e => refId(e.student) === target);
};

/** Drop a student's enrollment. Returns true if anything was removed. */
ClassSpaceSchema.methods.removeStudent = function (studentId) {
  const target = refId(studentId);
  if (!target) return false;
  const before = this.enrolledStudents.length;
  this.enrolledStudents = this.enrolledStudents.filter(
    e => refId(e.student) !== target
  );
  return this.enrolledStudents.length !== before;
};

module.exports = mongoose.model('ClassSpace', ClassSpaceSchema);
