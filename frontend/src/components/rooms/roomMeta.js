import { DoorOpen, FlaskConical, Monitor, Wrench, Theater, Presentation } from 'lucide-react';

export const ROOM_TYPES = ['Lecture Room', 'Laboratory', 'Computer Lab', 'Workshop', 'Auditorium', 'Conference Room'];
export const LAB_ROOM_TYPES = new Set(['Laboratory', 'Computer Lab', 'Workshop']);
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Broken'];
export const MAX_CAPACITY = 500;

/** Icon, colours and a one-line explanation per room type. */
export const TYPE_META = {
  'Lecture Room': {
    icon: DoorOpen,
    chip: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200',
    tile: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
    hint: 'Regular classes and lecture hours',
  },
  Laboratory: {
    icon: FlaskConical,
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    tile: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    hint: 'Science labs, for lab subjects'
  },
  'Computer Lab': {
    icon: Monitor,
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    tile: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    hint: 'Computers, for lab subjects'
  },
  Workshop: {
    icon: Wrench,
    chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    tile: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
    hint: 'Shop work, for lab subjects'
  },
  Auditorium: {
    icon: Theater,
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    tile: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    hint: 'Large combined classes and events',
  },
  'Conference Room': {
    icon: Presentation,
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    tile: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    hint: 'Meetings and small groups',
  },
};
export const typeMeta = (type) => TYPE_META[type] || TYPE_META['Lecture Room'];

/** Common features offered as one-tap chips; anything else can be typed in. */
export const FEATURE_PRESETS = [
  'Projector', 'Air Conditioning', 'Whiteboard', 'Smart TV', 'Speaker System',
  'Wi-Fi', 'Computers', 'Electric Fans', 'CCTV', 'Sink',
];

// Half-hour steps across the whole teaching day
export const TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return h * 60 + m;
};

/** "13:30" -> "1:30 PM" */
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const fmtRange = (a, b) => `${fmtTime(a)} – ${fmtTime(b)}`;

/** Utilisation colour: idle grey, healthy green, busy amber, packed red. */
export const usageTone = (pct) => {
  if (!pct) return { bar: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400', label: 'Not used' };
  if (pct < 50) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: 'Light use' };
  if (pct < 80) return { bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400', label: 'Busy' };
  return { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', label: 'Nearly full' };
};

/**
 * The next unused code after `code`: COTE-09 -> COTE-10, LAB A -> LAB A2.
 * Keeps zero padding so the list still sorts.
 */
export const nextRoomCode = (code, taken) => {
  const used = new Set([...taken].map((c) => String(c).toUpperCase()));
  const match = String(code || '').match(/^(.*?)(\d+)$/);
  const [prefix, digits, start] = match ? [match[1], match[2].length, Number(match[2])] : [`${code}`, 0, 1];
  for (let n = start + 1; n < start + 1000; n++) {
    const candidate = `${prefix}${digits ? String(n).padStart(digits, '0') : n}`.toUpperCase();
    if (!used.has(candidate)) return candidate;
  }
  return '';
};

export const roomLabel = (room) => room?.roomCode || room?.roomNumber || 'Room';
