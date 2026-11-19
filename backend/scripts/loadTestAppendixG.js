#!/usr/bin/env node
/**
 * Appendix G, Table 45 — concurrent user load test (CU-01 to CU-03).
 *
 *   node scripts/loadTestAppendixG.js --base http://127.0.0.1:5000 [--out <path>]
 *
 * Drives three authenticated read endpoints at 10, 20 and 30 concurrent
 * connections and records the measured average, median, p95, p99 and slowest
 * response, plus every non-2xx reply. Reads only: no endpoint under test
 * writes anything, and no test accounts are created - it authenticates as
 * existing accounts with tokens signed from the project's own JWT secret, and
 * those tokens are never persisted as sessions.
 *
 * The host under test is recorded in the output, because "local Node server"
 * and "deployed free tier" are not comparable numbers and the table has to say
 * which one it is.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../models/User.model');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:5000').replace(/\/$/, '');
const OUT = arg('out', path.join(__dirname, '..', '..', 'APPENDIX_G_LOADTEST.json'));
const LEVELS = (arg('levels', '10,20,30')).split(',').map(Number);
const DURATION_MS = Number(arg('ms', 10000));

const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};

const round = (n) => (n === null ? null : Math.round(n * 100) / 100);

/**
 * Hammer one endpoint at a fixed concurrency for a fixed wall-clock window.
 * Each worker issues requests back to back, so concurrency stays constant.
 */
async function hammer({ url, token, connections, durationMs }) {
  const latencies = [];
  const statuses = {};
  const errors = [];
  const deadline = Date.now() + durationMs;

  const worker = async () => {
    while (Date.now() < deadline) {
      const started = Date.now();
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        // Drain the body: ignoring it would measure headers only.
        await res.arrayBuffer();
        latencies.push(Date.now() - started);
        statuses[res.status] = (statuses[res.status] || 0) + 1;
      } catch (err) {
        latencies.push(Date.now() - started);
        errors.push(err.message);
      }
    }
  };

  await Promise.all(Array.from({ length: connections }, worker));

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = latencies.length;
  const non2xx = Object.entries(statuses)
    .filter(([code]) => Number(code) < 200 || Number(code) >= 300)
    .reduce((n, [, count]) => n + count, 0);
  const server5xx = Object.entries(statuses)
    .filter(([code]) => Number(code) >= 500)
    .reduce((n, [, count]) => n + count, 0);

  return {
    connections,
    durationMs,
    requests: total,
    requestsPerSecond: round(total / (durationMs / 1000)),
    avgMs: round(total ? latencies.reduce((a, b) => a + b, 0) / total : null),
    medianMs: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    slowestMs: sorted.length ? sorted[sorted.length - 1] : null,
    fastestMs: sorted.length ? sorted[0] : null,
    statuses,
    non2xx,
    server5xx,
    transportErrors: errors.length,
    sampleError: errors[0] || null,
  };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const pick = async (roles) => User.findOne({ role: { $in: roles }, isActive: true })
    .select('_id role email').lean();

  const staff = await pick(['scheduling_officer', 'admin']);
  const student = await pick(['student']);
  if (!staff) throw new Error('No active admin or scheduling officer to authenticate as.');

  const tokenFor = (user) => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const staffToken = tokenFor(staff);
  const studentToken = student ? tokenFor(student) : staffToken;

  await mongoose.disconnect();

  const cases = [
    { id: 'CU-01', label: 'Dashboard statistics', url: `${BASE}/api/dashboard/stats`, token: staffToken, as: staff.role },
    { id: 'CU-02', label: 'Timetable grid query', url: `${BASE}/api/schedules`, token: staffToken, as: staff.role },
    { id: 'CU-03', label: 'Student class list', url: `${BASE}/api/classSpaces/my-classes`, token: studentToken, as: student ? 'student' : staff.role },
  ];

  // Fail fast and loudly if the server is not actually up, rather than
  // reporting a table full of transport errors as if they were latencies.
  for (const c of cases) {
    const res = await fetch(c.url, { headers: { Authorization: `Bearer ${c.token}` } })
      .catch((err) => { throw new Error(`${c.id}: cannot reach ${c.url} - ${err.message}`); });
    console.log(`${c.id} warm-up ${c.url} -> HTTP ${res.status}`);
    if (res.status >= 400) {
      console.warn(`  WARNING: ${c.id} answers ${res.status}; its numbers below measure that response.`);
    }
  }

  const results = [];
  for (const c of cases) {
    for (const connections of LEVELS) {
      process.stdout.write(`${c.id} @ ${connections} connections... `);
      const run = await hammer({ url: c.url, token: c.token, connections, durationMs: DURATION_MS });
      results.push({ ...c, token: undefined, ...run });
      console.log(`${run.requests} reqs, avg ${run.avgMs}ms, p99 ${run.p99Ms}ms, slowest ${run.slowestMs}ms, `
        + `${run.server5xx} server errors`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: BASE,
    hostKind: /127\.0\.0\.1|localhost/.test(BASE) ? 'local Node server' : 'remote deployment',
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    settings: { levels: LEVELS, durationMsPerLevel: DURATION_MS },
    // Stated up front so the table is read against a threshold chosen before
    // the numbers were seen, not after.
    passThreshold: {
      note: 'Local Node server against a remote MongoDB Atlas cluster.',
      avgMsUnder: 2000,
      server5xxAtMost: 0,
    },
    results: results.map((r) => ({
      ...r,
      pass: r.avgMs !== null && r.avgMs < 2000 && r.server5xx === 0 && r.transportErrors === 0,
    })),
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\nWritten: ${OUT}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
