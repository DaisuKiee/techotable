/**
 * Built-in timetable solver - the fallback when OR-Tools cannot run.
 *
 * This is NOT a first-fit heuristic. It takes the exact payload the CP-SAT
 * script gets (see preparePythonInput in ortoolsBridge.service.js), models the
 * same thing, and returns the same result shape, so everything downstream -
 * saving, the preview, statistics - works unchanged whichever engine ran.
 *
 * Same model as python/ortools_scheduler.py:
 *  - classes are split into the same meeting blocks (labs as full sessions,
 *    first-year NSTP as one block);
 *  - hard rules: a section, a teacher and a room are each in one place at a
 *    time, saved classes and declared unavailability are immovable, blocks
 *    never cross the lunch break, a subject meets at most once per day, and
 *    teaching load stays within each teacher's remaining cap;
 *  - the same weighted objective (experience, qualification, busiest-teacher
 *    load, compactness, avoiding 7 AM, NSTP on Saturday morning), so the
 *    "What should it optimise for?" presets mean the same thing here.
 *
 * Search: a min-conflicts repair builds a clash-free timetable (placing a class
 * may evict the classes it clashes with, which then go back in the queue), then
 * local search moves one class at a time while the exact objective improves.
 * That repeats from randomised starting points until the time budget runs out
 * or the best score stops improving, and the best timetable found wins. Unlike
 * CP-SAT it cannot prove optimality, so the status is FEASIBLE, never OPTIMAL.
 *
 * Runs in a worker thread: a search can take seconds of pure CPU and must not
 * stall every other request on the server.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const LAB_ROOM_TYPES = new Set(['Laboratory', 'Computer Lab', 'Workshop']);

// Mirrors DEFAULT_WEIGHTS in ortools_scheduler.py
const DEFAULT_WEIGHTS = {
  experience: 10,
  qualified: 300,
  balance: 40,
  compact: 1,
  prefer_8am: 50,
};
const NSTP_MISS_PENALTY = 1000;

// Stop restarting once this many in a row fail to beat the best score
const STALE_RESTARTS = 40;

const hhmm = (value) => {
  const [h, m] = String(value || '').split(':');
  return parseInt(h, 10) * 60 + (parseInt(m, 10) || 0);
};

/** Small seeded PRNG so a run is reproducible for the same input. */
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

class BuiltinSolver {
  constructor(data) {
    this.data = data;
    this.subjects = data.subjects || [];
    this.faculty = data.faculty || [];
    this.rooms = data.rooms || [];
    this.days = data.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.slots = data.time_slots;
    this.sections = this.normaliseSections(data.sections);
    this.existing = data.existing || [];
    this.alreadyScheduled = {};
    for (const [k, vals] of Object.entries(data.already_scheduled || {})) {
      this.alreadyScheduled[String(k)] = new Set((vals || []).map(String));
    }
    this.yearLevel = parseInt(data.parameters?.year_level, 10) || 0;

    const options = data.options || {};
    this.maxBlock = Math.max(1, parseInt(options.max_block_hours ?? 3, 10));
    this.maxRoomCandidates = Math.max(1, parseInt(options.max_room_candidates ?? 6, 10));
    this.weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };

    this.spd = this.slots.length;
    this.horizon = this.days.length * this.spd;
    this.breakSlots = new Set(
      this.slots.map((s, i) => (s.is_break || s.isLunch ? i : -1)).filter(i => i >= 0)
    );
    this.slot7am = this.slots.findIndex(s => s.start === '07:00');

    this.nstpTarget = null;
    const sat = this.days.indexOf('Saturday');
    const slot8 = this.slots.findIndex(s => s.start === '08:00');
    if (this.yearLevel === 1 && sat >= 0 && slot8 >= 0) this.nstpTarget = sat * this.spd + slot8;

    this.classes = [];
    this.skipped = [];
    this.diagnostics = [];
    this.startsCache = new Map();
  }

  normaliseSections(value) {
    if (Number.isInteger(value)) {
      return Array.from({ length: Math.max(1, value) }, (_, i) => ({
        letter: String.fromCharCode(65 + i), code: null, max_students: 40,
      }));
    }
    const out = (value || []).map((s, i) => ({
      letter: s.letter || String.fromCharCode(65 + i),
      code: s.code || null,
      max_students: s.max_students || 40,
      home_room: s.home_room || null,
    }));
    return out.length ? out : [{ letter: 'A', code: null, max_students: 40 }];
  }

  // ---------------------------------------------------------------- setup

  splitHours(hours, preferMax = false) {
    hours = parseInt(hours, 10) || 0;
    const blocks = [];
    let remaining = hours;
    while (remaining > 0) {
      let take = Math.min(this.maxBlock, remaining);
      if (!preferMax && remaining - take === 1 && take > 1) take -= 1;
      blocks.push(take);
      remaining -= take;
    }
    return blocks;
  }

  buildClasses() {
    for (const subject of this.subjects) {
      let lecture = parseInt(subject.lecture_hours, 10) || 0;
      const lab = parseInt(subject.lab_hours, 10) || 0;
      if (lecture + lab <= 0) lecture = parseInt(subject.units, 10) || 3;

      const code = String(subject.subject_code || '').toUpperCase();
      const name = String(subject.subject_name || '').toUpperCase();
      const isNstp = (code.includes('NSTP') || name.includes('NSTP')) && this.yearLevel === 1;

      let blocks;
      let labFrom = null;
      if (isNstp) {
        blocks = [(lecture + lab) || parseInt(subject.units, 10) || 3];
      } else {
        const lec = this.splitHours(lecture);
        const labs = this.splitHours(lab, true);
        blocks = lec.concat(labs);
        labFrom = labs.length ? lec.length : null;
      }

      for (const section of this.sections) {
        const key = String(section.code || section.letter);
        if (this.alreadyScheduled[key]?.has(String(subject._id))) {
          this.skipped.push({ subject_code: subject.subject_code, section: key, reason: 'already scheduled' });
          continue;
        }
        this.classes.push({
          subject,
          section,
          sectionKey: key,
          blocks,
          labFrom,
          needsLab: (lab > 0 || !!subject.needs_lab) && !isNstp,
          isNstp,
          units: parseInt(subject.units, 10) || 3,
        });
      }
    }
  }

  allowedStarts(length) {
    if (this.startsCache.has(length)) return this.startsCache.get(length);
    const allowed = [];
    for (let d = 0; d < this.days.length; d++) {
      for (let s = 0; s <= this.spd - length; s++) {
        let ok = true;
        for (let i = s; i < s + length; i++) if (this.breakSlots.has(i)) { ok = false; break; }
        if (ok) allowed.push(d * this.spd + s);
      }
    }
    this.startsCache.set(length, allowed);
    return allowed;
  }

  candidateFaculty(klass) {
    const ok = this.faculty
      .map((f, i) => i)
      .filter(i => this.loadCap[i] >= klass.units);
    return ok.length ? ok : this.faculty.map((f, i) => i);
  }

  candidateRooms(klass) {
    const needed = klass.section.max_students;
    const code = klass.subject.subject_code;
    const cap = (i) => this.rooms[i].capacity || 0;
    const typeOk = (room) => !klass.needsLab || LAB_ROOM_TYPES.has(room.room_type);
    const shortlist = (list) => list.sort((a, b) => cap(a) - cap(b) || a - b).slice(0, this.maxRoomCandidates);

    // Same rule as the Python model: a section with a home room takes every
    // non-lab class there; lab subjects fall through to the lab-room search.
    const home = klass.section.home_room;
    if (home && !klass.needsLab) {
      const idx = this.rooms.findIndex(r => String(r._id) === String(home));
      if (idx >= 0) return [idx];
      this.diagnostics.push(
        `${code}: section ${klass.sectionKey}'s home room is inactive or missing, so another room was chosen.`
      );
    }

    const eligible = this.rooms.map((r, i) => i).filter(i => cap(i) >= needed && typeOk(this.rooms[i]));
    if (eligible.length) return shortlist(eligible);

    const byType = this.rooms.map((r, i) => i).filter(i => typeOk(this.rooms[i]));
    if (byType.length) {
      const largest = Math.max(...byType.map(cap));
      this.diagnostics.push(
        `${code}: no ${klass.needsLab ? 'laboratory ' : ''}room seats ${needed} students `
        + `(largest is ${largest}), so capacity was relaxed.`
      );
      return byType.sort((a, b) => cap(b) - cap(a)).slice(0, this.maxRoomCandidates);
    }

    this.diagnostics.push(`${code}: no laboratory room exists, so a lecture room was used.`);
    return shortlist(this.rooms.map((r, i) => i));
  }

  /** {day, start, end} window -> [firstPos, length] on the grid, or null. */
  windowToGrid(day, start, end) {
    const d = this.days.indexOf(day);
    if (d < 0) return null;
    const s = hhmm(start);
    const e = hhmm(end);
    if (!(e > s)) return null;
    let first = null;
    let last = null;
    this.slots.forEach((slot, i) => {
      if (hhmm(slot.end) > s && hhmm(slot.start) < e) {
        if (first === null) first = i;
        last = i;
      }
    });
    return first === null ? null : [d * this.spd + first, last - first + 1];
  }

  /**
   * Immovable occupancy: saved classes and declared unavailability. Mirrors
   * _fixed_intervals_from_existing / _window_interval in the Python model.
   */
  buildFixed() {
    this.fixed = new Map();
    const mark = (key, pos, len) => {
      if (!this.fixed.has(key)) this.fixed.set(key, new Uint8Array(this.horizon));
      const arr = this.fixed.get(key);
      for (let p = pos; p < pos + len && p < this.horizon; p++) arr[p] = 1;
    };

    const facIndex = new Map(this.faculty.map((f, i) => [String(f._id), i]));
    const roomIndex = new Map(this.rooms.map((r, i) => [String(r._id), i]));
    const slotIndex = new Map(this.slots.map((s, i) => [s.start, i]));

    for (const row of this.existing) {
      const d = this.days.indexOf(row.day);
      const s = slotIndex.get(row.start_time);
      if (d < 0 || s === undefined) continue;
      let len = Math.max(1, Math.round((hhmm(row.end_time || row.start_time) - hhmm(row.start_time)) / 60));
      len = Math.min(len, this.spd - s);
      const pos = d * this.spd + s;
      if (row.faculty_id && facIndex.has(String(row.faculty_id))) mark(`f${facIndex.get(String(row.faculty_id))}`, pos, len);
      if (row.room_id && roomIndex.has(String(row.room_id))) mark(`r${roomIndex.get(String(row.room_id))}`, pos, len);
      if (row.section_code) mark(`s${row.section_code}`, pos, len);
    }

    this.faculty.forEach((f, i) => {
      for (const w of f.unavailable || []) {
        const grid = this.windowToGrid(w.day, w.start || w.startTime, w.end || w.endTime);
        if (grid) mark(`f${i}`, grid[0], grid[1]);
      }
    });
  }

  prepare() {
    this.loadCap = this.faculty.map(f => Math.max(0,
      (parseInt(f.max_teaching_load, 10) || 24) - (parseInt(f.current_load, 10) || 0)));
    this.buildFixed();

    for (const klass of this.classes) {
      for (const length of klass.blocks) {
        if (this.allowedStarts(length).length === 0) {
          throw new Error(
            `${klass.subject.subject_code} needs a ${length}-hour block, but no day has `
            + `${length} consecutive free hours in this shift.`
          );
        }
      }
      klass.distinctDays = klass.blocks.length > 1 && klass.blocks.length <= this.days.length;
      if (klass.blocks.length > this.days.length) {
        this.diagnostics.push(
          `${klass.subject.subject_code}: ${klass.blocks.length} sessions across `
          + `${this.days.length} days, so some days carry two sessions.`
        );
      }
      klass.facultyCandidates = this.candidateFaculty(klass);
      klass.roomCandidates = this.candidateRooms(klass);

      // Per-teacher part of the objective that doesn't depend on timing
      const required = (klass.subject.required_qualifications || []).map(q => String(q).toLowerCase());
      const sid = String(klass.subject._id);
      klass.teacherScore = new Map(klass.facultyCandidates.map(fi => {
        const f = this.faculty[fi];
        const exp = parseInt((f.experience || {})[sid], 10) || 0;
        const specs = (f.specializations || []).map(s => String(s).toLowerCase());
        const qualified = required.length > 0
          && required.some(r => specs.some(s => r.includes(s) || s.includes(r)));
        return [fi, exp * this.weights.experience + (qualified ? this.weights.qualified : 0)];
      }));
    }
  }

  // Same checks as preflight() in the Python model, so both engines refuse the
  // same impossible requests with the same explanation.
  preflight() {
    const problems = [];
    const teachingSlots = this.slots.filter((s, i) => !this.breakSlots.has(i)).length;
    const capacityHours = teachingSlots * this.days.length;

    const required = {};
    for (const k of this.classes) required[k.sectionKey] = (required[k.sectionKey] || 0) + k.blocks.reduce((a, b) => a + b, 0);
    const booked = {};
    for (const row of this.existing) {
      if (!row.section_code) continue;
      const key = String(row.section_code);
      booked[key] = (booked[key] || 0)
        + Math.max(0, Math.round((hhmm(row.end_time || '0:00') - hhmm(row.start_time || '0:00')) / 60));
    }
    for (const [key, hours] of Object.entries(required)) {
      const b = booked[key] || 0;
      if (hours + b > capacityHours) {
        problems.push(
          `Section ${key} needs ${hours} more hours but the ${this.days.length}-day grid only has `
          + `${capacityHours} teaching hours.${b ? ` It already has ${b} hours scheduled.` : ''} `
          + 'Remove some existing classes or widen the shift.'
        );
      }
    }

    const totalUnits = this.classes.reduce((n, k) => n + k.units, 0);
    const available = this.faculty.reduce((n, f) => n + Math.max(0,
      (parseInt(f.max_teaching_load, 10) || 24) - (parseInt(f.current_load, 10) || 0)), 0);
    if (totalUnits > available) {
      problems.push(
        `The schedule needs ${totalUnits} teaching units but the available faculty can only `
        + `take ${available}. Add faculty or raise load limits.`
      );
    }

    const roomHoursNeeded = this.classes.reduce((n, k) => n + k.blocks.reduce((a, b) => a + b, 0), 0);
    const roomHoursAvailable = this.rooms.length * capacityHours;
    if (roomHoursNeeded > roomHoursAvailable) {
      problems.push(
        `${roomHoursNeeded} room-hours are needed but only ${roomHoursAvailable} are available `
        + `across ${this.rooms.length} rooms.`
      );
    }
    return problems;
  }

  // ---------------------------------------------------------------- state

  resetState() {
    // owner[key][pos] = class index occupying that cell, or -1
    this.owner = new Map();
    this.load = new Array(this.faculty.length).fill(0);
    this.assign = new Array(this.classes.length).fill(null);
  }

  ownerArr(key) {
    let arr = this.owner.get(key);
    if (!arr) {
      arr = new Int32Array(this.horizon).fill(-1);
      this.owner.set(key, arr);
    }
    return arr;
  }

  keysFor(c, f, r) {
    return [`s${this.classes[c].sectionKey}`, `f${f}`, `r${r}`];
  }

  place(c, option) {
    const klass = this.classes[c];
    for (const key of this.keysFor(c, option.f, option.r)) {
      const arr = this.ownerArr(key);
      option.starts.forEach((pos, b) => {
        for (let p = pos; p < pos + klass.blocks[b]; p++) arr[p] = c;
      });
    }
    this.load[option.f] += klass.units;
    this.assign[c] = option;
  }

  remove(c) {
    const option = this.assign[c];
    if (!option) return;
    const klass = this.classes[c];
    for (const key of this.keysFor(c, option.f, option.r)) {
      const arr = this.ownerArr(key);
      option.starts.forEach((pos, b) => {
        for (let p = pos; p < pos + klass.blocks[b]; p++) if (arr[p] === c) arr[p] = -1;
      });
    }
    this.load[option.f] -= klass.units;
    this.assign[c] = null;
  }

  timePenalty(klass, pos) {
    let pen = pos * this.weights.compact;
    if (this.slot7am >= 0 && this.weights.prefer_8am > 0 && pos % this.spd === this.slot7am) {
      pen += this.weights.prefer_8am;
    }
    if (klass.isNstp && this.nstpTarget !== null && pos !== this.nstpTarget) pen += NSTP_MISS_PENALTY;
    return pen;
  }

  /** The Python model's objective, computed exactly for the current state. */
  objective() {
    let total = 0;
    this.assign.forEach((opt, c) => {
      if (!opt) return;
      const klass = this.classes[c];
      total += klass.teacherScore.get(opt.f) || 0;
      for (const pos of opt.starts) total -= this.timePenalty(klass, pos);
    });
    total -= Math.max(0, ...this.load) * this.weights.balance;
    return total;
  }

  // --------------------------------------------------------------- search

  /**
   * Best placement for class c given everything else currently placed.
   *
   * allowConflicts=false: only clash-free options (local search).
   * allowConflicts=true : may overlap other generated classes - they are the
   *   ones that get evicted - but never saved classes or unavailability.
   */
  bestOption(c, { allowConflicts, noise = 0, rand, ejected }) {
    const klass = this.classes[c];
    const busiest = Math.max(0, ...this.load);
    // Longest block first: it has the fewest places to go
    const order = klass.blocks.map((len, b) => b).sort((a, b) => klass.blocks[b] - klass.blocks[a]);
    let best = null;

    const sectionKey = `s${klass.sectionKey}`;
    const sFixed = this.fixed.get(sectionKey);
    const sOwner = this.ownerArr(sectionKey);

    for (const f of klass.facultyCandidates) {
      if (this.load[f] + klass.units > this.loadCap[f]) continue;
      const fFixed = this.fixed.get(`f${f}`);
      const fOwner = this.ownerArr(`f${f}`);
      const balancePen = Math.max(0, this.load[f] + klass.units - busiest) * this.weights.balance;
      const teacher = (klass.teacherScore.get(f) || 0) - balancePen;

      for (const r of klass.roomCandidates) {
        const rFixed = this.fixed.get(`r${r}`);
        const rOwner = this.ownerArr(`r${r}`);
        const starts = new Array(klass.blocks.length);
        const usedDays = new Set();
        const ownCells = new Set();
        const conflicts = new Set();
        let score = teacher;
        let feasible = true;

        for (const b of order) {
          const len = klass.blocks[b];
          let pick = null;
          let pickCost = Infinity;
          let pickHits = null;

          for (const pos of this.allowedStarts(len)) {
            const day = Math.floor(pos / this.spd);
            if (klass.distinctDays && usedDays.has(day)) continue;

            let blocked = false;
            const hits = [];
            for (let p = pos; p < pos + len; p++) {
              if (ownCells.has(p)
                || (sFixed && sFixed[p]) || (fFixed && fFixed[p]) || (rFixed && rFixed[p])) {
                blocked = true; break;
              }
              for (const o of [sOwner[p], fOwner[p], rOwner[p]]) {
                if (o >= 0 && o !== c) hits.push(o);
              }
            }
            if (blocked) continue;
            if (hits.length && !allowConflicts) continue;

            const unique = new Set(hits);
            let evictCost = 0;
            for (const o of unique) if (!conflicts.has(o)) evictCost += 1 + 2 * (ejected[o] || 0);
            const cost = evictCost * 1e6 + this.timePenalty(klass, pos)
              + (noise ? rand() * noise : 0);
            if (cost < pickCost) {
              pick = pos; pickCost = cost; pickHits = unique;
            }
          }

          if (pick === null) { feasible = false; break; }
          starts[b] = pick;
          usedDays.add(Math.floor(pick / this.spd));
          for (let p = pick; p < pick + len; p++) ownCells.add(p);
          for (const o of pickHits) conflicts.add(o);
          score -= this.timePenalty(klass, pick);
        }
        if (!feasible) continue;

        let evictCost = 0;
        for (const o of conflicts) evictCost += 1 + 2 * (ejected[o] || 0);
        const rank = evictCost * 1e6 - score + (noise ? rand() * noise : 0);
        if (!best || rank < best.rank) best = { f, r, starts, conflicts, score, rank };
      }
    }
    return best;
  }

  /** Min-conflicts repair until every class is placed without clashes. */
  construct(rand, noise) {
    this.resetState();
    const n = this.classes.length;
    const ejected = new Array(n).fill(0);

    // Most constrained first: fewest teacher/room choices, then longest
    const order = this.classes.map((k, i) => i).sort((a, b) => {
      const ka = this.classes[a];
      const kb = this.classes[b];
      return (ka.facultyCandidates.length * ka.roomCandidates.length)
        - (kb.facultyCandidates.length * kb.roomCandidates.length)
        || kb.blocks.reduce((x, y) => x + y, 0) - ka.blocks.reduce((x, y) => x + y, 0)
        || (rand() - 0.5);
    });

    const queue = [...order];
    const unplaceable = new Set();
    let steps = 0;
    const maxSteps = n * 150;

    while (queue.length && steps++ < maxSteps) {
      const c = queue.shift();
      if (this.assign[c]) continue;
      const opt = this.bestOption(c, { allowConflicts: true, noise, rand, ejected });
      if (!opt) { unplaceable.add(c); continue; }
      for (const o of opt.conflicts) {
        this.remove(o);
        ejected[o] += 1;
        queue.push(o);
      }
      this.place(c, { f: opt.f, r: opt.r, starts: opt.starts });
    }

    const missing = this.assign.map((a, c) => (a ? -1 : c)).filter(c => c >= 0);
    return { complete: missing.length === 0, missing, unplaceable };
  }

  /** Move one class at a time while the exact objective improves. */
  improve(deadline, rand) {
    const empty = [];
    let current = this.objective();
    let improved = true;
    while (improved && Date.now() < deadline) {
      improved = false;
      const order = this.classes.map((k, i) => i).sort(() => rand() - 0.5);
      for (const c of order) {
        if (Date.now() >= deadline) break;
        const old = this.assign[c];
        this.remove(c);
        const opt = this.bestOption(c, { allowConflicts: false, rand, ejected: empty });
        if (!opt) { this.place(c, old); continue; }
        this.place(c, { f: opt.f, r: opt.r, starts: opt.starts });
        const next = this.objective();
        if (next > current + 1e-9) {
          current = next;
          improved = true;
        } else {
          this.remove(c);
          this.place(c, old);
        }
      }
    }
    return current;
  }

  solve(timeLimitSeconds) {
    const started = Date.now();
    const budgetMs = Math.max(1, Number(timeLimitSeconds) || 60) * 1000;
    const deadline = started + budgetMs;
    const rand = mulberry32(this.classes.length * 7919 + this.faculty.length);

    let best = null;
    let bestScore = -Infinity;
    let stale = 0;
    let attempt = 0;
    let lastMissing = null;

    while (Date.now() < deadline && stale < STALE_RESTARTS) {
      // The first attempt is deterministic; later ones explore around it
      const noise = attempt === 0 ? 0 : 30 + 20 * Math.min(attempt, 10);
      attempt += 1;
      const built = this.construct(rand, noise);
      if (!built.complete) {
        lastMissing = built;
        stale += 1;
        continue;
      }
      const score = this.improve(deadline, rand);
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = this.assign.map(a => ({ ...a, starts: [...a.starts] }));
        stale = 0;
      } else {
        stale += 1;
      }
    }

    const elapsed = (Date.now() - started) / 1000;
    if (best) {
      this.resetState();
      best.forEach((opt, c) => this.place(c, opt));
    }
    return {
      found: !!best,
      score: bestScore,
      elapsed,
      hitTimeLimit: Date.now() >= deadline,
      lastMissing,
    };
  }

  // ------------------------------------------------------------- solution

  extract() {
    return this.classes.map((klass, c) => {
      const opt = this.assign[c];
      const timeSlots = opt.starts.map((pos, b) => {
        const day = Math.floor(pos / this.spd);
        const slot = pos % this.spd;
        const len = klass.blocks[b];
        return {
          day: this.days[day],
          start_time: this.slots[slot].start,
          end_time: this.slots[slot + len - 1].end,
          hours: len,
          is_lab: klass.labFrom !== null && b >= klass.labFrom,
        };
      }).sort((a, b) => this.days.indexOf(a.day) - this.days.indexOf(b.day)
        || a.start_time.localeCompare(b.start_time));

      return {
        subject: klass.subject,
        section: klass.section.letter,
        section_code: klass.section.code,
        faculty: this.faculty[opt.f],
        room: this.rooms[opt.r],
        time_slots: timeSlots,
      };
    });
  }

  /**
   * Why a class was left over, in terms the user can act on. Only the load
   * case is a proof; otherwise the search ran out of options or time, and the
   * message says so rather than claiming no slot exists.
   */
  explainMissing(c) {
    const klass = this.classes[c];
    const code = klass.subject.subject_code;
    if (klass.facultyCandidates.every(f => this.loadCap[f] < klass.units)) {
      return `${code}: no teacher has ${klass.units} units of load left.`;
    }
    const kind = klass.needsLab ? 'laboratory rooms' : 'rooms';
    return `${code} (${klass.sectionKey}) could not be fitted: every time it tried clashed with `
      + `the section, a teacher, or the ${kind}. Try a longer time limit, or free up `
      + `${kind} or faculty load.`;
  }
}

function summarise(schedules, run) {
  const load = {};
  let matched = 0;
  for (const s of schedules) {
    if (!s.faculty) continue;
    load[s.faculty.name] = (load[s.faculty.name] || 0) + (parseInt(s.subject.units, 10) || 3);
    if ((s.faculty.experience || {})[String(s.subject._id)]) matched += 1;
  }
  const loads = Object.values(load);
  return {
    subjects_scheduled: schedules.length,
    solver_time: Math.round(run.elapsed * 1000) / 1000,
    objective: run.score,
    faculty_load: load,
    busiest_faculty_units: loads.length ? Math.max(...loads) : 0,
    assignments_with_experience: matched,
    hit_time_limit: run.hitTimeLimit,
  };
}

/**
 * Solve synchronously. Same input and output contract as optimize_schedule()
 * in python/ortools_scheduler.py.
 */
function solveTimetable(data) {
  try {
    const solver = new BuiltinSolver(data);
    solver.buildClasses();

    if (solver.classes.length === 0) {
      if (solver.skipped.length) {
        return {
          success: true,
          status: 'NOTHING_TO_SCHEDULE',
          schedules: [],
          skipped: solver.skipped,
          statistics: { subjects_scheduled: 0, solver_time: 0 },
          diagnostics: [
            `All ${solver.skipped.length} subject(s) already have a schedule for this section. `
            + 'Nothing left to generate.',
          ],
        };
      }
      return { success: false, status: 'NO_INPUT', schedules: null, error: 'No subjects to schedule.' };
    }

    const blockers = solver.preflight();
    if (blockers.length) {
      return { success: false, status: 'INFEASIBLE', schedules: null, error: blockers[0], blockers };
    }

    solver.prepare();
    const run = solver.solve(data.time_limit ?? 60);

    if (!run.found) {
      const reasons = (run.lastMissing?.missing || []).slice(0, 5).map(c => solver.explainMissing(c));
      return {
        success: false,
        // Not proven infeasible - the search gave up. Mirrors CP-SAT's UNKNOWN.
        status: 'UNKNOWN',
        schedules: null,
        error: `No clash-free timetable was found in ${Math.round(run.elapsed)}s. `
          + (reasons[0] || 'Common causes: too few rooms of the required type, faculty load '
          + 'limits too tight, or a shift too short for the required hours.'),
        blockers: reasons,
        diagnostics: solver.diagnostics,
        skipped: solver.skipped,
      };
    }

    const schedules = solver.extract();
    return {
      success: true,
      status: 'FEASIBLE',
      schedules,
      statistics: summarise(schedules, run),
      diagnostics: solver.diagnostics,
      skipped: solver.skipped,
    };
  } catch (err) {
    return { success: false, status: 'INFEASIBLE', schedules: null, error: err.message };
  }
}

/** Solve on a worker thread so the event loop stays responsive. */
function solveInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: data });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Built-in solver stopped with exit code ${code}.`));
    });
  });
}

if (!isMainThread && workerData && parentPort) {
  parentPort.postMessage(solveTimetable(workerData));
}

module.exports = { solveTimetable, solveInWorker, BuiltinSolver };
