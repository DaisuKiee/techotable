/**
 * Shared helpers for the Class Spaces screens: colour per subject, meeting
 * time maths (what's on now / next) and file-type labels.
 */

/* Each subject gets one accent, picked by hashing its code so it stays the
   same everywhere. Inline hex rather than Tailwind classes so the colour can
   be computed at runtime; the tints use alpha so they work in dark mode too. */
export const ACCENTS = [
  { hex: '#0f766e', name: 'teal' },
  { hex: '#4f46e5', name: 'indigo' },
  { hex: '#be185d', name: 'rose' },
  { hex: '#b45309', name: 'amber' },
  { hex: '#047857', name: 'emerald' },
  { hex: '#7c3aed', name: 'violet' },
  { hex: '#0369a1', name: 'sky' },
  { hex: '#c2410c', name: 'orange' },
];

const hash = (key) => {
  let h = 0;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

export const accentFor = (key) => ACCENTS[hash(key) % ACCENTS.length].hex;

/** `#rrggbb` + alpha (0-1) as an rgba() string. */
export const tint = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/* ---- People ------------------------------------------------------------ */

export const subjectCodeOf = (cs) => cs?.subject?.subjectCode || cs?.sectionCode || 'Class';
export const subjectNameOf = (cs) => cs?.subject?.subjectName || '';
export const facultyNameOf = (cs) => {
  const u = cs?.faculty?.user;
  return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || null : null;
};
export const timeSlotsOf = (cs) => cs?.schedule?.timeSlots || [];
export const roomOf = (cs) => cs?.schedule?.roomLabel || null;

export const initialsOf = (name) =>
  (name || '').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

/** Full URL for a profile picture stored as a server-relative path. */
export const avatarSrc = (path) =>
  path ? `${process.env.REACT_APP_API_URL?.replace('/api', '')}${path}` : null;

/* ---- Time -------------------------------------------------------------- */

export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_DAYS = ['Sunday', ...WEEK];

export const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

/** 13:30 -> 1:30 PM */
export const fmtTime = (t) => {
  const m = toMin(t);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
};
export const fmtRange = (s) => `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`;

export const todayName = (now = new Date()) => ALL_DAYS[now.getDay()];

/** "in 25 min", "in 2 h 5 min" */
export const fmtIn = (mins) => {
  if (mins < 1) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
};

/**
 * Where this class stands right now: in session, later today, or the next
 * meeting on a later day. Returns null when it has no meeting times.
 */
export const nextMeeting = (slots, now = new Date()) => {
  if (!slots?.length) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let ahead = 0; ahead < 7; ahead++) {
    const day = ALL_DAYS[(now.getDay() + ahead) % 7];
    const today = slots
      .filter((s) => s.day === day)
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    for (const s of today) {
      const start = toMin(s.startTime);
      const end = toMin(s.endTime);
      if (ahead === 0 && end <= nowMin) continue;
      if (ahead === 0 && start <= nowMin) {
        return { slot: s, state: 'live', minsLeft: end - nowMin, ahead };
      }
      return {
        slot: s,
        state: ahead === 0 ? 'today' : 'later',
        minsUntil: ahead === 0 ? start - nowMin : null,
        ahead,
      };
    }
  }
  return null;
};

export const describeNext = (next, compact = false) => {
  if (!next) return null;
  if (next.state === 'live') return compact ? 'In session now' : `In session · ${next.minsLeft} min left`;
  if (next.state === 'today') {
    if (compact) return next.minsUntil < 60 ? `Starts ${fmtIn(next.minsUntil)}` : `Today ${fmtTime(next.slot.startTime)}`;
    return `Today ${fmtTime(next.slot.startTime)} · ${fmtIn(next.minsUntil)}`;
  }
  if (next.ahead === 1) return `Tomorrow ${fmtTime(next.slot.startTime)}`;
  return `${next.slot.day.slice(0, 3)} ${fmtTime(next.slot.startTime)}`;
};

/** Weekly contact hours across every meeting. */
export const weeklyHours = (slots) =>
  Math.round((slots || []).reduce((sum, s) => sum + (toMin(s.endTime) - toMin(s.startTime)), 0) / 6) / 10;

/** "Today", "Yesterday", "Mon, Oct 12" */
export const dayLabel = (date) => {
  const d = new Date(date);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
};

export const timeAgo = (date) => {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/* ---- Files ------------------------------------------------------------- */

const FILE_KINDS = [
  { kind: 'PDF', match: /\.pdf$/i, hex: '#dc2626' },
  { kind: 'DOC', match: /\.(docx?|odt|rtf|txt)$/i, hex: '#2563eb' },
  { kind: 'PPT', match: /\.(pptx?|odp|key)$/i, hex: '#ea580c' },
  { kind: 'XLS', match: /\.(xlsx?|csv|ods)$/i, hex: '#16a34a' },
  { kind: 'IMG', match: /\.(png|jpe?g|gif|webp|svg|bmp)$/i, hex: '#9333ea' },
  { kind: 'ZIP', match: /\.(zip|rar|7z|tar|gz)$/i, hex: '#64748b' },
  { kind: 'VID', match: /\.(mp4|mov|avi|mkv|webm)$/i, hex: '#db2777' },
];

export const fileKind = (material) => {
  const name = material?.fileName || material?.fileUrl || '';
  return FILE_KINDS.find((k) => k.match.test(name)) || { kind: 'FILE', hex: '#475569' };
};
export const FILE_KIND_NAMES = ['PDF', 'DOC', 'PPT', 'XLS', 'IMG', 'ZIP', 'VID', 'FILE'];

export const fmtSize = (bytes) => {
  if (!bytes) return '';
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/* ---- URLs -------------------------------------------------------------- */

/** subjectcode-section-year, e.g. cc4112l-bsit-4a-d */
export const generateClassSlug = (cs) => {
  const subjectCode = (cs?.subject?.subjectCode || cs?.sectionCode || 'class').toLowerCase();
  const sectionCode = (cs?.section?.sectionCode || cs?.sectionCode || '').toLowerCase();
  const year = cs?.section?.year || cs?.year || '';
  return [subjectCode, sectionCode, year].filter(Boolean).join('-')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};
