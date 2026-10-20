/**
 * Teaching-experience scoring with recency weighting.
 *
 * A faculty member who taught a subject LAST year is a stronger candidate than
 * one who taught it five years ago, even if both taught it the same number of
 * times. Every consumer (rule-based recommender, RAG prompt, UI) reads its
 * numbers from here so the ranking is consistent everywhere.
 *
 * teachingHistory entries look like:
 *   { subjectCode, subjectName, semester, academicYear: '2024-2025', program, rating }
 */

// Recency multiplier applied per teaching occurrence.
// 0 years ago = 1.00 (current AY), 1 = 0.85, 2 = 0.70, 3 = 0.55, 4 = 0.40,
// 5+ = 0.25 floor, so old experience still counts for something but never
// outweighs equivalent recent experience.
const RECENCY_DECAY_PER_YEAR = 0.15;
const RECENCY_FLOOR = 0.25;

/** Treat experience older than this as "stale" for reporting purposes. */
const STALE_AFTER_YEARS = 5;

/**
 * Parse the starting year out of an academic year string.
 * Accepts '2024-2025', '2024-25', or '2024'.
 * @returns {number|null}
 */
const parseAcademicYearStart = (academicYear) => {
  if (!academicYear) return null;
  const match = String(academicYear).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Starting year of the current academic year. Philippine academic years run
 * roughly August-June, so anything from June onward belongs to the AY that
 * starts in the current calendar year.
 */
const currentAcademicYearStart = (now = new Date()) =>
  now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;

/** Format a starting year back into '2024-2025'. */
const formatAcademicYear = (startYear) => `${startYear}-${startYear + 1}`;

/**
 * How many academic years ago an entry was taught. 0 = current AY.
 * @returns {number|null} null when the academic year can't be parsed
 */
const yearsAgoFor = (academicYear, now = new Date()) => {
  const start = parseAcademicYearStart(academicYear);
  if (start === null) return null;
  return Math.max(currentAcademicYearStart(now) - start, 0);
};

/**
 * Recency multiplier for a given age in academic years.
 * @param {number} yearsAgo
 * @returns {number} between RECENCY_FLOOR and 1
 */
const recencyWeight = (yearsAgo) => {
  if (yearsAgo === null || yearsAgo === undefined) return RECENCY_FLOOR;
  return Math.max(RECENCY_FLOOR, 1 - RECENCY_DECAY_PER_YEAR * yearsAgo);
};

/** Does a history entry refer to this subject? Prefers code, falls back to name. */
const matchesSubject = (entry, subject) => {
  if (!entry || !subject) return false;

  const code = subject.subjectCode || subject.code;
  if (code && entry.subjectCode) {
    return String(entry.subjectCode).toLowerCase() === String(code).toLowerCase();
  }

  const name = subject.subjectName || subject.name;
  if (name && entry.subjectName) {
    return String(entry.subjectName).toLowerCase() === String(name).toLowerCase();
  }

  return false;
};

/**
 * Summarise one faculty member's experience with one subject.
 *
 * @param {object} faculty  Faculty document (needs teachingHistory or experiencedSubjects)
 * @param {object} subject  { subjectCode, subjectName }
 * @returns {{
 *   timesTaught: number,
 *   weightedExperience: number,
 *   lastTaughtAcademicYear: string|null,
 *   lastTaughtYearsAgo: number|null,
 *   firstTaughtAcademicYear: string|null,
 *   isStale: boolean,
 *   avgRating: number|null,
 *   occurrences: Array<{academicYear: string, semester: string, yearsAgo: number|null, rating: number|null, weight: number}>
 * }}
 */
const summarizeSubjectExperience = (faculty, subject, now = new Date()) => {
  let occurrences = [];
  
  // First try teachingHistory (actual system records)
  const historyEntries = (faculty?.teachingHistory || []).filter(h => matchesSubject(h, subject));
  
  if (historyEntries.length > 0) {
    occurrences = historyEntries.map(h => {
      const yearsAgo = yearsAgoFor(h.academicYear, now);
      return {
        academicYear: h.academicYear || null,
        semester: h.semester || null,
        yearsAgo,
        rating: typeof h.rating === 'number' && h.rating > 0 ? h.rating : null,
        weight: recencyWeight(yearsAgo),
      };
    });
  } else {
    // Fallback to experiencedSubjects (qualifications/past experience)
    const subjectCode = subject.subjectCode || subject.code;
    const experiencedEntry = (faculty?.experiencedSubjects || []).find(
      exp => exp.subjectCode && subjectCode && 
             String(exp.subjectCode).toLowerCase() === String(subjectCode).toLowerCase()
    );
    
    if (experiencedEntry) {
      // Parse period like "this year", "last year", "2 years ago"
      let yearsAgo = 0;
      if (experiencedEntry.period) {
        const match = experiencedEntry.period.match(/(\d+)\s+years?\s+ago/i);
        if (match) {
          yearsAgo = parseInt(match[1], 10);
        } else if (experiencedEntry.period.toLowerCase().includes('last year')) {
          yearsAgo = 1;
        } else if (experiencedEntry.period.toLowerCase().includes('this year')) {
          yearsAgo = 0;
        }
      }
      
      // Create occurrences based on semestersTaught
      const semesterCount = experiencedEntry.semestersTaught || 1;
      for (let i = 0; i < semesterCount; i++) {
        const adjustedYearsAgo = yearsAgo + Math.floor(i / 2); // Spread semesters over years
        occurrences.push({
          academicYear: null,
          semester: null,
          yearsAgo: adjustedYearsAgo,
          rating: experiencedEntry.rating || null,
          weight: recencyWeight(adjustedYearsAgo),
        });
      }
    }
  }

  // Sort most recent first
  occurrences.sort((a, b) => (a.yearsAgo ?? 99) - (b.yearsAgo ?? 99));

  const weightedExperience = occurrences.reduce((sum, o) => sum + o.weight, 0);

  const rated = occurrences.filter(o => o.rating !== null);
  const avgRating = rated.length
    ? rated.reduce((sum, o) => sum + o.rating, 0) / rated.length
    : null;

  const ages = occurrences.map(o => o.yearsAgo).filter(y => y !== null);
  const lastTaughtYearsAgo = ages.length ? Math.min(...ages) : null;
  const oldest = ages.length ? Math.max(...ages) : null;

  return {
    timesTaught: occurrences.length,
    weightedExperience,
    lastTaughtAcademicYear: occurrences[0]?.academicYear ?? null,
    lastTaughtYearsAgo,
    firstTaughtAcademicYear:
      oldest === null ? null : formatAcademicYear(currentAcademicYearStart(now) - oldest),
    isStale: lastTaughtYearsAgo !== null && lastTaughtYearsAgo >= STALE_AFTER_YEARS,
    avgRating,
    occurrences,
  };
};

/**
 * Group a faculty member's whole history by subject, most experienced first.
 * Used by the UI to show "what has this teacher taught, and how recently".
 */
const summarizeAllSubjects = (faculty, now = new Date()) => {
  const bySubject = new Map();

  (faculty?.teachingHistory || []).forEach(h => {
    const key = h.subjectCode || h.subjectName;
    if (!key) return;
    if (!bySubject.has(key)) {
      bySubject.set(key, { subjectCode: h.subjectCode || null, subjectName: h.subjectName || null });
    }
  });

  return [...bySubject.values()]
    .map(subject => ({ ...subject, ...summarizeSubjectExperience(faculty, subject, now) }))
    .sort((a, b) => b.weightedExperience - a.weightedExperience);
};

/**
 * Score and rank faculty for a subject.
 *
 * Weights (max 100):
 *   Recency-weighted subject experience  0-45  <- dominant signal
 *   Rating on that subject               0-15
 *   Specialization match                 0-15
 *   Available workload                   0-15
 *   Qualification level                  0-10
 *
 * @param {Array} facultyList
 * @param {object} subject  { subjectCode, subjectName, units, requiredQualifications }
 * @param {object} [opts]
 * @param {boolean} [opts.onlyWithCapacity=false] Drop faculty who cannot absorb the units
 * @returns {Array} ranked entries with a score breakdown and human-readable reason
 */
const rankFacultyForSubject = (facultyList = [], subject = {}, opts = {}) => {
  const { onlyWithCapacity = false, now = new Date() } = opts;
  const units = subject.units || 3;

  const ranked = facultyList.map(faculty => {
    const exp = summarizeSubjectExperience(faculty, subject, now);

    // Subject experience (0-45). Each recent teaching is worth ~15.
    const experienceScore = Math.min(exp.weightedExperience * 15, 45);

    // Rating on this subject (0-15)
    const ratingScore = exp.avgRating ? (exp.avgRating / 5) * 15 : 0;

    // Specialization overlap (0-15)
    const required = subject.requiredQualifications || [];
    const specs = faculty.specializations || [];
    const specMatches = specs.filter(spec =>
      required.some(req =>
        String(spec).toLowerCase().includes(String(req).toLowerCase()) ||
        String(req).toLowerCase().includes(String(spec).toLowerCase())
      )
    ).length;
    const specializationScore = Math.min(specMatches * 7.5, 15);

    // Remaining capacity (0-15)
    const maxLoad = faculty.maxTeachingLoad || 24;
    const currentLoad = faculty.currentLoad || 0;
    const availableLoad = maxLoad - currentLoad;
    const hasCapacity = currentLoad + units <= maxLoad;
    const workloadScore = hasCapacity
      ? Math.min(Math.max(availableLoad / maxLoad, 0) * 15, 15)
      : 0;

    // Qualification level (0-10)
    const quals = faculty.qualifications || [];
    const qualificationScore = quals.some(q => q.degree === 'PhD')
      ? 10
      : quals.some(q => ['MS', 'MA', 'MEd'].includes(q.degree))
      ? 7
      : 5;

    const total =
      experienceScore + ratingScore + specializationScore + workloadScore + qualificationScore;

    return {
      faculty,
      score: Math.round(total * 10) / 10,
      hasCapacity,
      availableLoad,
      experience: exp,
      breakdown: {
        subjectExperience: Math.round(experienceScore * 10) / 10,
        rating: Math.round(ratingScore * 10) / 10,
        specialization: Math.round(specializationScore * 10) / 10,
        workload: Math.round(workloadScore * 10) / 10,
        qualification: qualificationScore,
      },
      reason: buildReason(exp, hasCapacity, availableLoad),
    };
  });

  const filtered = onlyWithCapacity ? ranked.filter(r => r.hasCapacity) : ranked;

  return filtered.sort((a, b) => {
    // Recency-weighted subject experience wins ties on raw score
    if (b.score !== a.score) return b.score - a.score;
    return b.experience.weightedExperience - a.experience.weightedExperience;
  });
};

/** Short human-readable justification for a ranking. */
const buildReason = (exp, hasCapacity, availableLoad) => {
  const parts = [];

  if (exp.timesTaught === 0) {
    parts.push('No prior experience with this subject');
  } else {
    const when =
      exp.lastTaughtYearsAgo === 0
        ? 'this academic year'
        : exp.lastTaughtYearsAgo === 1
        ? 'last year'
        : `${exp.lastTaughtYearsAgo} years ago`;
    parts.push(
      `Taught it ${exp.timesTaught}x, most recently ${when} (${exp.lastTaughtAcademicYear})`
    );
    if (exp.isStale) parts.push('experience is dated');
    if (exp.avgRating) parts.push(`rated ${exp.avgRating.toFixed(1)}/5 on this subject`);
  }

  parts.push(hasCapacity ? `${availableLoad} units available` : 'at maximum load');

  return parts.join(' · ');
};

module.exports = {
  RECENCY_DECAY_PER_YEAR,
  RECENCY_FLOOR,
  STALE_AFTER_YEARS,
  parseAcademicYearStart,
  currentAcademicYearStart,
  formatAcademicYear,
  yearsAgoFor,
  recencyWeight,
  matchesSubject,
  summarizeSubjectExperience,
  summarizeAllSubjects,
  rankFacultyForSubject,
};
