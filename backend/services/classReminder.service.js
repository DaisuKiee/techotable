/**
 * Class reminders for faculty (Settings > Notifications > Class reminders).
 *
 * Checked every minute, in Philippine time:
 *  - from 6 AM, each teacher with a published class today gets one
 *    "Your classes today" notice listing them;
 *  - 15 minutes before each class, a "starts in N min" notice with the
 *    section and room.
 *
 * Both go through `notify`, so they are saved, shown in the bell and pushed to
 * any open tab (which turns them into a desktop notification when the browser
 * allows it). Each carries a `dedupeKey`, so a restart or a second server
 * never sends the same reminder twice.
 */

const Schedule = require('../models/Schedule.model');
const Faculty = require('../models/Faculty.model');
require('../models/Subject.model'); // for populate('subject')
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const { notify } = require('./inAppNotification.service');
const { loadRoomsByRawValues, labelFor, looksLikeObjectId } = require('../utils/roomLabel');

const TIMEZONE = 'Asia/Manila';
const CHECK_EVERY = 60 * 1000;
const DAY_SUMMARY_FROM = 6 * 60;  // 6:00 AM
const REMIND_BEFORE = 15;         // minutes
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Today's date, weekday and minutes since midnight in Manila. */
const manilaNow = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long',
    }).formatToParts(now).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: parts.weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

/** 13:30 -> 1:30 PM */
const fmtTime = (t) => {
  const m = toMin(t);
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'es'}`;

/**
 * Every published meeting today, grouped by the teacher's user id:
 * Map<userId, [{ scheduleId, code, name, section, room, start, end }]>
 */
const todaysMeetings = async (day) => {
  const schedules = await Schedule.find({
    status: 'published',
    isActive: true,
    faculty: { $ne: null },
    'timeSlots.day': day,
  })
    .select('faculty subject sectionCode room timeSlots')
    .populate('subject', 'subjectCode subjectName')
    .lean();
  if (!schedules.length) return new Map();

  const facultyIds = [...new Set(schedules.map((s) => String(s.faculty)))];
  const faculty = await Faculty.find({ _id: { $in: facultyIds } }).select('user').lean();
  const userOf = new Map(faculty.filter((f) => f.user).map((f) => [String(f._id), String(f.user)]));

  // Only active faculty accounts
  const active = await User.find({ _id: { $in: [...userOf.values()] }, isActive: { $ne: false }, role: 'faculty' })
    .select('_id').lean();
  const activeIds = new Set(active.map((u) => String(u._id)));

  const rooms = await loadRoomsByRawValues(schedules.map((s) => s.room).filter(Boolean).map(String));

  const byUser = new Map();
  schedules.forEach((s) => {
    const userId = userOf.get(String(s.faculty));
    if (!userId || !activeIds.has(userId)) return;
    const roomRaw = s.room ? String(s.room) : null;
    const room = roomRaw ? (looksLikeObjectId(roomRaw) ? labelFor(rooms.get(roomRaw)) : roomRaw) : null;
    (s.timeSlots || []).filter((t) => t.day === day).forEach((t) => {
      if (!byUser.has(userId)) byUser.set(userId, []);
      byUser.get(userId).push({
        scheduleId: String(s._id),
        code: s.subject?.subjectCode || 'Class',
        name: s.subject?.subjectName || '',
        section: s.sectionCode || '',
        room,
        start: t.startTime,
        end: t.endTime,
      });
    });
  });
  byUser.forEach((list) => list.sort((a, b) => toMin(a.start) - toMin(b.start)));
  return byUser;
};

/* Keys already handled today, so most ticks don't touch the database. */
let memo = { date: null, keys: new Set() };
const seen = (date) => {
  if (memo.date !== date) memo = { date, keys: new Set() };
  return memo.keys;
};

/** Send each [userId, key, data] whose key hasn't gone out yet. Returns how many were sent. */
const sendOnce = async (date, pending) => {
  const keys = seen(date);
  const todo = pending.filter(([userId, key]) => !keys.has(`${userId}|${key}`));
  if (!todo.length) return 0;

  const already = await Notification.find({
    recipient: { $in: [...new Set(todo.map(([u]) => u))] },
    dedupeKey: { $in: [...new Set(todo.map(([, k]) => k))] },
  }).select('recipient dedupeKey').lean();
  already.forEach((n) => keys.add(`${n.recipient}|${n.dedupeKey}`));

  let sent = 0;
  for (const [userId, key, data] of todo) {
    if (keys.has(`${userId}|${key}`)) continue;
    keys.add(`${userId}|${key}`);
    // eslint-disable-next-line no-await-in-loop
    const res = await notify(userId, { ...data, dedupeKey: key, preference: 'classReminders' });
    sent += res.count || 0;
  }
  return sent;
};

const describe = (m) => [m.section, m.room ? `Room ${m.room}` : null].filter(Boolean).join(' · ');

/** One pass: morning summaries and upcoming-class reminders. */
const checkReminders = async (now = new Date()) => {
  const { date, day, minutes } = manilaNow(now);
  if (!DAYS.includes(day)) return 0;
  const byUser = await todaysMeetings(day);
  const pending = [];

  byUser.forEach((meetings, userId) => {
    // Morning summary: only while there's still something left to teach
    const left = meetings.filter((m) => toMin(m.end) > minutes);
    if (minutes >= DAY_SUMMARY_FROM && left.length) {
      const list = meetings.map((m) => `${fmtTime(m.start)} ${m.code}${m.section ? ` (${m.section})` : ''}`).join(' · ');
      pending.push([userId, `today:${date}`, {
        type: 'schedule',
        title: `You have ${plural(meetings.length, 'class')} today`,
        message: list,
        link: '/dashboard',
        metadata: {
          kind: 'today_classes',
          changes: meetings.map((m) => `${fmtTime(m.start)} – ${fmtTime(m.end)} · ${m.code}${describe(m) ? ` · ${describe(m)}` : ''}`),
        },
      }]);
    }

    // Heads-up shortly before each class
    meetings.forEach((m) => {
      const until = toMin(m.start) - minutes;
      if (until <= 0 || until > REMIND_BEFORE) return;
      pending.push([userId, `class:${m.scheduleId}:${date}:${m.start}`, {
        type: 'schedule',
        title: `${m.code} starts in ${until} min`,
        message: [m.name, describe(m), `${fmtTime(m.start)} – ${fmtTime(m.end)}`].filter(Boolean).join(' · '),
        link: '/dashboard',
        relatedResource: { resourceType: 'Schedule', resourceId: m.scheduleId },
        metadata: { kind: 'class_reminder', subjectCode: m.code, sectionCode: m.section },
      }]);
    });
  });

  return sendOnce(date, pending);
};

let timer = null;
let running = false;

const startReminderWatcher = () => {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    checkReminders()
      .then((n) => { if (n) console.log(`⏰ Sent ${n} class reminder(s)`); })
      .catch((e) => console.error('Class reminders failed:', e.message))
      .finally(() => { running = false; });
  };
  timer = setInterval(tick, CHECK_EVERY);
  timer.unref?.();
  setTimeout(tick, 15 * 1000).unref?.();
};

module.exports = { startReminderWatcher, checkReminders, manilaNow };
