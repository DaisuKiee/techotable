const mongoose = require('mongoose');

/**
 * What a section looked like in a term that has ended.
 *
 * Sections are long-lived (BSIT-1A-D keeps its code and enrollment code), and
 * move to each new term automatically. Before they move, a snapshot is stored
 * here so the Archive can still show who was in the section and what it took.
 */
const SectionArchiveSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  sectionCode: { type: String, required: true },
  program: String,
  yearLevel: Number,
  sectionLetter: String,
  shift: String,
  academicYear: { type: String, required: true },
  semester: { type: Number, required: true },
  adviser: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null },
  room: String,
  maxStudents: Number,
  // Students who were placed in the section when the term ended
  students: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    studentId: String,
    name: String,
  }],
  studentCount: { type: Number, default: 0 },
  scheduleCount: { type: Number, default: 0 },
  archivedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

SectionArchiveSchema.index({ section: 1, academicYear: 1, semester: 1 }, { unique: true });
SectionArchiveSchema.index({ academicYear: 1, semester: 1, program: 1 });

module.exports = mongoose.model('SectionArchive', SectionArchiveSchema);
