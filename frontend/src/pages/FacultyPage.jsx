import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import Layout from '../components/Layout';
import { facultyAPI } from '../services/api';
import useCachedData from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import {
  Plus, Search, Edit2, Trash2, Eye, X,
  User, Mail, Phone, BookOpen, TrendingUp,
  AlertCircle, AlertTriangle, CheckCircle,
  Grid3x3, List, GraduationCap, Briefcase, Star, Layers, Clock,
  Download, RefreshCw, Settings, Link as LinkIcon, Copy, ArrowDown, ChevronDown
} from 'lucide-react';
import AnimatedUsers from '../components/AnimatedUsers';
import AnimatedBarChart from '../components/AnimatedBarChart';
import AnimatedAlertCircle from '../components/AnimatedAlertCircle';
import FacultyModal from '../components/FacultyModal';
import FacultyDetailsModal from '../components/FacultyDetailsModal';
import FacultyAccountConfigModal from '../components/FacultyAccountConfigModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../hooks/usePrograms';
import { summarizeAllSubjects, describeRecency } from '../utils/teachingExperience';

// Background images (same as class spaces)
import bg1 from '../assets/images/class-spaces-bg/GOOGLE-BLUES.jpe';
import bg2 from '../assets/images/class-spaces-bg/Google-Green.jpe';
import bg3 from '../assets/images/class-spaces-bg/Google-Red.jpe';
import bg4 from '../assets/images/class-spaces-bg/Google-Yellows.jpe';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const CARD_BACKGROUNDS = [bg1, bg2, bg3, bg4];

const STANDARD_LOAD = 36; // hours/week
const WARNING_LIMIT = 40; // above this is an overload
const POSITION_HOURS = { Chairman: 12, Dean: 9, CD: 6 };

const PAGE_SIZE = { grid: 12, list: 25 };

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'load', label: 'Highest load' },
  { key: 'load-asc', label: 'Lowest load' },
  { key: 'experience', label: 'Most semesters taught' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'id', label: 'Employee ID' },
];

// Green: 0-36, Yellow: 37-40, Red: 40+
const LOAD_STATUS = {
  normal: { label: 'Normal', Icon: CheckCircle, bar: 'bg-green-600', text: 'text-green-600 dark:text-green-400' },
  warning: { label: 'Near limit', Icon: AlertTriangle, bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
  overload: { label: 'Overload', Icon: AlertCircle, bar: 'bg-red-600', text: 'text-red-600 dark:text-red-400' },
};

const DEGREES = [
  { key: 'bachelorsDegree', label: 'BS', tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { key: 'mastersDegree', label: 'MS', tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { key: 'doctoralDegree', label: 'PhD', tone: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
];

const TONE_GREEN = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
const TONE_AMBER = 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
const TONE_GRAY = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
const TAG = 'inline-flex items-center px-2 py-1 rounded-md text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';

const SECONDARY_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm disabled:opacity-60';

const SELECT_CLASS =
  'px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all disabled:bg-gray-100 dark:disabled:bg-gray-600';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Same faculty always gets the same background. */
const backgroundFor = (key) => {
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CARD_BACKGROUNDS[Math.abs(hash) % CARD_BACKGROUNDS.length];
};

const nameOf = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
const initialsOf = (u) =>
  `${u?.firstName?.[0] || ''}${u?.lastName?.[0] || ''}`.toUpperCase();

const avatarSrc = (path) =>
  path ? `${process.env.REACT_APP_API_URL?.replace('/api', '')}${path}` : null;

// Accessors for the Faculty schema (backend/models/Faculty.model.js).
const getMaxLoad = (f) => f.maxTeachingHours || f.maxTeachingLoad || STANDARD_LOAD;
const getCurrentLoad = (f) => f.currentTeachingHours || f.currentLoad || 0;
const getPositionHours = (f) => POSITION_HOURS[f.position] || 0;
const getTotalHours = (f) => getCurrentLoad(f) + getPositionHours(f);
const getSpecializations = (f) => f.specializations || [];
const getPrograms = (f) => f.programs || [];
const getPhone = (f) => f.contactNumber || f.user?.contactNumber || '';
const getSemestersTaught = (f) => {
  // Sum semesters taught from experiencedSubjects
  if (f.experiencedSubjects && f.experiencedSubjects.length > 0) {
    return f.experiencedSubjects.reduce((sum, exp) => sum + (exp.semestersTaught || 0), 0);
  }
  // Fallback to teachingHistory length if no experienced subjects
  return (f.teachingHistory || []).length;
};

const getTopQualification = (f) => {
  const q = (f.qualifications || [])[0];
  return q ? [q.degree, q.field].filter(Boolean).join(' in ') : null;
};

const getLoad = (f) => {
  const total = getTotalHours(f);
  const key = total > WARNING_LIMIT ? 'overload' : total > STANDARD_LOAD ? 'warning' : 'normal';
  return {
    key,
    total,
    teaching: getCurrentLoad(f),
    admin: getPositionHours(f),
    percent: Math.min(100, (total / STANDARD_LOAD) * 100),
    ...LOAD_STATUS[key],
  };
};

// The schema has no `averageRating` field: ratings live on individual
// teachingHistory entries, so average the ones that have a score.
const getAverageRating = (f) => {
  const rated = (f.teachingHistory || []).filter((h) => typeof h.rating === 'number' && h.rating > 0);
  return rated.length ? rated.reduce((sum, h) => sum + h.rating, 0) / rated.length : null;
};

const getDegrees = (f) =>
  DEGREES.filter((d) => f[d.key]?.degree).map((d) => {
    const v = f[d.key];
    return {
      ...d,
      name: v.major || v.degree,
      minor: v.minor,
      full: `${v.degree}${v.major ? ` (${v.major})` : ''}`,
    };
  });

/**
 * Subject experience chips.
 * Prioritizes manually curated experiencedSubjects, falls back to teachingHistory.
 */
const getTopSubjects = (f, limit = 3) => {
  // Priority 1: Manually curated experienced subjects (most reliable)
  if (f.experiencedSubjects?.length > 0) {
    return f.experiencedSubjects.slice(0, limit).map((exp, i) => {
      const parts = [];
      if (exp.semestersTaught > 0) parts.push(`${exp.semestersTaught} sem`);
      if (exp.frequency && exp.period) parts.push(`${exp.frequency} · ${exp.period}`);

      // Pull "N year(s)" out of the period text, e.g. "3 years ago"
      const match = String(exp.period || '').match(/(\d+)\s*year/i);
      const yearsAgo = match ? parseInt(match[1], 10) : 0;
      const isRecent = yearsAgo <= 1;
      const isStale = yearsAgo >= 5;

      return {
        key: `${exp.subjectCode}-${i}`,
        label: exp.subjectCode,
        badge: parts.join(' · '),
        rating: exp.rating > 0 ? exp.rating : null,
        tone: isStale ? TONE_AMBER : isRecent ? TONE_GREEN : TONE_GRAY,
        experience: exp.semestersTaught || 0,
        program: null,
      };
    });
  }

  // Priority 2: Auto-calculated from teaching history
  const summary = summarizeAllSubjects(f);
  return summary.slice(0, limit).map((s) => {
    const parts = [`${s.timesTaught}× taught`];
    if (s.lastTaughtYearsAgo !== null) parts.push(describeRecency(s.lastTaughtYearsAgo));

    return {
      key: s.key,
      label: s.subjectCode || s.subjectName,
      badge: parts.join(' · '),
      rating: s.avgRating,
      tone: s.isStale ? TONE_AMBER : s.lastTaughtYearsAgo <= 1 ? TONE_GREEN : TONE_GRAY,
      experience: s.weightedExperience,
      program: s.program,
    };
  });
};

const downloadCsv = (filename, headers, rows) => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const readSignupLink = () => {
  let hours = 48;
  try {
    const config = JSON.parse(localStorage.getItem('facultyAccountConfig') || '{}');
    hours = config.linkExpirationHours || 48;
  } catch (error) {
    console.error('Error parsing config:', error);
  }
  return {
    url: `${window.location.origin}/faculty-signup`,
    hours,
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  };
};

/** useState that remembers its value in localStorage (ignores storage errors / unknown values). */
const usePersistedState = (key, initial, allowed) => {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && (!allowed || allowed.includes(saved))) return saved;
    } catch {
      /* storage unavailable */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue];
};

/* ─── Small components ───────────────────────────────────────────────────── */

const Chip = ({ children, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
    {children}
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove filter"
      className="hover:text-indigo-900 dark:hover:text-indigo-100"
    >
      <X className="w-3 h-3" />
    </button>
  </span>
);

const Avatar = ({ user, size = 'h-10 w-10', iconSize = 'w-5 h-5', extra = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = avatarSrc(user?.profilePicture);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={nameOf(user)}
        onError={() => setFailed(true)}
        className={`flex-shrink-0 ${size} rounded-full object-cover ${extra}`}
      />
    );
  }
  const initials = initialsOf(user);
  return (
    <div className={`flex-shrink-0 ${size} rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center ${extra}`}>
      {initials ? (
        <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">{initials}</span>
      ) : (
        <User className={`${iconSize} text-indigo-600 dark:text-indigo-400`} />
      )}
    </div>
  );
};

const SectionLabel = ({ icon: Icon, children }) => (
  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
    <Icon className="w-3 h-3" />
    {children}
  </p>
);

const EducationList = ({ degrees, compact = false }) => (
  <div className="space-y-1">
    {degrees.map((d) => (
      <div key={d.key} className="flex items-start gap-2 text-xs">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${d.tone}`}>
          {d.label}
        </span>
        <span
          className={`text-gray-700 dark:text-gray-300 ${compact ? 'truncate max-w-[120px]' : 'flex-1'}`}
          title={d.full}
        >
          {d.name}
          {!compact && d.minor && (
            <span className="text-gray-500 dark:text-gray-400 ml-1">(Minor: {d.minor})</span>
          )}
        </span>
      </div>
    ))}
  </div>
);

const TagList = ({ items, limit, bold = false }) => (
  <div className="flex flex-wrap gap-1">
    {items.slice(0, limit).map((item) => (
      <span key={item} className={`${TAG} ${bold ? 'font-bold' : 'font-semibold'}`}>{item}</span>
    ))}
    {items.length > limit && (
      <span
        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
        title={items.slice(limit).join(', ')}
      >
        +{items.length - limit}
      </span>
    )}
  </div>
);

const LoadBar = ({ load, height = 'h-2.5' }) => (
  <div
    className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${height} overflow-hidden`}
    role="progressbar"
    aria-valuenow={Math.round(load.percent)}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={`Workload ${load.total} hours`}
  >
    <div
      className={`h-full rounded-full transition-all duration-500 ${load.bar}`}
      style={{ width: `${load.percent}%` }}
    />
  </div>
);

const StatCard = ({ icon: Icon, label, value, caption, tone, onClick, active, title }) => {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive ? { type: 'button', onClick, title, 'aria-pressed': !!active } : {})}
      className={`text-left ${tone} text-white rounded-xl p-4 shadow-md transition-all ${
        interactive ? 'hover:shadow-lg' : ''
      } ${active ? 'ring-4 ring-gray-300 dark:ring-gray-500' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 opacity-80" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
      <div className="text-xs opacity-80 mt-1">{caption}</div>
    </Tag>
  );
};

/** One-glance split of the whole faculty by workload status. */
const LoadDistribution = ({ stats }) => {
  if (stats.total === 0) return null;
  const normal = stats.total - stats.warning - stats.overloaded;
  const segments = [
    { key: 'normal', count: normal, bar: LOAD_STATUS.normal.bar, label: 'Normal' },
    { key: 'warning', count: stats.warning, bar: LOAD_STATUS.warning.bar, label: 'Near limit' },
    { key: 'overload', count: stats.overloaded, bar: LOAD_STATUS.overload.bar, label: 'Overload' },
  ];
  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Workload distribution</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {Math.round((normal / stats.total) * 100)}% within standard load
        </p>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              className={`${s.bar} transition-all duration-500`}
              style={{ width: `${(s.count / stats.total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-gray-600 dark:text-gray-400">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.bar}`} />
            {s.label}: <strong className="text-gray-800 dark:text-gray-200">{s.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
};

const ListSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading faculty">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-24 bg-gray-200 dark:bg-gray-700" />
        <div className="p-5 space-y-4">
          <div className="flex gap-3 -mt-12">
            <div className="h-16 w-16 rounded-full bg-gray-300 dark:bg-gray-600 ring-4 ring-white dark:ring-gray-800" />
          </div>
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-700/60" />
          <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    ))}
  </div>
);

/** Click / Enter / Space on a row-like element opens it, ignoring bubbled events from inner buttons. */
const activateOnKey = (fn) => (e) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

const stop = (fn) => (e) => {
  e.stopPropagation();
  fn();
};

const ActionButtons = ({ member, canManage, onView, onEdit, onDelete, variant }) => {
  const full = variant === 'full';
  const base = full
    ? 'flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-lg transition-all font-medium'
    : 'p-2 rounded-lg transition-colors';
  const viewTone = full
    ? 'flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
    : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900';
  const editTone = full
    ? 'flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md'
    : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900';
  const deleteTone = full
    ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md'
    : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900';
  return (
    <>
      <button
        onClick={stop(() => onView(member))}
        className={`${base} ${viewTone}`}
        title="View details"
        aria-label="View details"
      >
        <Eye className="w-4 h-4" />
        {full && 'View'}
      </button>
      {canManage && (
        <>
          <button
            onClick={stop(() => onEdit(member))}
            className={`${base} ${editTone}`}
            title="Edit"
            aria-label="Edit"
          >
            <Edit2 className="w-4 h-4" />
            {full && 'Edit'}
          </button>
          <button
            onClick={stop(() => onDelete(member))}
            className={`${base} ${deleteTone}`}
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </>
  );
};

/* ─── Grid card ──────────────────────────────────────────────────────────── */

const FacultyCard = ({ member, canManage, onView, onEdit, onDelete }) => {
  const { user } = member;
  const load = getLoad(member);
  const programs = getPrograms(member);
  const specializations = getSpecializations(member);
  const degrees = getDegrees(member);
  // The free-form qualification line only adds information when no degrees are on file
  const topQualification = degrees.length === 0 ? getTopQualification(member) : null;
  const subjects = getTopSubjects(member);
  const rating = getAverageRating(member);
  const phone = getPhone(member);
  const StatusIcon = load.Icon;
  const hoursGap = load.total - STANDARD_LOAD;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(member)}
      onKeyDown={activateOnKey(() => onView(member))}
      title="Click to view details"
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 flex flex-col"
    >
      <div
        className="h-24 bg-cover bg-center relative flex-shrink-0"
        style={{ backgroundImage: `url(${backgroundFor(member._id)})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/50" />
        {/* Status dot: visible at a glance without reading the workload section */}
        <span
          className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-white/90 dark:bg-gray-900/80 ${load.text}`}
        >
          <StatusIcon className="w-3 h-3" />
          {load.label}
        </span>
      </div>

      <div className="p-5 -mt-8 relative flex flex-col flex-1">
        {/* Profile */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar
            user={user}
            size="h-16 w-16"
            iconSize="w-8 h-8"
            extra="ring-4 ring-white dark:ring-gray-800 shadow-lg"
          />
          <div className="flex-1 min-w-0 mt-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{nameOf(user)}</h3>
            {member.position && (
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 truncate flex items-center gap-1">
                <Briefcase className="w-3 h-3 flex-shrink-0" />
                {member.position}
              </p>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1 mt-1">
              <Mail className="w-3 h-3 flex-shrink-0" />
              {user?.email}
            </p>
            {phone && (
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1">
                <Phone className="w-3 h-3 flex-shrink-0" />
                {phone}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1 mt-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded">
                {member.employeeId}
              </span>
              {member.employmentType && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${member.employmentType === 'Part-time' ? TONE_AMBER : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}`}>
                  {member.employmentType}
                </span>
              )}
              {member.department && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${TONE_GRAY}`}>{member.department}</span>
              )}
            </div>
          </div>
        </div>

        {/* Qualified programs */}
        <div className="mb-3">
          <SectionLabel icon={Layers}>Qualified Programs</SectionLabel>
          {programs.length > 0 ? (
            <TagList items={programs} limit={programs.length} bold />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-3 h-3" />
              None assigned
            </span>
          )}
        </div>

        {specializations.length > 0 && (
          <div className="mb-3">
            <SectionLabel icon={BookOpen}>Specializations</SectionLabel>
            <TagList items={specializations} limit={3} />
          </div>
        )}

        {degrees.length > 0 && (
          <div className="mb-3">
            <SectionLabel icon={GraduationCap}>Education</SectionLabel>
            <EducationList degrees={degrees} />
          </div>
        )}

        {/* Qualification / experience / rating */}
        <div className="mb-3 space-y-1">
          {topQualification && (
            <p className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span className="truncate">{topQualification}</span>
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              {getSemestersTaught(member)} sem taught
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              {rating ? `${rating.toFixed(1)}/5.0` : 'Not rated'}
            </span>
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="mb-3">
            <SectionLabel icon={TrendingUp}>Subject Expertise</SectionLabel>
            <div className="space-y-1.5">
              {subjects.map((s) => (
                <div key={s.key} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        {s.label}
                      </span>
                      {s.rating && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{s.rating.toFixed(1)}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.tone}`}>
                        {s.badge}
                      </span>
                      {s.program && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{s.program}</span>
                      )}
                    </div>
                  </div>
                  {s.experience > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {s.experience.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">exp pts</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workload */}
        <div className="mb-4 mt-auto pt-1">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Total Hours</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {load.total} hrs
              {load.admin > 0 && (
                <span className="text-xs text-gray-500" title="Teaching + administrative hours">
                  {' '}({load.teaching}T + {load.admin}A)
                </span>
              )}
            </span>
          </div>
          <LoadBar load={load} />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hoursGap > 0
              ? `${hoursGap} hrs over standard`
              : hoursGap === 0
              ? 'At standard load'
              : `${-hoursGap} hrs below standard`}
          </p>
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <ActionButtons
            member={member}
            canManage={canManage}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            variant="full"
          />
        </div>
      </div>
    </div>
  );
};

/* ─── Table row ──────────────────────────────────────────────────────────── */

const FacultyRow = ({ member, canManage, onView, onEdit, onDelete }) => {
  const { user } = member;
  const load = getLoad(member);
  const programs = getPrograms(member);
  const degrees = getDegrees(member);
  const StatusIcon = load.Icon;

  return (
    <tr
      tabIndex={0}
      onClick={() => onView(member)}
      onKeyDown={activateOnKey(() => onView(member))}
      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus:bg-indigo-50 dark:focus:bg-gray-700"
      title="Click to view details"
    >
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <Avatar user={user} />
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{nameOf(user)}</div>
            {member.position && (
              <div className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                {member.position}
                {member.employmentType ? ` · ${member.employmentType}` : ''}
              </div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <Mail className="w-3 h-3 mr-1" />
              {user?.email}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded">
          {member.employeeId}
        </span>
      </td>
      <td className="px-4 py-4">
        {programs.length > 0 ? (
          <TagList items={programs} limit={programs.length} bold />
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-400">None</span>
        )}
      </td>
      <td className="px-4 py-4">
        <TagList items={getSpecializations(member)} limit={2} />
      </td>
      <td className="px-4 py-4">
        {degrees.length > 0 ? (
          <EducationList degrees={degrees} compact />
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">Not specified</span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="min-w-[140px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">{load.total} hrs</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${load.text}`} title={load.label}>
              <StatusIcon className="w-3.5 h-3.5" />
              {load.label}
            </span>
          </div>
          <LoadBar load={load} height="h-2" />
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          <ActionButtons
            member={member}
            canManage={canManage}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            variant="icon"
          />
        </div>
      </td>
    </tr>
  );
};

// sortKey = which SORT_OPTIONS entry a header click applies (null = not sortable)
const TABLE_HEADERS = [
  { label: 'Faculty', sortKey: 'name' },
  { label: 'Employee ID', sortKey: 'id' },
  { label: 'Programs', sortKey: null },
  { label: 'Specialization', sortKey: null },
  { label: 'Education', sortKey: null },
  { label: 'Workload', sortKey: 'load' },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

const FacultyPage = () => {
  const { user } = useAuth();
  const { programCodes } = usePrograms();

  // Program managers are locked to their own program
  const isProgramManager = user?.role === 'program_manager';
  const lockedProgram = isProgramManager ? user?.program || '' : '';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState('');
  const [filterEmployment, setFilterEmployment] = useState('');
  const [filterLoad, setFilterLoad] = useState(''); // '' | 'warning' | 'overload'
  const [sortKey, setSortKey] = usePersistedState('faculty.sortKey', 'name', SORT_OPTIONS.map((o) => o.key));
  const [viewMode, setViewMode] = usePersistedState('faculty.viewMode', 'grid', ['grid', 'list']);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE.grid);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSignupLink, setShowSignupLink] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const searchRef = useRef(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    onConfirm: null,
  });
  const closeConfirmDialog = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

  // Keep typing snappy: filtering runs on a deferred copy of the search text
  const deferredSearch = useDeferredValue(searchTerm);

  // The program actually applied to the query (locked for program managers)
  const activeProgram = lockedProgram || filterProgram;

  // Faculty list with 5-minute cache; the key changes with the program, so no manual reload is needed
  const {
    data: facultyResponse,
    loading,
    error,
    refetch: reloadFaculty,
  } = useCachedData(
    () => {
      const params = { isActive: true };
      if (activeProgram) params.program = activeProgram;
      return facultyAPI.getAll(params);
    },
    `faculty-list-${activeProgram || 'all'}`,
    {
      cacheDuration: 5 * 60 * 1000,
      enabled: true,
      onError: (err) => {
        console.error('Failed to load faculty:', err);
        toast.error('Failed to load faculty');
      },
    }
  );

  const faculty = useMemo(() => {
    if (!facultyResponse) return [];
    const data = facultyResponse.data || facultyResponse;
    const list = data?.data || data || [];
    return Array.isArray(list) ? list : [];
  }, [facultyResponse]);

  useEffect(() => {
    if (facultyResponse) setLastUpdated(new Date());
  }, [facultyResponse]);

  // "/" jumps to search (unless already typing somewhere)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const allSpecializations = useMemo(
    () => [...new Set(faculty.flatMap(getSpecializations))].sort((a, b) => a.localeCompare(b)),
    [faculty]
  );

  const allEmploymentTypes = useMemo(
    () => [...new Set(faculty.map((f) => f.employmentType).filter(Boolean))].sort(),
    [faculty]
  );

  const filteredFaculty = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const spec = filterSpecialization.toLowerCase();

    const rows = faculty.filter((f) => {
      if (q) {
        const haystack = [
          nameOf(f.user), f.user?.email, f.employeeId, f.position,
          ...getPrograms(f), ...getSpecializations(f),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (spec && !getSpecializations(f).some((s) => s.toLowerCase() === spec)) return false;
      if (filterEmployment && f.employmentType !== filterEmployment) return false;
      if (filterLoad && getLoad(f).key !== filterLoad) return false;
      return true;
    });

    const byName = (a, b) =>
      (a.user?.lastName || '').localeCompare(b.user?.lastName || '') ||
      (a.user?.firstName || '').localeCompare(b.user?.firstName || '');

    return rows.sort((a, b) => {
      switch (sortKey) {
        case 'load':
          return getTotalHours(b) - getTotalHours(a) || byName(a, b);
        case 'load-asc':
          return getTotalHours(a) - getTotalHours(b) || byName(a, b);
        case 'experience':
          return getSemestersTaught(b) - getSemestersTaught(a) || byName(a, b);
        case 'rating':
          return (getAverageRating(b) || 0) - (getAverageRating(a) || 0) || byName(a, b);
        case 'id':
          return (a.employeeId || '').localeCompare(b.employeeId || '', undefined, { numeric: true });
        case 'name':
        default:
          return byName(a, b);
      }
    });
  }, [faculty, deferredSearch, filterSpecialization, filterEmployment, filterLoad, sortKey]);

  // Reset paging whenever the result set or layout changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE[viewMode]);
  }, [deferredSearch, filterSpecialization, filterEmployment, filterLoad, sortKey, viewMode, activeProgram]);

  const visibleFaculty = useMemo(
    () => filteredFaculty.slice(0, visibleCount),
    [filteredFaculty, visibleCount]
  );
  const remaining = filteredFaculty.length - visibleFaculty.length;

  const stats = useMemo(() => {
    const keys = faculty.map((f) => getLoad(f).key);
    const totalHours = faculty.reduce((sum, f) => sum + getTotalHours(f), 0);
    return {
      total: faculty.length,
      avgLoad: faculty.length ? Math.round(totalHours / faculty.length) : 0,
      warning: keys.filter((k) => k === 'warning').length,
      overloaded: keys.filter((k) => k === 'overload').length,
    };
  }, [faculty]);

  // Computed only while the panel is open, so the "expires in" time is stable between renders
  const signupLink = useMemo(() => (showSignupLink ? readSignupLink() : null), [showSignupLink]);

  const hasActiveFilters = !!(
    searchTerm || filterSpecialization || filterEmployment || filterLoad ||
    (filterProgram && !isProgramManager)
  );

  const clearFilters = () => {
    setSearchTerm('');
    setFilterSpecialization('');
    setFilterEmployment('');
    setFilterLoad('');
    // A program manager's program stays locked
    if (!isProgramManager) setFilterProgram('');
  };

  const toggleLoadFilter = (key) => setFilterLoad((cur) => (cur === key ? '' : key));

  /* Handlers */

  const handleCreate = () => {
    setSelectedFaculty(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEdit = (member) => {
    setSelectedFaculty(member);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleView = (member) => {
    setSelectedFaculty(member);
    setShowDetailsModal(true);
  };

  const handleDelete = (member) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Faculty Member',
      message: 'Are you sure you want to delete this faculty member? This action cannot be undone.',
      itemName: nameOf(member.user),
      onConfirm: async () => {
        try {
          await facultyAPI.delete(member._id);
          toast.success('Faculty member deleted successfully');
          reloadFaculty();
        } catch (err) {
          console.error('Delete error:', err);
          toast.error(
            err.response?.data?.message ||
              (err.response?.status === 403
                ? 'You do not have permission to delete this faculty member'
                : 'Failed to delete faculty member')
          );
        } finally {
          closeConfirmDialog();
        }
      },
    });
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedFaculty(null);
    if (shouldRefresh) reloadFaculty();
  };

  const handleRefresh = async () => {
    try {
      await reloadFaculty();
      toast.success('Faculty data refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  // Exports what is currently shown (all filtered rows, not just the visible page)
  const exportCsv = () => {
    if (filteredFaculty.length === 0) {
      toast.error('No faculty to export');
      return;
    }

    const headers = [
      'Employee ID', 'First Name', 'Last Name', 'Email', 'Contact Number', 'Position',
      'Employment Type', 'Programs', 'Specializations', 'Max Teaching Hours', 'Current Load',
      'Position Load', 'Total Hours', 'Workload Status', 'Status', 'Highest Qualification',
    ];
    const rows = filteredFaculty.map((f) => [
      f.employeeId,
      f.user?.firstName,
      f.user?.lastName,
      f.user?.email,
      getPhone(f),
      f.position,
      f.employmentType,
      getPrograms(f).join(', '),
      getSpecializations(f).join(', '),
      getMaxLoad(f),
      getCurrentLoad(f),
      getPositionHours(f),
      getTotalHours(f),
      LOAD_STATUS[getLoad(f).key].label,
      f.isActive ? 'Active' : 'Inactive',
      getTopQualification(f),
    ]);

    const date = new Date().toISOString().split('T')[0];
    downloadCsv(`faculty${activeProgram ? `_${activeProgram}` : ''}_${date}.csv`, headers, rows);
    toast.success(`Exported ${rows.length} faculty member${rows.length === 1 ? '' : 's'}`);
  };

  const copySignupLink = async () => {
    try {
      await navigator.clipboard.writeText(signupLink.url);
      toast.success('Signup link copied to clipboard!');
    } catch (err) {
      console.error('Error copying link:', err);
      toast.error('Failed to copy link');
    }
  };

  const canManage = true; // Both admins and program managers can manage faculty
  const showSkeleton = loading && faculty.length === 0;
  const showError = !!error && !loading && faculty.length === 0;
  const pageSize = PAGE_SIZE[viewMode];

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Faculty Management
            </h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={SECONDARY_BTN}
                title="Refresh faculty data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={exportCsv}
                disabled={filteredFaculty.length === 0}
                className={SECONDARY_BTN}
                title="Download the faculty shown as a CSV file"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className={SECONDARY_BTN}
                title="Configure faculty account creation settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Account Config</span>
              </button>
              <button
                onClick={() => setShowSignupLink((v) => !v)}
                aria-pressed={showSignupLink}
                className={SECONDARY_BTN}
                title="Show faculty signup link"
              >
                <LinkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Signup Link</span>
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Faculty</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Manage faculty profiles, qualifications, and workload. Click a faculty member to see their full profile.
            {lastUpdated && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        {/* Signup link */}
        {signupLink && (
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 shadow-lg text-white animate-fadeIn">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Faculty Signup Link</h3>
                  <p className="text-blue-100 text-sm">Share this link with faculty members to register</p>
                </div>
              </div>
              <button
                onClick={() => setShowSignupLink(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
                aria-label="Close signup link"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4 mb-3">
              <input
                type="text"
                value={signupLink.url}
                readOnly
                onFocus={(e) => e.target.select()}
                aria-label="Faculty signup link"
                className="flex-1 min-w-0 bg-white/20 text-white px-4 py-3 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/60"
              />
              <button
                onClick={copySignupLink}
                className="px-6 py-3 bg-white hover:bg-white/90 text-blue-600 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Copy className="w-5 h-5" />
                Copy
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-blue-100">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>
                Link expires: <strong>{signupLink.expiresAt.toLocaleString()}</strong> ({signupLink.hours} hours from now)
              </span>
            </div>

            <div className="mt-3 text-xs text-blue-100 bg-white/10 rounded-lg p-3">
              <strong>Note:</strong> Faculty who register via this link will have pending status and require approval
              before accessing the system. You can review and approve pending accounts from the "Pending Approvals" page.
            </div>
          </div>
        )}

        {/* Statistics. Near limit and Overload double as quick workload filters. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
          <StatCard
            icon={AnimatedUsers}
            label="TOTAL"
            value={stats.total}
            caption="Faculty Members"
            tone="bg-indigo-600"
            onClick={clearFilters}
            title="Show all faculty"
          />
          <StatCard
            icon={AnimatedBarChart}
            label="AVG LOAD"
            value={stats.avgLoad}
            caption="Hours/Week"
            tone="bg-blue-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="NEAR LIMIT"
            value={stats.warning}
            caption={`${STANDARD_LOAD + 1}–${WARNING_LIMIT} hrs`}
            tone="bg-amber-600"
            active={filterLoad === 'warning'}
            onClick={() => toggleLoadFilter('warning')}
            title="Filter faculty near their limit"
          />
          <StatCard
            icon={AnimatedAlertCircle}
            label="OVERLOAD"
            value={stats.overloaded}
            caption={`Over ${WARNING_LIMIT} hrs`}
            tone="bg-red-600"
            active={filterLoad === 'overload'}
            onClick={() => toggleLoadFilter('overload')}
            title="Filter overloaded faculty"
          />
        </div>

        <LoadDistribution stats={stats} />

        {/* Search and filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search name, email, ID, program or specialization…  ( / )"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setSearchTerm(''), e.target.blur())}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={lockedProgram || filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                disabled={isProgramManager}
                title={isProgramManager ? `You manage ${lockedProgram}` : 'Filter by program'}
                aria-label="Filter by program"
                className={SELECT_CLASS}
              >
                {isProgramManager ? (
                  <option value={lockedProgram}>{lockedProgram || 'No program assigned'}</option>
                ) : (
                  <>
                    <option value="">All Programs</option>
                    {programCodes.map((prog) => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </>
                )}
              </select>

              <select
                value={filterSpecialization}
                onChange={(e) => setFilterSpecialization(e.target.value)}
                title="Filter by specialization"
                aria-label="Filter by specialization"
                className={SELECT_CLASS}
              >
                <option value="">All Specializations</option>
                {allSpecializations.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>

              {allEmploymentTypes.length > 1 && (
                <select
                  value={filterEmployment}
                  onChange={(e) => setFilterEmployment(e.target.value)}
                  title="Filter by employment type"
                  aria-label="Filter by employment type"
                  className={SELECT_CLASS}
                >
                  <option value="">All Types</option>
                  {allEmploymentTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                title="Sort by"
                aria-label="Sort by"
                className={SELECT_CLASS}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>Sort: {o.label}</option>
                ))}
              </select>

              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                {[
                  { mode: 'grid', Icon: Grid3x3, title: 'Grid View' },
                  { mode: 'list', Icon: List, title: 'List View' },
                ].map(({ mode, Icon, title }, i) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    title={title}
                    aria-label={title}
                    className={`px-3 py-2 transition-colors ${i > 0 ? 'border-l border-gray-300 dark:border-gray-600' : ''} ${
                      viewMode === mode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
              {searchTerm && <Chip onRemove={() => setSearchTerm('')}>Search: {searchTerm}</Chip>}
              {filterProgram && !isProgramManager && (
                <Chip onRemove={() => setFilterProgram('')}>Program: {filterProgram}</Chip>
              )}
              {filterSpecialization && (
                <Chip onRemove={() => setFilterSpecialization('')}>Specialization: {filterSpecialization}</Chip>
              )}
              {filterEmployment && (
                <Chip onRemove={() => setFilterEmployment('')}>Type: {filterEmployment}</Chip>
              )}
              {filterLoad && (
                <Chip onRemove={() => setFilterLoad('')}>Load: {LOAD_STATUS[filterLoad].label}</Chip>
              )}
              <button onClick={clearFilters} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Result count */}
        {!showSkeleton && !showError && faculty.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3" aria-live="polite">
            Showing <strong className="text-gray-700 dark:text-gray-300">{visibleFaculty.length}</strong> of{' '}
            <strong className="text-gray-700 dark:text-gray-300">{filteredFaculty.length}</strong>
            {filteredFaculty.length !== faculty.length && <> (filtered from {faculty.length})</>} faculty
          </p>
        )}

        {/* Faculty list */}
        {showSkeleton ? (
          <ListSkeleton />
        ) : showError ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Couldn't load faculty</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Check your connection and try again.</p>
            <button
              onClick={handleRefresh}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <AnimatedUsers className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {faculty.length === 0 ? 'No faculty members yet' : 'No faculty found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {faculty.length === 0
                ? 'Get started by adding your first faculty member'
                : 'Try adjusting your search or filter criteria'}
            </p>
            {faculty.length === 0 ? (
              canManage && (
                <button
                  onClick={handleCreate}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add First Faculty
                </button>
              )
            ) : (
              <button
                onClick={clearFilters}
                className="px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleFaculty.map((member) => (
              <FacultyCard
                key={member._id}
                member={member}
                canManage={canManage}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    {TABLE_HEADERS.map(({ label, sortKey: key }) => {
                      const active = key && sortKey === key;
                      return (
                        <th
                          key={label}
                          scope="col"
                          aria-sort={active ? 'ascending' : undefined}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                        >
                          {key ? (
                            <button
                              type="button"
                              onClick={() => setSortKey(key)}
                              className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 ${
                                active ? 'text-indigo-600 dark:text-indigo-400' : ''
                              }`}
                              title={`Sort by ${label.toLowerCase()}`}
                            >
                              {label}
                              {active && <ArrowDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            label
                          )}
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleFaculty.map((member) => (
                    <FacultyRow
                      key={member._id}
                      member={member}
                      canManage={canManage}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {remaining > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setVisibleCount((c) => c + pageSize)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Show {Math.min(pageSize, remaining)} more
              <span className="text-gray-500 dark:text-gray-400">({remaining} remaining)</span>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <FacultyModal mode={modalMode} faculty={selectedFaculty} onClose={handleModalClose} />
      )}

      {showDetailsModal && (
        <FacultyDetailsModal
          faculty={selectedFaculty}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedFaculty(null);
          }}
          onEdit={() => {
            setShowDetailsModal(false);
            handleEdit(selectedFaculty);
          }}
        />
      )}

      {showConfigModal && (
        <FacultyAccountConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSave={() => toast.success('Configuration updated successfully!')}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        itemName={confirmDialog.itemName}
      />
    </Layout>
  );
};

export default FacultyPage;