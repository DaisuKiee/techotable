#!/usr/bin/env node
/**
 * Compare the timetable engines on real sections. Read-only: nothing is saved.
 *
 *   node .claude/skills/ctu-timetabling/scripts/compare-engines.js [--program BSIT] [--seconds 20]
 *
 * For one section per year level it captures the exact solver payload the app
 * builds, plans the section from scratch, and runs OR-Tools (when Python +
 * ortools are installed), the JS solver in quick mode and in thorough mode.
 * Prints score, time, busiest teacher load and a clash check for each.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const B = path.resolve(__dirname, '../../../../backend');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PROGRAM = arg('program', 'BSIT');
const SECONDS = Number(arg('seconds', 20));

require(path.join(B, 'node_modules/dotenv')).config({ path: path.join(B, '.env') });
const mongoose = require(path.join(B, 'node_modules/mongoose'));

/** Any section, teacher or room in two places at once? */
const clashes = (schedules = []) => {
  const busy = {};
  let count = 0;
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  for (const s of schedules) {
    for (const ts of s.time_slots || []) {
      const span = [toMin(ts.start_time), toMin(ts.end_time)];
      for (const key of [`section:${s.section_code}`, `faculty:${s.faculty?._id}`, `room:${s.room?._id}`]) {
        const list = (busy[`${key}:${ts.day}`] = busy[`${key}:${ts.day}`] || []);
        if (list.some(([a, b]) => span[0] < b && a < span[1])) count += 1;
        list.push(span);
      }
    }
  }
  return count;
};

const show = (r) => {
  if (!r || !r.success) return `failed: ${r?.error || r?.status || 'no result'}`;
  const st = r.statistics || {};
  const extra = st.thorough ? `  rebuilds ${st.rebuilds} (${st.rebuild_improvements} better)` : '';
  return `score ${Math.round(st.objective ?? 0)}  ${st.solver_time}s  status ${r.status}  busiest ${st.busiest_faculty_units ?? '?'} units  clashes ${clashes(r.schedules)}${extra}`;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  ['Subject', 'User', 'Room', 'Faculty', 'Section', 'Schedule'].forEach((m) => require(path.join(B, `models/${m}.model`)));

  // Capture the payload the app would send, without solving
  const solver = require(path.join(B, 'services/builtinSolver.service'));
  const captured = [];
  const realWorker = solver.solveInWorker;
  solver.solveInWorker = async (data) => { captured.push(data); return { success: false, status: 'UNKNOWN', schedules: null, error: 'captured' }; };
  const { previewWithORTools } = require(path.join(B, 'services/ortoolsBridge.service'));
  const Section = require(path.join(B, 'models/Section.model'));

  const secs = await Section.find({ program: PROGRAM }).sort({ yearLevel: 1, sectionLetter: 1 }).lean();
  const picked = [1, 2, 3, 4].map((y) => secs.find((s) => s.yearLevel === y)).filter(Boolean);
  if (!picked.length) { console.log(`No ${PROGRAM} sections found.`); await mongoose.disconnect(); return; }

  for (const sec of picked) {
    await previewWithORTools({
      academicYear: sec.academicYear, semester: sec.semester, program: sec.program,
      yearLevel: sec.yearLevel, section: sec.sectionLetter, shift: sec.shift || 'Day',
      engine: 'builtin', timeLimit: SECONDS,
    }).catch(() => {});
  }
  solver.solveInWorker = realWorker;
  await mongoose.disconnect();

  console.log(`${PROGRAM}, ${SECONDS}s per engine, each section planned from scratch\n`);
  captured.forEach((data, i) => {
    const fresh = { ...data, already_scheduled: {}, existing: [], time_limit: SECONDS };
    const py = spawnSync('python', [path.join(B, 'python/ortools_scheduler.py')], {
      input: JSON.stringify(fresh), encoding: 'utf8', maxBuffer: 64e6,
    });
    let ort;
    if (py.error) ort = { success: false, error: 'Python not available' };
    else {
      try { ort = JSON.parse(py.stdout.trim().split('\n').pop()); } catch (e) { ort = { success: false, error: (py.stderr || '').trim().split('\n').pop() || 'no output' }; }
    }
    const quick = solver.solveTimetable({ ...fresh, options: { ...fresh.options, thorough: false } });
    const thorough = solver.solveTimetable({ ...fresh, options: { ...fresh.options, thorough: true } });

    console.log(`${picked[i]?.sectionCode || `section ${i + 1}`} (${data.subjects.length} subjects)`);
    console.log(`  OR-Tools   ${show(ort)}`);
    console.log(`  JS quick   ${show(quick)}`);
    console.log(`  JS thorough ${show(thorough)}\n`);
  });
})().catch((e) => { console.error(e); process.exit(1); });
