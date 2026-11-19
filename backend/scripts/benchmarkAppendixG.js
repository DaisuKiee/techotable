#!/usr/bin/env node
/**
 * Appendix G, Table 43 — per-program generation benchmark and workload audit.
 *
 * READ-ONLY. Every run goes through `previewWithORTools()`, which plans a
 * timetable and returns it without writing anything, so no published schedule
 * is touched. The only writes this script makes are to its own output files.
 *
 *   node scripts/benchmarkAppendixG.js [--seconds 10] [--runs 3] [--out <path>]
 *
 * For every active program it runs three timed trials per year level, records
 * the wall-clock time, which engine actually executed, and the conflict count
 * from the bridge's own independent `findConflicts()`. A program with no
 * section records for the term is still run, against the synthetic single
 * section the bridge falls back to, and is labelled as such - it is a
 * benchmark of that program's curriculum, not of real enrolment. A program
 * with no subjects at all cannot be run and says so.
 *
 * Nothing here is estimated. Anything that could not be measured is reported
 * as not measured.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Program = require('../models/Program.model');
const Section = require('../models/Section.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const { getFacultyLoads } = require('../utils/facultyLoad');
const { previewWithORTools, checkORToolsAvailability } = require('../services/ortoolsBridge.service');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SECONDS = Number(arg('seconds', 10));
const RUNS = Number(arg('runs', 3));
const OUT = arg('out', path.join(__dirname, '..', '..', 'APPENDIX_G_BENCHMARK.json'));

const round = (n, places = 3) => Math.round(n * 10 ** places) / 10 ** places;

/** Mean, sample standard deviation, min and max of a list of numbers. */
const describe = (values) => {
  const n = values.length;
  if (n === 0) return { n: 0, mean: null, sd: null, min: null, max: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1
    ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
    : 0;
  return {
    n,
    mean: round(mean, 2),
    sd: round(Math.sqrt(variance), 2),
    min: round(Math.min(...values), 2),
    max: round(Math.max(...values), 2),
  };
};

async function benchmarkYearLevel({ program, yearLevel, academicYear, semester, shift, sections }) {
  const row = {
    program,
    yearLevel,
    shift,
    sectionsInDatabase: sections.length,
    sectionCodes: sections.map((s) => s.sectionCode),
    syntheticSection: sections.length === 0,
    runs: [],
  };

  for (let i = 0; i < RUNS; i++) {
    const started = process.hrtime.bigint();
    let preview;
    let error = null;
    try {
      preview = await previewWithORTools({
        academicYear,
        semester,
        program,
        yearLevel,
        // No section letter: the bridge then plans every section of this year
        // level together, which is how the app generates for real.
        shift,
        timeLimit: SECONDS,
      });
    } catch (err) {
      error = err.message;
    }
    const elapsedSeconds = round(Number(process.hrtime.bigint() - started) / 1e9, 3);

    if (error) {
      row.runs.push({ run: i + 1, seconds: elapsedSeconds, error });
      row.blocked = error;
      break; // the same error will repeat; do not pad the table with it
    }

    row.runs.push({
      run: i + 1,
      seconds: elapsedSeconds,
      solverSeconds: preview.preview?.statistics?.solverTime ?? null,
      success: preview.success,
      status: preview.status ?? null,
      engineThatRan: preview.engine,
      fellBackToJS: !!preview.fellBack,
      classesPlaced: preview.preview?.schedules?.length ?? 0,
      subjectsTotal: preview.preview?.statistics?.totalSubjects ?? null,
      subjectsScheduled: preview.preview?.statistics?.scheduledSubjects ?? null,
      subjectsFailed: preview.preview?.failed?.length ?? 0,
      // The bridge's own independent check of its own output.
      conflicts: preview.preview?.conflicts?.length ?? null,
      relaxedPrepGap: !!preview.relaxedPrepGap,
      busiestFacultyUnits: preview.preview?.statistics?.busiestFacultyUnits ?? null,
      message: preview.success ? null : preview.message,
    });
  }

  const ok = row.runs.filter((r) => !r.error);
  if (ok.length) {
    row.averageSeconds = round(ok.reduce((a, r) => a + r.seconds, 0) / ok.length, 3);
    row.engineUsed = [...new Set(ok.map((r) => r.engineThatRan))].join(', ');
    row.conflictsFound = Math.max(...ok.map((r) => r.conflicts ?? 0));
    row.allRunsSucceeded = ok.every((r) => r.success);
    row.prepGapHeld = ok.every((r) => !r.relaxedPrepGap);
  }
  return row;
}

async function workloadAudit({ academicYear, semester }) {
  const faculty = await Faculty.find({ isActive: true })
    .populate('user', 'firstName lastName')
    .lean();

  const loads = await getFacultyLoads({ academicYear, semester });

  const rows = faculty.map((f) => {
    const load = loads.get(String(f._id)) || { hours: 0, units: 0, classes: 0 };
    // `positionHours` has a schema getter, which `.lean()` bypasses, so the
    // release hours are worked out here the same way the model does.
    const positionHours = { Chairman: 12, Dean: 9, CD: 6 }[f.position] || 0;
    return {
      employeeId: f.employeeId,
      name: `${f.user?.firstName || ''} ${f.user?.lastName || ''}`.trim() || f.employeeId,
      position: f.position,
      programs: f.programs || [],
      teachingHours: load.hours,
      positionHours,
      totalHours: round(load.hours + positionHours, 2),
      units: load.units,
      classes: load.classes,
    };
  });

  const withClasses = rows.filter((r) => r.classes > 0);

  const summarise = (list) => ({
    teachingHours: describe(list.map((r) => r.teachingHours)),
    totalHours: describe(list.map((r) => r.totalHours)),
    units: describe(list.map((r) => r.units)),
    within36: list.filter((r) => r.totalHours <= 36).length,
    within40: list.filter((r) => r.totalHours <= 40).length,
    over40: list.filter((r) => r.totalHours > 40).length,
  });

  return {
    term: { academicYear, semester },
    allActiveFaculty: { count: rows.length, ...summarise(rows) },
    facultyWithAtLeastOneClass: { count: withClasses.length, ...summarise(withClasses) },
    rows: rows.sort((a, b) => b.totalHours - a.totalHours),
  };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ortools = await checkORToolsAvailability();
  console.log('OR-Tools availability:', JSON.stringify(ortools));

  // The term with the most active sections is the one being planned.
  const termRows = await Section.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { ay: '$academicYear', sem: '$semester' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  if (!termRows.length) {
    console.error('No active sections anywhere; nothing to benchmark.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const academicYear = termRows[0]._id.ay;
  const semester = termRows[0]._id.sem;
  console.log(`Target term: ${academicYear} semester ${semester}\n`);

  const programs = await Program.find({ isActive: true }).select('code name').lean();
  const results = [];

  for (const program of programs) {
    const [sections, subjectCount, facultyCount] = await Promise.all([
      Section.find({ program: program.code, isActive: true, academicYear, semester })
        .select('sectionCode yearLevel sectionLetter shift').lean(),
      Subject.countDocuments({ program: program.code, isActive: true }),
      Faculty.countDocuments({ programs: program.code, isActive: true }),
    ]);

    const entry = {
      program: program.code,
      programName: program.name,
      activeSections: sections.length,
      activeSubjects: subjectCount,
      facultyAssigned: facultyCount,
      yearLevels: [],
    };

    if (subjectCount === 0) {
      entry.notBenchmarked = 'No active subjects exist for this program, so the generator has nothing to place.';
      console.log(`${program.code.padEnd(8)} skipped: ${entry.notBenchmarked}`);
      results.push(entry);
      continue;
    }

    // Year levels that actually have sections; otherwise every year level the
    // curriculum defines, planned against the bridge's synthetic section.
    const yearsWithSections = [...new Set(sections.map((s) => s.yearLevel))].sort();
    const curriculumYears = await Subject.distinct('yearLevel', { program: program.code, isActive: true });
    const years = yearsWithSections.length
      ? yearsWithSections
      : curriculumYears.filter((y) => y >= 1 && y <= 4).sort();

    for (const yearLevel of years) {
      const ofYear = sections.filter((s) => s.yearLevel === yearLevel);
      const shift = ofYear[0]?.shift || 'Day';
      process.stdout.write(`${program.code} year ${yearLevel} (${ofYear.length} section(s))... `);
      const row = await benchmarkYearLevel({
        program: program.code, yearLevel, academicYear, semester, shift, sections: ofYear,
      });
      entry.yearLevels.push(row);
      console.log(row.blocked
        ? `blocked: ${row.blocked}`
        : `avg ${row.averageSeconds}s, engine ${row.engineUsed}, ${row.conflictsFound} conflicts`);
    }

    results.push(entry);
  }

  console.log('\nFaculty workload audit...');
  const workload = await workloadAudit({ academicYear, semester });
  console.log(`  ${workload.allActiveFaculty.count} active faculty, `
    + `${workload.facultyWithAtLeastOneClass.count} with at least one class this term`);
  console.log(`  total hours (teaching + position release), faculty with classes: `
    + `mean ${workload.facultyWithAtLeastOneClass.totalHours.mean}, `
    + `SD ${workload.facultyWithAtLeastOneClass.totalHours.sd}, `
    + `range ${workload.facultyWithAtLeastOneClass.totalHours.min}-${workload.facultyWithAtLeastOneClass.totalHours.max}`);

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    term: { academicYear, semester },
    settings: { timeLimitSeconds: SECONDS, runsPerYearLevel: RUNS },
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      ortools,
      mongoServer: mongoose.connection.db ? await mongoose.connection.db.admin().serverInfo().then((i) => i.version).catch(() => null) : null,
    },
    inventory: {
      activeRooms: await Room.countDocuments({ isActive: true }),
      activeFaculty: await Faculty.countDocuments({ isActive: true }),
      activeSchedules: await Schedule.countDocuments({ isActive: true }),
      publishedSchedules: await Schedule.countDocuments({ isActive: true, status: 'published' }),
    },
    programs: results,
    workload,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\nWritten: ${OUT}`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
