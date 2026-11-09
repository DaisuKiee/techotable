/**
 * Home rooms: every active section has its own dedicated room for the term.
 *
 * Every class of a section - lectures and labs - is held in its home room:
 * both generators place them there, and every save path (manual create, edit,
 * builder bulk save, preview save) stores the home room whatever room was
 * sent. When a section's home room changes, its classes move with it. Before this, home rooms were optional, nothing stopped two
 * sections from sharing one, and creating a section dropped the room it was
 * given - so in practice no section had one.
 *
 * Rule: a room is the home room of at most one active section per term and
 * shift. A Day and a Night section may share a room; their hours only meet at
 * 4-5 PM, where the solver already treats the other section's classes as busy.
 */
const Room = require('../models/Room.model');
const Section = require('../models/Section.model');
const Schedule = require('../models/Schedule.model');

const toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + m; };

// Any active room can be a home room (a section's labs are held there too, so
// an IT section may live in a computer lab). Automatic picks prefer this order.
const PREFERRED_TYPES = ['Lecture Room', 'Conference Room', 'Computer Lab', 'Laboratory', 'Workshop', 'Auditorium'];
const typeRank = (type) => { const i = PREFERRED_TYPES.indexOf(type); return i < 0 ? PREFERRED_TYPES.length : i; };

const sameTerm = (s) => ({ academicYear: s.academicYear, semester: Number(s.semester) });

/** roomId -> section using it, for active sections of the same term and shift. */
async function takenRooms(section, { excludeId } = {}) {
  const others = await Section.find({
    ...sameTerm(section),
    shift: section.shift,
    isActive: true,
    room: { $nin: [null, ''] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('sectionCode room program yearLevel').lean();
  return new Map(others.map(o => [String(o.room), o]));
}

/**
 * Is `roomId` a valid home room for `section`? Returns { error, warning }.
 * `section` is a plain object with academicYear, semester, shift, maxStudents.
 */
async function checkHomeRoom(section, roomId, { excludeId } = {}) {
  const room = await Room.findById(roomId).lean().catch(() => null);
  if (!room) return { error: 'That room no longer exists. Pick another one.' };
  if (room.isActive === false) return { error: `${room.roomCode} is deactivated. Pick another room or restore it on the Rooms page.` };
const taken = (await takenRooms(section, { excludeId })).get(String(room._id));
  if (taken) {
    return { error: `${room.roomCode} is already the home room of ${taken.sectionCode} (${section.shift} shift). Each section needs its own room.`, code: 'HOME_ROOM_TAKEN' };
  }
  const warning = room.capacity < (section.maxStudents || 40)
    ? `${room.roomCode} seats ${room.capacity}, fewer than the section's ${section.maxStudents} students.`
    : null;
  return { room, warning };
}

/**
 * The best free room for a section: a lecture room that seats it, near the
 * rooms of the same program and year (same building, then same floor), with
 * the least spare seats so big rooms stay free for big sections.
 */
async function pickHomeRoom(section, { excludeId, reserved = new Set() } = {}) {
  const [rooms, taken, siblings] = await Promise.all([
    Room.find({ isActive: true }).lean(),
    takenRooms(section, { excludeId }),
    Section.find({ ...sameTerm(section), program: section.program, isActive: true, room: { $nin: [null, ''] } })
      .select('room yearLevel').lean(),
  ]);

  const byId = new Map(rooms.map(r => [String(r._id), r]));
  const near = siblings.map(s => ({ room: byId.get(String(s.room)), sameYear: s.yearLevel === section.yearLevel })).filter(s => s.room);
  const buildings = new Set(near.map(n => n.room.building));
  const floors = new Set(near.filter(n => n.sameYear).map(n => `${n.room.building}|${n.room.floor}`));
  const programFloors = new Set(near.map(n => `${n.room.building}|${n.room.floor}`));

  const needed = section.maxStudents || 40;
  const free = rooms.filter(r => !taken.has(String(r._id)) && !reserved.has(String(r._id)));
  if (free.length === 0) return { room: null };

  const score = (r) => [
    r.capacity >= needed ? 0 : 1,
    typeRank(r.roomType),
    floors.has(`${r.building}|${r.floor}`) ? 0 : programFloors.has(`${r.building}|${r.floor}`) ? 1 : 2,
    buildings.size === 0 || buildings.has(r.building) ? 0 : 1,
    r.capacity >= needed ? r.capacity - needed : needed - r.capacity,
  ];
  free.sort((a, b) => {
    const x = score(a); const y = score(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return String(a.roomCode).localeCompare(String(b.roomCode), undefined, { numeric: true });
  });

  const room = free[0];
  return {
    room,
    warning: room.capacity < needed ? `No free room seats ${needed}; ${room.roomCode} (${room.capacity} seats) is the largest available.` : null,
  };
}

/**
 * Give every active section without a valid home room one. * Fixes sections
 * whose room was deactivated, deleted, or is shared with another section of
 * the same shift (the later one moves).
 *
 * Each section's classes for its term are then moved into its home room.
 *
 * @returns {{ assigned: object[], unassigned: object[], kept: number, moved: number, clashes: string[] }}
 */
async function assignMissingHomeRooms({ program, academicYear, semester, sectionIds } = {}) {
  const filter = { isActive: true };
  if (program) filter.program = program;
  if (academicYear) filter.academicYear = academicYear;
  if (semester) filter.semester = Number(semester);
  if (sectionIds) filter._id = { $in: sectionIds };

  const sections = await Section.find(filter).sort({ academicYear: 1, semester: 1, shift: 1, program: 1, yearLevel: 1, sectionLetter: 1 });
  const roomIds = [...new Set(sections.map(s => s.room).filter(Boolean))];
  const rooms = new Map((await Room.find({ _id: { $in: roomIds.filter(id => /^[a-f\d]{24}$/i.test(id)) } }).lean()).map(r => [String(r._id), r]));

  const assigned = [];
  const unassigned = [];
  const clashes = [];
  let kept = 0;
  let moved = 0;
  const claimed = new Map(); // term|shift -> Set of room ids already confirmed in this run

  for (const section of sections) {
    const key = `${section.academicYear}|${section.semester}|${section.shift}`;
    if (!claimed.has(key)) claimed.set(key, new Set());
    const mine = claimed.get(key);

    const current = section.room ? rooms.get(String(section.room)) : null;
    const valid = current && current.isActive !== false && !mine.has(String(current._id));
    if (valid) {
      mine.add(String(current._id));
      kept++;
      // Classes saved somewhere else (before home rooms, or edited by hand) come home
      const { moved: n, clashes: c } = await moveSectionClasses(section);
      moved += n;
      clashes.push(...c);
      continue;
    }

    const reason = !section.room ? 'had no home room'
      : !current ? 'its room no longer exists'
        : current.isActive === false ? `${current.roomCode} is deactivated`
          : `${current.roomCode} was shared with another section`;

    // Rooms of sections not yet visited in this run still count as taken
    // through takenRooms; `mine` covers the ones confirmed above.
    const { room, warning } = await pickHomeRoom(section, { excludeId: section._id, reserved: mine });
    if (!room) {
      unassigned.push({ _id: section._id, sectionCode: section.sectionCode, reason: `${reason}, and no room is free for the ${section.shift} shift` });
      continue;
    }
    section.room = String(room._id);
    await section.save();
    mine.add(String(room._id));
    rooms.set(String(room._id), room);
    const { moved: n, clashes: c } = await moveSectionClasses(section);
    moved += n;
    clashes.push(...c);
    assigned.push({ _id: section._id, sectionCode: section.sectionCode, roomId: room._id, roomCode: room.roomCode, reason, warning, classesMoved: n });
  }

  return { assigned, unassigned, kept, moved, clashes };
}

/**
 * Returns a lookup ({ sectionCode, academicYear, semester }) -> home room id
 * (or null), cached for one request. Only an active room counts.
 */
function homeRoomResolver() {
  const cache = new Map();
  return async ({ sectionCode, academicYear, semester } = {}) => {
    if (!sectionCode) return null;
    const key = `${String(sectionCode).toUpperCase()}|${academicYear}|${semester}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const section = await Section.findOne({
          sectionCode: String(sectionCode).toUpperCase(),
          isActive: true,
          ...(academicYear ? { academicYear } : {}),
          ...(semester ? { semester: Number(semester) } : {}),
        }).select('room').lean();
        if (!section?.room) return null;
        const room = await Room.findOne({ _id: section.room, isActive: true }).select('_id').lean().catch(() => null);
        return room ? String(room._id) : null;
      })());
    }
    return cache.get(key);
  };
}

/**
 * Move a section's classes for its term into its home room. Returns how many
 * moved and any clashes the move created in that room (only possible where a
 * Day and a Night section share a room and both meet at 4-5 PM).
 */
async function moveSectionClasses(section) {
  if (!section?.room || section.isActive === false) return { moved: 0, clashes: [] };
  const room = await Room.findOne({ _id: section.room, isActive: true }).select('roomCode').lean().catch(() => null);
  if (!room) return { moved: 0, clashes: [] };

  const term = { academicYear: section.academicYear, semester: Number(section.semester) };
  const result = await Schedule.updateMany(
    { sectionCode: section.sectionCode, ...term, isActive: true, room: { $ne: String(section.room) } },
    { $set: { room: String(section.room) } }
  );

  const clashes = [];
  if (result.modifiedCount > 0) {
    const inRoom = await Schedule.find({ room: String(section.room), ...term, isActive: true })
      .select('sectionCode timeSlots').lean();
    const mine = inRoom.filter(c => c.sectionCode === section.sectionCode);
    const others = inRoom.filter(c => c.sectionCode !== section.sectionCode);
    for (const a of mine) {
      for (const b of others) {
        for (const x of a.timeSlots || []) {
          const y = (b.timeSlots || []).find(t => t.day === x.day && toMin(x.startTime) < toMin(t.endTime) && toMin(x.endTime) > toMin(t.startTime));
          if (y) clashes.push(`${room.roomCode} ${x.day} ${x.startTime}: ${section.sectionCode} and ${b.sectionCode}`);
        }
      }
    }
  }
  return { moved: result.modifiedCount, clashes: [...new Set(clashes)] };
}

/** Sections (active, any term) whose home room is `roomId`. */
const sectionsUsingRoom = (roomId) => Section.find({ room: String(roomId), isActive: true });

module.exports = {
  PREFERRED_TYPES,
  takenRooms,
  checkHomeRoom,
  pickHomeRoom,
  assignMissingHomeRooms,
  sectionsUsingRoom,
  homeRoomResolver,
  moveSectionClasses,
};
