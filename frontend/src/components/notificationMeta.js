import {
  CalendarClock, CalendarPlus, CalendarX2, CalendarCheck2, UserCog, Megaphone, FileText,
  GraduationCap, ShieldCheck, UserPlus, Bell, ArrowRightLeft,
} from 'lucide-react';

// Icon + colour for a notification, from its type and what happened (metadata.kind)
export const notificationLook = (n) => {
  const kind = n?.metadata?.kind;
  if (n?.type === 'schedule') {
    if (kind === 'created' || kind === 'generated') return { Icon: CalendarPlus, tone: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' };
    if (kind === 'removed') return { Icon: CalendarX2, tone: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300' };
    if (kind === 'published') return { Icon: CalendarCheck2, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' };
    if (kind === 'reassigned') return { Icon: UserCog, tone: 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300' };
    if (kind === 'moved') return { Icon: ArrowRightLeft, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' };
    return { Icon: CalendarClock, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' };
  }
  if (n?.type === 'announcement') return { Icon: Megaphone, tone: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' };
  if (n?.type === 'material') return { Icon: FileText, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' };
  if (n?.type === 'enrollment') return { Icon: GraduationCap, tone: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300' };
  if (n?.type === 'account') {
    return kind === 'signup'
      ? { Icon: UserPlus, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' }
      : { Icon: ShieldCheck, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' };
  }
  return { Icon: Bell, tone: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
};

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'classes', label: 'Classes', types: ['announcement', 'material'] },
  { id: 'other', label: 'Other', types: ['enrollment', 'account', 'system'] },
];

export const matchesFilter = (n, filter) => {
  if (filter === 'all') return true;
  if (filter === 'unread') return !n.isRead;
  if (filter === 'schedule') return n.type === 'schedule';
  const f = FILTERS.find((x) => x.id === filter);
  return f?.types ? f.types.includes(n.type) : true;
};

export const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** "Today", "Yesterday" or "Earlier" for grouping the list. */
export const dayGroup = (date) => {
  const d = new Date(date);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (d.getTime() >= start) return 'Today';
  if (d.getTime() >= start - 86400000) return 'Yesterday';
  return 'Earlier';
};
