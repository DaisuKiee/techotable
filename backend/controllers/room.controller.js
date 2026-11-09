const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const Section = require('../models/Section.model');
const { sendError } = require('../middleware/error.middleware');
const { getDefaultTerm, calendarTerm, termLabel } = require('../services/academicTerm.service');
const { looksLikeObjectId } = require('../utils/roomLabel');
const { managerProgram } = require('../utils/programScope');
const { assignMissingHomeRooms, sectionsUsingRoom } = require('../services/homeRoom.service');

/** Move the sections whose home room was `room` to another free room. */
async function rehomeSections(room) {
  const ids = (await sectionsUsingRoom(room._id)).map(s => s._id);
  if (ids.length === 0) return { assigned: [], unassigned: [] };
  return assignMissingHomeRooms({ sectionIds: ids });
}

const rehomeSummary = ({ assigned, unassigned }) => [
  assigned.length ? `Home room moved: ${assigned.map(a => `${a.sectionCode} → ${a.roomCode}`).join(', ')}.` : '',
  unassigned.length ? `${unassigned.map(u => u.sectionCode).join(', ')} ${unassigned.length === 1 ? 'has' : 'have'} no free room to move to.` : '',
].filter(Boolean).join(' ');

const { ROOM_TYPES, LAB_ROOM_TYPES, EQUIPMENT_CONDITIONS, ROOM_DAYS, MAX_CAPACITY } = Room;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE = /^[A-Z0-9][A-Z0-9 _.\-/]{0,19}$/;
const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return h * 60 + m;
};
const overlaps = (aStart, aEnd, bStart, bEnd) => toMin(aStart) < toMin(bEnd) && toMin(aEnd) > toMin(bStart);
const round1 = (n) => Math.round(n * 10) / 10;

// Mon-Sat, 7:00 AM - 10:00 PM without the 12-1 lunch break: the hours a room
// can host classes across the day and night grids.
const WEEK_HOURS = 6 * 14;

const naturalByCode = (a, b) => String(a.roomCode).localeCompare(String(b.roomCode), undefined, { numeric: true });
const sortRooms = (rooms) => rooms.sort((a, b) =>
  String(a.building || '').localeCompare(String(b.building || ''))
  || (a.floor || 0) - (b.floor || 0)
  || naturalByCode(a, b));

const sendInvalid = (res, errors) => res.status(400).json({
  success: false,
  code: 'VALIDATION_ERROR',
  message: errors.length === 1 ? errors[0].msg : `Please fix ${errors.length} fields: ${errors.map(e => e.msg).join('; ')}.`,
  errors,
});

// ------------------------------------------------------------------ terms

/** The term a request is about: ?academicYear&semester, else the user's current one. */
async function resolveTerm(req) {
  const { academicYear, semester } = req.query;
  if (academicYear && semester) return { academicYear: String(academicYear), semester: Number(semester) };
  if (req.user?.program) return getDefaultTerm(req.user.program);
  // Campus-wide staff: the newest term that has classes, else this school year
  const latest = await Schedule.findOne({ isActive: true })
    .sort({ academicYear: -1, semester: -1 }).select('academicYear semester').lean();
  return latest ? { academicYear: latest.academicYear, semester: latest.semester } : calendarTerm();
}

/** Terms that have classes, newest first, for the page's term picker. */
async function termsWithClasses() {
  const rows = await Schedule.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { academicYear: '$academicYear', semester: '$semester' }, classes: { $sum: 1 } } },
    { $sort: { '_id.academicYear': -1, '_id.semester': -1 } },
  ]);
  return rows.map(r => ({ ...r._id, classes: r.classes, label: termLabel(r._id) }));
}

const withLabel = (term) => ({ academicYear: term.academicYear, semester: term.semester, label: termLabel(term) });

// ------------------------------------------------------------------ usage

/**
 * `Schedule.room` stores a Room id in a String (older rows hold the room code),
 * so match on both.
 */
const roomKeys = (room) => [String(room._id), room.roomCode].filter(Boolean);

const resolveRoomId = (raw, byCode) => {
  const value = String(raw || '');
  if (looksLikeObjectId(value)) return value;
  return byCode.get(value.toUpperCase()) || null;
};

async function usageByRoom(rooms, term) {
  const byCode = new Map(rooms.map(r => [String(r.roomCode).toUpperCase(), String(r._id)]));
  const [rows, sections] = await Promise.all([
    Schedule.find({ academicYear: term.academicYear, semester: term.semester, isActive: true })
      .select('room timeSlots sectionCode program maxStudents').lean(),
    Section.find({
      room: { $in: rooms.map(r => String(r._id)) },
      academicYear: term.academicYear,
      semester: term.semester,
      isActive: true,
    }).select('room sectionCode').lean(),
  ]);

  const usage = new Map();
  const entry = (id) => {
    if (!usage.has(id)) usage.set(id, { classes: 0, minutes: 0, sections: new Set(), programs: new Set(), byDay: {}, largestClass: 0, homeSections: [] });
    return usage.get(id);
  };

  for (const row of rows) {
    const id = resolveRoomId(row.room, byCode);
    if (!id) continue;
    const u = entry(id);
    u.classes += 1;
    if (row.sectionCode) u.sections.add(row.sectionCode);
    if (row.program) u.programs.add(row.program);
    u.largestClass = Math.max(u.largestClass, row.maxStudents || 0);
    for (const slot of row.timeSlots || []) {
      const minutes = Math.max(0, toMin(slot.endTime) - toMin(slot.startTime));
      u.minutes += minutes;
      u.byDay[slot.day] = (u.byDay[slot.day] || 0) + minutes;
    }
  }
  for (const s of sections) entry(String(s.room)).homeSections.push(s.sectionCode);

  return usage;
}

const summarize = (u, room) => {
  if (!u) return { classes: 0, hours: 0, utilization: 0, sections: [], programs: [], homeSections: [], busiestDay: null, largestClass: 0, overCapacity: false };
  const busiest = Object.entries(u.byDay).sort((a, b) => b[1] - a[1])[0];
  return {
    classes: u.classes,
    hours: round1(u.minutes / 60),
    utilization: Math.min(100, Math.round((u.minutes / 60 / WEEK_HOURS) * 100)),
    sections: [...u.sections].sort(),
    programs: [...u.programs].sort(),
    homeSections: u.homeSections.sort(),
    busiestDay: busiest ? { day: busiest[0], hours: round1(busiest[1] / 60) } : null,
    largestClass: u.largestClass,
    overCapacity: u.largestClass > (room.capacity || 0),
  };
};

// ------------------------------------------------------------------ input

/**
 * Validate and normalise room fields. `partial` (updates) only checks what was
 * sent. Returns { data, errors } with errors in express-validator's shape.
 */
function cleanRoomInput(body = {}, { partial = false } = {}) {
  const data = {};
  const errors = [];
  const bad = (path, msg) => errors.push({ path, msg });
  const sent = (key) => body[key] !== undefined;

  if (!partial || sent('roomCode')) {
    const code = String(body.roomCode || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!code) bad('roomCode', 'Room code is required');
    else if (!CODE.test(code)) bad('roomCode', 'Room code can use letters, numbers, spaces, dashes, dots or slashes (20 characters max)');
    else data.roomCode = code;
  }

  if (sent('roomName')) {
    const name = String(body.roomName || '').trim();
    if (name.length > 80) bad('roomName', 'Room name is too long (80 characters max)');
    else data.roomName = name;
  }

  if (!partial || sent('building')) {
    const building = String(body.building || '').trim().replace(/\s+/g, ' ');
    if (!building) bad('building', 'Building is required');
    else if (building.length > 60) bad('building', 'Building name is too long (60 characters max)');
    else data.building = building;
  }

  if (!partial || sent('floor')) {
    const floor = body.floor === undefined || body.floor === '' ? 1 : Number(body.floor);
    if (!Number.isInteger(floor) || floor < 1 || floor > 30) bad('floor', 'Floor must be a whole number from 1 to 30');
    else data.floor = floor;
  }

  if (!partial || sent('roomType')) {
    if (!ROOM_TYPES.includes(body.roomType)) bad('roomType', `Room type must be one of: ${ROOM_TYPES.join(', ')}`);
    else data.roomType = body.roomType;
  }

  if (!partial || sent('capacity')) {
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) bad('capacity', `Capacity must be a whole number from 1 to ${MAX_CAPACITY}`);
    else data.capacity = capacity;
  }

  if (sent('facilities')) {
    if (!Array.isArray(body.facilities)) bad('facilities', 'Features must be a list');
    else {
      const seen = new Set();
      data.facilities = [];
      for (const raw of body.facilities) {
        const name = String(raw || '').trim().replace(/\s+/g, ' ');
        if (!name || seen.has(name.toLowerCase())) continue;
        if (name.length > 40) { bad('facilities', `Feature "${name.slice(0, 20)}…" is too long (40 characters max)`); break; }
        seen.add(name.toLowerCase());
        data.facilities.push(name);
      }
      if (data.facilities.length > 25) bad('facilities', 'A room can list at most 25 features');
    }
  }

  if (sent('equipment')) {
    if (!Array.isArray(body.equipment)) bad('equipment', 'Equipment must be a list');
    else {
      data.equipment = [];
      body.equipment.forEach((item, i) => {
        const name = String((typeof item === 'string' ? item : item?.name) || '').trim();
        if (!name) return; // blank rows from the form
        const quantity = item?.quantity === undefined ? 1 : Number(item.quantity);
        const condition = item?.condition || 'Good';
        if (name.length > 60) bad(`equipment[${i}]`, `Equipment "${name.slice(0, 20)}…" has too long a name`);
        else if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) bad(`equipment[${i}]`, `Quantity for ${name} must be from 1 to 999`);
        else if (!EQUIPMENT_CONDITIONS.includes(condition)) bad(`equipment[${i}]`, `Condition for ${name} must be one of: ${EQUIPMENT_CONDITIONS.join(', ')}`);
        else data.equipment.push({ name, quantity, condition });
      });
    }
  }

  if (sent('unavailableTimeSlots')) {
    if (!Array.isArray(body.unavailableTimeSlots)) bad('unavailableTimeSlots', 'Blocked times must be a list');
    else {
      const slots = [];
      body.unavailableTimeSlots.forEach((slot, i) => {
        const where = `Blocked time ${i + 1}`;
        if (!ROOM_DAYS.includes(slot?.day)) return bad(`unavailableTimeSlots[${i}]`, `${where}: pick a day from Monday to Saturday`);
        if (!HHMM.test(slot.startTime || '') || !HHMM.test(slot.endTime || '')) return bad(`unavailableTimeSlots[${i}]`, `${where}: times must be HH:MM`);
        if (toMin(slot.endTime) <= toMin(slot.startTime)) return bad(`unavailableTimeSlots[${i}]`, `${where}: the end time must be after the start time`);
        const reason = String(slot.reason || '').trim();
        if (reason.length > 120) return bad(`unavailableTimeSlots[${i}]`, `${where}: the reason is too long (120 characters max)`);
        slots.push({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, reason });
      });
      for (let a = 0; a < slots.length; a++) {
        for (let b = a + 1; b < slots.length; b++) {
          const x = slots[a]; const y = slots[b];
          if (x.day === y.day && overlaps(x.startTime, x.endTime, y.startTime, y.endTime)) {
            bad('unavailableTimeSlots', `Blocked times on ${x.day} overlap (${x.startTime}–${x.endTime} and ${y.startTime}–${y.endTime}); merge them into one`);
          }
        }
      }
      slots.sort((x, y) => ROOM_DAYS.indexOf(x.day) - ROOM_DAYS.indexOf(y.day) || toMin(x.startTime) - toMin(y.startTime));
      data.unavailableTimeSlots = slots;
    }
  }

  if (sent('notes')) {
    const notes = String(body.notes || '').trim();
    if (notes.length > 500) bad('notes', 'Notes are too long (500 characters max)');
    else data.notes = notes;
  }

  return { data, errors };
}

const codeTaken = (roomCode, exceptId) => Room.findOne({
  roomCode,
  ...(exceptId ? { _id: { $ne: exceptId } } : {}),
}).select('roomCode isActive').lean();

const takenMessage = (other) => (other.isActive
  ? `Room ${other.roomCode} already exists`
  : `Room ${other.roomCode} already exists but is deactivated. Restore it instead of adding it again.`);

/** Classes this term that a change to the room would clash with. */
async function changeWarnings(room, term) {
  const rows = await Schedule.find({
    room: { $in: roomKeys(room) },
    academicYear: term.academicYear,
    semester: term.semester,
    isActive: true,
  }).populate('subject', 'subjectCode labHours').select('sectionCode maxStudents timeSlots subject').lean();

  const warnings = [];
  const crowded = rows.filter(r => (r.maxStudents || 0) > room.capacity);
  if (crowded.length) {
    warnings.push(`${crowded.length} class${crowded.length === 1 ? '' : 'es'} this term ${crowded.length === 1 ? 'has' : 'have'} more students than the new capacity of ${room.capacity}: `
      + crowded.slice(0, 4).map(r => `${r.sectionCode} (${r.maxStudents})`).join(', ') + (crowded.length > 4 ? ', …' : ''));
  }
  if (!LAB_ROOM_TYPES.includes(room.roomType)) {
    // A section's labs are held in its home room on purpose; only flag the rest
    const homeOf = new Set((await Section.find({ room: String(room._id), ...term, isActive: true }).select('sectionCode').lean()).map(s => s.sectionCode));
    const labs = rows.filter(r => (r.subject?.labHours || 0) > 0 && !homeOf.has(r.sectionCode));
    if (labs.length) {
      warnings.push(`${labs.length} lab class${labs.length === 1 ? ' is' : 'es are'} booked here, but a ${room.roomType} isn't a lab room: `
        + labs.slice(0, 4).map(r => `${r.sectionCode} ${r.subject.subjectCode}`).join(', '));
    }
  }
  const blocked = [];
  for (const window of room.unavailableTimeSlots || []) {
    for (const r of rows) {
      if ((r.timeSlots || []).some(s => s.day === window.day && overlaps(s.startTime, s.endTime, window.startTime, window.endTime))) {
        blocked.push(`${r.sectionCode} ${r.subject?.subjectCode || ''} on ${window.day}`.trim());
      }
    }
  }
  if (blocked.length) {
    warnings.push(`Classes already meet during the new blocked times: ${[...new Set(blocked)].slice(0, 4).join(', ')}. Move them on the Schedules page.`);
  }
  return warnings;
}

// ------------------------------------------------------------------ reads

// @desc    Get rooms (?status=active|inactive|all, ?includeUsage=true for term usage)
// @route   GET /api/rooms
// @access  Private
exports.getAllRooms = async (req, res) => {
  try {
    const { building, roomType, isActive, status, search, minCapacity, maxCapacity, includeUsage } = req.query;

    const query = {};
    if (building) query.building = building;
    if (roomType) query.roomType = roomType;
    if (status === 'active') query.isActive = true;
    else if (status === 'inactive') query.isActive = false;
    else if (status !== 'all' && isActive !== undefined) query.isActive = isActive === 'true';

    if (minCapacity || maxCapacity) {
      query.capacity = {};
      if (minCapacity) query.capacity.$gte = parseInt(minCapacity, 10);
      if (maxCapacity) query.capacity.$lte = parseInt(maxCapacity, 10);
    }
    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { roomCode: { $regex: safe, $options: 'i' } },
        { roomName: { $regex: safe, $options: 'i' } },
        { building: { $regex: safe, $options: 'i' } },
      ];
    }

    const rooms = sortRooms(await Room.find(query).lean());
    const body = { success: true, count: rooms.length, data: rooms };

    if (includeUsage === 'true') {
      const term = await resolveTerm(req);
      const [usage, terms] = await Promise.all([usageByRoom(rooms, term), termsWithClasses()]);
      rooms.forEach(r => { r.usage = summarize(usage.get(String(r._id)), r); });
      body.term = withLabel(term);
      body.terms = terms;
      body.weekHours = WEEK_HOURS;
    }

    res.status(200).json(body);
  } catch (error) {
    sendError(res, error, 'Error fetching rooms');
  }
};

// @desc    Get room by ID
// @route   GET /api/rooms/:id
// @access  Private
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    sendError(res, error, 'Error fetching room');
  }
};

// @desc    A room's week: its classes, blocked times and home-room sections for a term
// @route   GET /api/rooms/:id/schedule
// @access  Private
exports.getRoomSchedule = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const term = await resolveTerm(req);
    const [rows, homeSections, terms, usage] = await Promise.all([
      Schedule.find({
        room: { $in: roomKeys(room) },
        academicYear: term.academicYear,
        semester: term.semester,
        isActive: true,
      })
        .populate('subject', 'subjectCode subjectName labHours')
        .populate({ path: 'faculty', select: 'employeeId', populate: { path: 'user', select: 'firstName lastName' } })
        .select('sectionCode program yearLevel shift timeSlots maxStudents enrolledStudents status subject faculty')
        .lean(),
      Section.find({ room: String(room._id), academicYear: term.academicYear, semester: term.semester, isActive: true })
        .select('sectionCode program yearLevel shift maxStudents').lean(),
      termsWithClasses(),
      usageByRoom([room], term),
    ]);

    // Program managers see that a slot is taken by another program, not whose class it is
    const own = managerProgram(req);
    const classes = rows.map((row) => {
      const mine = !own || String(row.program || '').toUpperCase() === own.toUpperCase();
      const teacher = row.faculty?.user ? `${row.faculty.user.firstName} ${row.faculty.user.lastName}` : null;
      return mine ? {
        _id: row._id,
        subjectCode: row.subject?.subjectCode || '—',
        subjectName: row.subject?.subjectName || '',
        isLab: (row.subject?.labHours || 0) > 0,
        sectionCode: row.sectionCode,
        program: row.program,
        yearLevel: row.yearLevel,
        shift: row.shift,
        faculty: teacher,
        maxStudents: row.maxStudents,
        enrolledStudents: row.enrolledStudents,
        status: row.status,
        overCapacity: (row.maxStudents || 0) > room.capacity,
        timeSlots: row.timeSlots,
      } : {
        _id: row._id,
        hidden: true,
        program: row.program,
        subjectCode: 'Booked',
        sectionCode: `${row.program || 'Another'} program`,
        timeSlots: row.timeSlots,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        room,
        term: withLabel(term),
        terms,
        classes,
        homeSections,
        usage: summarize(usage.get(String(room._id)), room),
        weekHours: WEEK_HOURS,
      },
    });
  } catch (error) {
    sendError(res, error, 'Error fetching the room schedule');
  }
};

// @desc    Rooms free for a time: ?day&startTime&endTime[&minCapacity&roomType&labOnly]
// @route   GET /api/rooms/available
// @access  Private
exports.findFreeRooms = async (req, res) => {
  try {
    const { day, startTime, endTime, minCapacity, roomType, labOnly } = req.query;
    if (!ROOM_DAYS.includes(day)) return res.status(400).json({ success: false, message: 'Pick a day from Monday to Saturday' });
    if (!HHMM.test(startTime || '') || !HHMM.test(endTime || '')) return res.status(400).json({ success: false, message: 'Times must be HH:MM' });
    if (toMin(endTime) <= toMin(startTime)) return res.status(400).json({ success: false, message: 'The end time must be after the start time' });

    const query = { isActive: true };
    if (roomType) query.roomType = roomType;
    else if (labOnly === 'true') query.roomType = { $in: LAB_ROOM_TYPES };
    const needed = parseInt(minCapacity, 10) || 0;
    if (needed > 0) query.capacity = { $gte: needed };

    const term = await resolveTerm(req);
    const rooms = await Room.find(query).lean();
    const byCode = new Map(rooms.map(r => [String(r.roomCode).toUpperCase(), String(r._id)]));
    const bookings = await Schedule.find({
      academicYear: term.academicYear,
      semester: term.semester,
      isActive: true,
      timeSlots: { $elemMatch: { day } },
    }).populate('subject', 'subjectCode').select('room timeSlots sectionCode program subject').lean();

    const own = managerProgram(req);
    const taken = new Map();
    for (const row of bookings) {
      const id = resolveRoomId(row.room, byCode);
      if (!id) continue;
      const clash = (row.timeSlots || []).find(s => s.day === day && overlaps(s.startTime, s.endTime, startTime, endTime));
      if (!clash) continue;
      const mine = !own || String(row.program || '').toUpperCase() === own.toUpperCase();
      taken.set(id, mine
        ? `${row.sectionCode} ${row.subject?.subjectCode || ''} ${clash.startTime}–${clash.endTime}`.replace(/\s+/g, ' ').trim()
        : `Booked by ${row.program || 'another program'} ${clash.startTime}–${clash.endTime}`);
    }

    const free = [];
    const unavailable = [];
    for (const room of rooms) {
      const block = (room.unavailableTimeSlots || []).find(s => s.day === day && overlaps(s.startTime, s.endTime, startTime, endTime));
      const reason = taken.get(String(room._id))
        || (block && `Blocked ${block.startTime}–${block.endTime}${block.reason ? ` (${block.reason})` : ''}`);
      if (reason) unavailable.push({ _id: room._id, roomCode: room.roomCode, building: room.building, capacity: room.capacity, reason });
      else free.push(room);
    }
    // Tightest fit first, so big rooms stay open for big classes
    free.sort((a, b) => a.capacity - b.capacity || naturalByCode(a, b));
    unavailable.sort(naturalByCode);

    res.status(200).json({ success: true, count: free.length, data: free, unavailable, term: withLabel(term) });
  } catch (error) {
    sendError(res, error, 'Error finding free rooms');
  }
};

// @desc    Get rooms by type
// @route   GET /api/rooms/type/:roomType
// @access  Private
exports.getRoomsByType = async (req, res) => {
  try {
    const rooms = await Room.find({ roomType: req.params.roomType, isActive: true }).sort({ capacity: -1 });
    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    sendError(res, error, 'Error fetching rooms');
  }
};

// @desc    Active rooms that seat at least :capacity
// @route   GET /api/rooms/available/:capacity
// @access  Private
exports.getAvailableRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      capacity: { $gte: parseInt(req.params.capacity, 10) || 0 },
      isActive: true
    }).sort({ capacity: 1 });
    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    sendError(res, error, 'Error fetching available rooms');
  }
};

// @desc    Get room statistics
// @route   GET /api/rooms/stats
// @access  Private
exports.getRoomStats = async (req, res) => {
  try {
    const [stats, totalStats] = await Promise.all([
      Room.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$roomType', count: { $sum: 1 }, totalCapacity: { $sum: '$capacity' }, avgCapacity: { $avg: '$capacity' } } },
        { $sort: { _id: 1 } },
      ]),
      Room.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalRooms: { $sum: 1 },
            totalCapacity: { $sum: '$capacity' },
            avgCapacity: { $avg: '$capacity' },
            withProjector: { $sum: { $cond: ['$hasProjector', 1, 0] } },
            withAircon: { $sum: { $cond: ['$isAirconditioned', 1, 0] } },
          },
        },
      ]),
    ]);
    res.status(200).json({ success: true, data: { byType: stats, overall: totalStats[0] || {} } });
  } catch (error) {
    sendError(res, error, 'Error fetching room statistics');
  }
};

// @desc    What depends on a room: active classes by term, home-room sections
// @route   GET /api/rooms/:id/impact
// @access  Private/Admin
async function impactOf(room) {
  const keys = roomKeys(room);
  const [byTerm, homeSections, everUsed] = await Promise.all([
    Schedule.aggregate([
      { $match: { room: { $in: keys }, isActive: true } },
      { $group: { _id: { academicYear: '$academicYear', semester: '$semester' }, classes: { $sum: 1 } } },
      { $sort: { '_id.academicYear': -1, '_id.semester': -1 } },
    ]),
    Section.find({ room: String(room._id), isActive: true }).select('sectionCode academicYear semester').lean(),
    Schedule.exists({ room: { $in: keys } }),
  ]);
  const terms = byTerm.map(t => ({ ...t._id, classes: t.classes, label: termLabel(t._id) }));
  return {
    classes: terms.reduce((sum, t) => sum + t.classes, 0),
    terms,
    homeSections: homeSections.map(s => s.sectionCode).sort(),
    // Never used by any class, so it can be removed for good (e.g. a typo)
    canDeletePermanently: !everUsed && homeSections.length === 0,
  };
}

exports.getRoomImpact = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.status(200).json({ success: true, data: await impactOf(room) });
  } catch (error) {
    sendError(res, error, 'Error checking the room');
  }
};

// ------------------------------------------------------------------ writes

// @desc    Create new room
// @route   POST /api/rooms
// @access  Private/Admin
exports.createRoom = async (req, res) => {
  try {
    const { data, errors } = cleanRoomInput(req.body);
    if (errors.length) return sendInvalid(res, errors);

    const other = await codeTaken(data.roomCode);
    if (other) return res.status(409).json({ success: false, code: 'ROOM_EXISTS', message: takenMessage(other), roomId: other._id });

    const room = await Room.create({ facilities: [], equipment: [], unavailableTimeSlots: [], ...data });
    res.status(201).json({ success: true, message: `Room ${room.roomCode} added`, data: room });
  } catch (error) {
    sendError(res, error, 'Error creating room');
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const { data, errors } = cleanRoomInput(req.body, { partial: true });
    if (errors.length) return sendInvalid(res, errors);

    const oldCode = room.roomCode;
    if (data.roomCode && data.roomCode !== oldCode) {
      const other = await codeTaken(data.roomCode, room._id);
      if (other) return res.status(409).json({ success: false, code: 'ROOM_EXISTS', message: takenMessage(other) });
    }

    // Activation goes through deactivate/restore, which check what uses the room
    Object.assign(room, data);
    await room.save();

    // Older classes stored the room code instead of the id; keep them attached
    if (data.roomCode && data.roomCode !== oldCode) {
      await Schedule.updateMany({ room: oldCode }, { $set: { room: String(room._id) } });
    }

    const warnings = room.isActive ? await changeWarnings(room, await resolveTerm(req)) : [];
res.status(200).json({ success: true, message: `Room ${room.roomCode} saved`, data: room, warnings });
  } catch (error) {
    sendError(res, error, 'Error updating room');
  }
};

// @desc    Deactivate a room (?force=true when classes use it), or remove an unused one (?permanent=true)
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const impact = await impactOf(room);

    if (req.query.permanent === 'true') {
      if (!impact.canDeletePermanently) {
        return res.status(409).json({
          success: false,
          code: 'ROOM_HAS_HISTORY',
          message: `${room.roomCode} has classes on record, so it can only be deactivated. That keeps past timetables intact.`,
          impact,
        });
      }
      await room.deleteOne();
      return res.status(200).json({ success: true, message: `Room ${room.roomCode} deleted` });
    }

    if (!room.isActive) return res.status(200).json({ success: true, message: `Room ${room.roomCode} is already deactivated`, data: room });

    if ((impact.classes > 0 || impact.homeSections.length > 0) && req.query.force !== 'true') {
      return res.status(409).json({
        success: false,
        code: 'ROOM_IN_USE',
        message: `${room.roomCode} is still used by ${impact.classes} class${impact.classes === 1 ? '' : 'es'}`
          + (impact.homeSections.length ? ` and is the home room of ${impact.homeSections.join(', ')} (they'll be moved to another free room)` : '')
          + '. Confirm to deactivate it anyway.',
        impact,
      });
    }

    room.isActive = false;
    room.deactivatedAt = new Date();
    room.deactivationReason = String(req.body?.reason || req.query.reason || '').trim().slice(0, 200) || undefined;
    await room.save();

    // Its sections need another dedicated room
    const rehomed = await rehomeSections(room);
    const moved = rehomeSummary(rehomed);

    res.status(200).json({
      success: true,
      message: `Room ${room.roomCode} deactivated. New timetables won't use it.${moved ? ` ${moved}` : ''}`,
      data: room,
      impact,
      rehomed,
    });
  } catch (error) {
    sendError(res, error, 'Error deactivating room');
  }
};

// @desc    Put a deactivated room back into use
// @route   PATCH /api/rooms/:id/restore
// @access  Private/Admin
exports.restoreRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    room.isActive = true;
    room.deactivatedAt = undefined;
    room.deactivationReason = undefined;
    await room.save();
    res.status(200).json({ success: true, message: `Room ${room.roomCode} restored`, data: room });
  } catch (error) {
    sendError(res, error, 'Error restoring room');
  }
};

exports.cleanRoomInput = cleanRoomInput;
