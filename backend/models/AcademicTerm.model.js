const mongoose = require('mongoose');

/**
 * One semester of an academic year, with the dates it runs.
 *
 * Each program's manager (or the scheduling office) maintains these on the
 * Semesters page. The term whose dates cover today is that program's "current
 * term": its sections, new students and new schedules follow it, and when a new term starts the previous one's sections
 * are archived (see services/academicTerm.service.js).
 */
const AcademicTermSchema = new mongoose.Schema({
  // Each program has its own semesters (its manager sets the dates), so one
  // program starting a term never moves another program's sections.
  program: {
    type: String,
    required: [true, 'Program is required'],
    trim: true,
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    match: [/^\d{4}-\d{4}$/, 'Academic year must look like 2026-2027'],
    validate: {
      validator: (v) => {
        const [a, b] = String(v).split('-').map(Number);
        return b === a + 1;
      },
      message: 'The second year must follow the first (e.g. 2026-2027)',
    },
  },
  // 1 = first semester, 2 = second semester, 3 = summer / midyear term
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    enum: [1, 2, 3],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  // When sections were moved into this term (set once, by the rollover)
  appliedAt: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

AcademicTermSchema.index({ program: 1, academicYear: 1, semester: 1 }, { unique: true });
AcademicTermSchema.index({ program: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('AcademicTerm', AcademicTermSchema);
