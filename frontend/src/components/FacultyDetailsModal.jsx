import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  X, User, Mail, TrendingUp, Award, BookOpen, Calendar, Edit2, MapPin,
  GraduationCap, Star, Copy, Check, Search, ChevronDown, ChevronUp,
  AlertTriangle, Clock, Briefcase,
} from 'lucide-react';
import { ModalShell, ModalFooter, ModalButton } from './modal/ModalShell';
import SummaryCard from './StatCard';
import {
  summarizeAllSubjects,
  describeRecency,
  STALE_AFTER_YEARS,
} from '../utils/teachingExperience';

const TABS = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'expertise', label: 'Teaching', icon: BookOpen },
];

const SORTS = [
  { id: 'experience', label: 'Most experienced' },
  { id: 'recent', label: 'Most recent' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'times', label: 'Times taught' },
];

const INITIAL_VISIBLE = 8;

/* ---------- Small reusable pieces ---------- */

const Section = ({ icon: Icon, title, right, children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    blue: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    indigo: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  };
  return (
    <section className={`rounded-xl p-4 sm:p-5 border shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
};

const InfoRow = ({ icon: Icon, label, color = 'blue', children }) => {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">{label}</p>
        <div className="text-sm text-gray-900 dark:text-white font-medium">{children}</div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, value, unit, label, tone }) => (
  <SummaryCard icon={icon} label={label} value={value} hint={unit} tone={tone === 'green' ? 'emerald' : tone} />
);

const Stars = ({ value }) => (
  <div className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`w-4 h-4 ${
          n <= Math.round(value)
            ? 'text-amber-400 fill-amber-400'
            : 'text-gray-300 dark:text-gray-600'
        }`}
      />
    ))}
  </div>
);

const DegreeCard = ({ badge, degree, color }) => {
  if (!degree?.degree) return null;
  const colors = {
    blue: 'border-blue-500 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'border-purple-500 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    green: 'border-green-500 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  };
  const [border, ...badgeClasses] = colors[color].split(' ');
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 ${border} shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${badgeClasses.join(' ')}`}>
          {badge}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{degree.degree}</p>
          {degree.major && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Major: {degree.major}</p>}
          {degree.minor && <p className="text-xs text-gray-600 dark:text-gray-400">Minor: {degree.minor}</p>}
        </div>
      </div>
    </div>
  );
};

/* ---------- Main modal ---------- */

const FacultyDetailsModal = ({ faculty, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('experience');
  const [onlyStale, setOnlyStale] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Reset local state when a different faculty member is opened
  useEffect(() => {
    setActiveTab('overview');
    setImgFailed(false);
    setQuery('');
    setSortBy('experience');
    setOnlyStale(false);
    setShowAll(false);
  }, [faculty?._id, faculty?.id]);

  // Escape, scroll lock and focus come from ModalShell

  const subjectExperience = useMemo(
    () => (faculty ? summarizeAllSubjects(faculty) : []),
    [faculty]
  );

  const handleCopyEmail = useCallback(async () => {
    const email = faculty?.user?.email;
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable – ignore */
    }
  }, [faculty]);

  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = subjectExperience.filter((s) => {
      if (onlyStale && !s.isStale) return false;
      if (!q) return true;
      return [s.subjectCode, s.subjectName, s.program]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const sorters = {
      experience: (a, b) => b.weightedExperience - a.weightedExperience,
      recent: (a, b) => a.lastTaughtYearsAgo - b.lastTaughtYearsAgo,
      rating: (a, b) => (b.avgRating || 0) - (a.avgRating || 0),
      times: (a, b) => b.timesTaught - a.timesTaught,
    };
    list = [...list].sort(sorters[sortBy]);
    return list;
  }, [subjectExperience, query, sortBy, onlyStale]);

  if (!faculty) return null;

  /* ----- Derived values ----- */
  const fullName = `${faculty.user?.firstName || ''} ${faculty.user?.lastName || ''}`.trim() || 'Unnamed Faculty';
  const initials =
    `${faculty.user?.firstName?.[0] || ''}${faculty.user?.lastName?.[0] || ''}`.toUpperCase() || '?';

  // Position-based administrative load
  const POSITION_HOURS = { Chairman: 12, Dean: 9, CD: 6 };
  const positionHours = POSITION_HOURS[faculty.position] || 0;
  
  const currentLoad = (faculty.currentTeachingHours || 0) + positionHours;
  const maxLoad = faculty.maxTeachingHours || 36;
  const rawPercent = maxLoad > 0 ? (currentLoad / maxLoad) * 100 : 0;
  const LOAD_ALLOWANCE = 4;
  const barScale = Math.max(maxLoad + LOAD_ALLOWANCE, currentLoad);
  const loadPercent = Math.min((currentLoad / barScale) * 100, 100);
  const remaining = maxLoad - currentLoad;

  // Same rule as the Faculty page cards: over the teacher's own max is "near
  // limit" up to LOAD_ALLOWANCE hours, beyond that an overload. (This modal
  // used to call anything past 80% "near capacity" while the card behind it
  // said "Normal".)
  const status =
    currentLoad > maxLoad + LOAD_ALLOWANCE
      ? { label: 'Overload', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
      : currentLoad > maxLoad
      ? { label: 'Near limit', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' }
      : { label: 'Normal', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  // The schema field is `specializations`; this read `specialization`, so the
  // section never showed
  const specializations = faculty.specializations || faculty.specialization || [];
  const programs = faculty.programs || [];

  const imgSrc = faculty.user?.profilePicture
    ? `${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')}${faculty.user.profilePicture}`
    : null;

  const rated = subjectExperience.filter((s) => s.avgRating);
  const overallRating = rated.length
    ? rated.reduce((sum, s) => sum + s.avgRating, 0) / rated.length
    : null;

  const allYearsAgo = subjectExperience.flatMap((s) => s.occurrences.map((o) => o.yearsAgo));
  const yearsTeaching = allYearsAgo.length ? Math.max(...allYearsAgo) + 1 : 0;
  const staleCount = subjectExperience.filter((s) => s.isStale).length;
  const activeRecently = subjectExperience.filter((s) => s.lastTaughtYearsAgo <= 1).length;

  const hasDegrees =
    faculty.bachelorsDegree?.degree || faculty.mastersDegree?.degree || faculty.doctoralDegree?.degree;
  const hasQualifications = faculty.qualifications?.length > 0;

  const visibleSubjects = showAll ? filteredSubjects : filteredSubjects.slice(0, INITIAL_VISIBLE);

  /* ----- Render ----- */
  return (
    // Read-only, so no "discard changes?" (its search box is just a filter)
    <ModalShell onClose={onClose} size="xl" labelledBy="faculty-modal-title" guardDirty={false} focusFirstField={false}>
        {/* Header */}
        <div className="relative flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-5 sm:rounded-t-2xl sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-white/90 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4 pr-10">
            <div className="relative flex-shrink-0">
              {imgSrc && !imgFailed ? (
                <img
                  src={imgSrc}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-white/40"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white ring-2 ring-white/40">
                  {initials}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-blue-600 ${faculty.isActive ? 'bg-emerald-400' : 'bg-gray-400'}`}
                title={faculty.isActive ? 'Active' : 'Inactive'}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 id="faculty-modal-title" className="truncate text-xl font-bold text-white sm:text-2xl">
                {fullName}
              </h2>
              <p className="truncate text-sm text-blue-100">
                {faculty.position || 'Instructor'}
                {faculty.employeeId && <span className="opacity-80"> · {faculty.employeeId}</span>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${faculty.isActive ? 'bg-emerald-400/20 text-emerald-50 ring-emerald-300/50' : 'bg-white/15 text-white ring-white/30'}`}>
                  {faculty.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-white/30">
                  {faculty.employmentType || 'Regular'}
                </span>
                {faculty.administrativeDesignation && (
                  <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
                    {faculty.administrativeDesignation}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800 sm:px-5" role="tablist" aria-label="Faculty details">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700 ${
                  active
                    ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {id === 'expertise' && subjectExperience.length > 0 && (
                  <span className={`rounded-full px-1.5 text-[11px] ${active ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {subjectExperience.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/60 sm:p-6" role="tabpanel">
          {/* ================= OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard icon={TrendingUp} tone="blue" value={currentLoad} unit={`of ${maxLoad} hrs / week`} label="Load" />
                <StatCard icon={BookOpen} tone="purple" value={subjectExperience.length} unit="different subjects taught" label="Subjects" />
                <StatCard
                  icon={Star}
                  tone="amber"
                  value={overallRating ? overallRating.toFixed(1) : '—'}
                  unit={overallRating ? 'average out of 5' : 'no ratings yet'}
                  label="Rating"
                />
                <StatCard
                  icon={Clock}
                  tone="green"
                  value={yearsTeaching || '—'}
                  unit={yearsTeaching ? (yearsTeaching === 1 ? 'year of teaching' : 'years of teaching') : 'no history yet'}
                  label="Experience"
                />
              </div>

              {/* Workload */}
              <Section
                icon={TrendingUp}
                title="Workload"
                tone="blue"
                right={
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.chip}`}>
                    {status.label}
                  </span>
                }
              >
                <div className="flex items-end justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {currentLoad} / {maxLoad} hours
                    </span>
                    {positionHours > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Teaching: {faculty.currentTeachingHours || 0}h + Position: {positionHours}h
                      </span>
                    )}
                  </div>
                  <span className={`text-2xl font-bold ${status.text}`}>{Math.round(rawPercent)}%</span>
                </div>
                <div
                  className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(loadPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full ${status.bar} transition-all duration-500 ease-out rounded-full`}
                    style={{ width: `${loadPercent}%` }}
                  />
                  {/* Where the teacher's max sits */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-gray-500/70" style={{ left: `${(maxLoad / barScale) * 100}%` }} title={`Max ${maxLoad} hrs`} />
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {remaining >= 0
                    ? `${remaining} hour${remaining === 1 ? '' : 's'} of capacity remaining`
                    : `Overloaded by ${Math.abs(remaining)} hour${Math.abs(remaining) === 1 ? '' : 's'}`}
                </p>
                {currentLoad > maxLoad + LOAD_ALLOWANCE && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
                      Exceeds the weekly maximum — consider reassigning a section.
                    </p>
                  </div>
                )}
              </Section>

              {/* Basic info */}
              <Section icon={User} title="Basic Information">
                <div className="grid sm:grid-cols-2 gap-4">
                  <InfoRow icon={Mail} label="Email" color="blue">
                    <div className="flex items-center gap-2 min-w-0">
                      {faculty.user?.email ? (
                        <>
                          <a
                            href={`mailto:${faculty.user.email}`}
                            className="truncate text-blue-700 dark:text-blue-300 hover:underline"
                          >
                            {faculty.user.email}
                          </a>
                          <button
                            onClick={handleCopyEmail}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0"
                            aria-label="Copy email"
                            title="Copy email"
                          >
                            {copied ? (
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400">Not provided</span>
                      )}
                    </div>
                  </InfoRow>
                  <InfoRow icon={MapPin} label="Position" color="indigo">
                    {faculty.position || 'Instructor'}
                  </InfoRow>
                  <InfoRow icon={Briefcase} label="Employment Type" color="purple">
                    {faculty.employmentType || 'Regular'}
                  </InfoRow>
                  <InfoRow icon={TrendingUp} label="Max Load" color="blue">
                    {maxLoad} hours/week
                  </InfoRow>
                  {faculty.administrativeDesignation && (
                    <InfoRow icon={Award} label="Administrative Role" color="amber">
                      {faculty.administrativeDesignation}
                    </InfoRow>
                  )}
                </div>
              </Section>

              {(specializations.length > 0 || programs.length > 0) && (
                <Section icon={BookOpen} title="Programs & specializations">
                  {programs.length > 0 && (
                    <div className={specializations.length > 0 ? 'mb-3' : ''}>
                      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Qualified to teach in</p>
                      <div className="flex flex-wrap gap-1.5">
                        {programs.map((p) => (
                          <span key={p} className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {specializations.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Specializations</p>
                      <div className="flex flex-wrap gap-1.5">
                        {specializations.map((spec) => (
                          <span key={spec} className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">{spec}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}
            </>
          )}

          {/* ================= EDUCATION ================= */}
          {activeTab === 'education' && (
            <>
              {hasDegrees && (
                <Section icon={GraduationCap} title="Educational Background" tone="indigo">
                  <div className="space-y-3">
                    <DegreeCard badge="BS" degree={faculty.bachelorsDegree} color="blue" />
                    <DegreeCard badge="MS" degree={faculty.mastersDegree} color="purple" />
                    <DegreeCard badge="PhD" degree={faculty.doctoralDegree} color="green" />
                  </div>
                  {faculty.specialTraining && (
                    <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Special Training &amp; Certifications
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line">
                        {faculty.specialTraining}
                      </p>
                    </div>
                  )}
                </Section>
              )}

              {hasQualifications && (
                <Section
                  icon={Award}
                  title="Qualifications"
                  right={
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      {faculty.qualifications.length} on record
                    </span>
                  }
                >
                  <ol className="relative border-l-2 border-blue-200 dark:border-blue-800 ml-2 space-y-3">
                    {[...faculty.qualifications]
                      .sort((a, b) => (b.yearObtained || 0) - (a.yearObtained || 0))
                      .map((qual, idx) => (
                        <li key={idx} className="ml-5 relative">
                          <span className="absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-800" />
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white">{qual.degree}</p>
                                {qual.field && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{qual.field}</p>
                                )}
                                {qual.institution && (
                                  <p className="text-xs text-gray-500 mt-1">{qual.institution}</p>
                                )}
                              </div>
                              {qual.yearObtained && (
                                <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold rounded-lg flex-shrink-0">
                                  {qual.yearObtained}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                  </ol>
                </Section>
              )}

              {!hasDegrees && !hasQualifications && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No educational records yet.</p>
                  <p className="text-xs mt-1">Use “Edit Profile” to add degrees and qualifications.</p>
                </div>
              )}
            </>
          )}

          {/* ================= TEACHING EXPERTISE ================= */}
          {activeTab === 'expertise' && (
            <>
              {subjectExperience.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No teaching history recorded.</p>
                </div>
              ) : (
                <>
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {subjectExperience.length} subjects · {faculty.teachingHistory?.length || 0} semesters
                    </span>
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      {activeRecently} taught recently
                    </span>
                    {staleCount > 0 && (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {staleCount} need refresher
                      </span>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setShowAll(true);
                        }}
                        placeholder="Search subject, code or program…"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Sort subjects"
                    >
                      {SORTS.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    {staleCount > 0 && (
                      <button
                        onClick={() => setOnlyStale((v) => !v)}
                        className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                          onlyStale
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        Stale only
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Experience points are weighted by recency and decay 15% per year.
                  </p>

                  {/* Subject cards */}
                  {filteredSubjects.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-8">No subjects match your filters.</p>
                  ) : (
                    <div className="space-y-3">
                      {visibleSubjects.map((s, index) => {
                        const maxExp = Math.max(5, ...subjectExperience.map((x) => x.weightedExperience));
                        const pct = Math.min(100, (s.weightedExperience / maxExp) * 100);
                        const recent = s.lastTaughtYearsAgo <= 1;
                        const isTop3 = sortBy === 'experience' && !query && !onlyStale && index < 3;
                        const tone = s.isStale
                          ? { card: 'bg-amber-50/60 border-amber-300 dark:bg-amber-900/10 dark:border-amber-700/50', bar: 'from-amber-400 to-orange-500', txt: 'text-amber-700 dark:text-amber-400' }
                          : recent
                          ? { card: 'bg-green-50/60 border-green-300 dark:bg-green-900/10 dark:border-green-700/50', bar: 'from-green-400 to-emerald-500', txt: 'text-green-700 dark:text-green-400' }
                          : { card: 'bg-white/60 border-gray-300 dark:bg-gray-800/30 dark:border-gray-600', bar: 'from-blue-400 to-indigo-500', txt: 'text-gray-600 dark:text-gray-400' };

                        return (
                          <div
                            key={s.key}
                            className={`rounded-xl p-4 border transition-shadow hover:shadow-lg ${tone.card} ${
                              isTop3 ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div
                                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                    isTop3
                                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                      {s.subjectCode || s.subjectName}
                                    </p>
                                    {s.program && (
                                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                        {s.program}
                                      </span>
                                    )}
                                  </div>
                                  {s.subjectCode && s.subjectName && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{s.subjectName}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg font-black text-gray-900 dark:text-white leading-none">
                                  {s.weightedExperience.toFixed(1)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">exp pts</p>
                              </div>
                            </div>

                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">
                                  {s.timesTaught}× taught
                                </span>
                                <span className={`font-bold ${tone.txt}`}>
                                  Last: {describeRecency(s.lastTaughtYearsAgo)}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${tone.bar}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {s.avgRating ? (
                              <div className="flex items-center gap-2 mb-3">
                                <Stars value={s.avgRating} />
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                  {s.avgRating.toFixed(1)}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">avg rating</span>
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-1.5">
                              {s.occurrences.slice(0, 6).map((o, i) => (
                                <div
                                  key={i}
                                  title={`Sem ${o.semester || '?'} · ${o.academicYear} (${describeRecency(o.yearsAgo)})`}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${
                                    o.yearsAgo === 0
                                      ? 'bg-green-600 text-white shadow-sm'
                                      : o.yearsAgo === 1
                                      ? 'bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100'
                                      : o.yearsAgo >= STALE_AFTER_YEARS
                                      ? 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                  }`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>{o.academicYear}</span>
                                  {o.rating && <span className="ml-0.5">★{o.rating}</span>}
                                </div>
                              ))}
                              {s.occurrences.length > 6 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                  +{s.occurrences.length - 6} more
                                </span>
                              )}
                            </div>

                            {s.isStale && (
                              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                                  Last taught {s.lastTaughtYearsAgo} years ago — may need a refresher
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {filteredSubjects.length > INITIAL_VISIBLE && !query && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      {showAll ? (
                        <>Show less <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Show all {filteredSubjects.length} subjects <ChevronDown className="w-4 h-4" /></>
                      )}
                    </button>
                  )}

                  {/* Legend */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Legend</p>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" />Recent (0–1 yr)</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" />2–{STALE_AFTER_YEARS - 1} yrs ago</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" />Stale ({STALE_AFTER_YEARS}+ yrs)</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <ModalFooter>
          <ModalButton variant="secondary" onClick={onClose}>Close</ModalButton>
          {onEdit && <ModalButton icon={Edit2} onClick={onEdit}>Edit profile</ModalButton>}
        </ModalFooter>
    </ModalShell>
  );
};

export default FacultyDetailsModal;