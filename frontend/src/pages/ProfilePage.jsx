import React, { useState, useEffect, useMemo } from 'react';
import { authAPI, facultyAPI, subjectAPI, getErrorMessage } from '../services/api';
import useCachedData from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import AvatarUpload from '../components/AvatarUpload';
import { useAuth } from '../context/AuthContext';
import {
  X, Plus, Star, Loader2, User, Info, GraduationCap, BookOpen, CalendarClock,
  FlaskConical, CheckCircle2, Circle, Lock, Briefcase, AlertTriangle, Sparkles,
} from 'lucide-react';
import ctuBg from '../assets/images/backgrounds/ctu-bg.jpg';
import { profileChecklist } from '../utils/profileCompleteness';

/* ---------- shared styles ---------- */
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 ' +
  'transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ' +
  'dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500';

const readOnlyClass =
  'w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500 ' +
  'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400';

const ghostButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 transition ' +
  'hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' +
  'dark:text-blue-300 dark:hover:bg-blue-900/30';

const ROLE_LABELS = {
  admin: 'Administrator',
  scheduling_officer: 'Scheduling Officer',
  program_manager: 'Program Manager',
  faculty: 'Faculty',
  student: 'Student',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Last-taught choices; the stored value is the label, as the import wrote it. */
const PERIODS = ['this year', 'last year', '2 years ago', '3 years ago', '4 years ago', '5 years ago', '6+ years ago'];

/** What each self-rating means, so teachers rate on the same scale. */
const SELF_RATING_LABELS = {
  1: 'Beginner: I’d need to prepare a lot',
  2: 'Basic: I can teach it with preparation',
  3: 'Competent: comfortable teaching it',
  4: 'Proficient: I teach it well',
  5: 'Expert: one of my strongest subjects',
};

const blankDegree = { degree: '', major: '', minor: '' };

const defaultFacultyForm = {
  specializations: [],
  qualifications: [],
  experiencedSubjects: [],
  bachelorsDegree: blankDegree,
  mastersDegree: blankDegree,
  doctoralDegree: blankDegree,
  specialTraining: '',
  researchInvolvement: '',
  extensionInvolvement: '',
  productionInvolvement: '',
  preferredTimeSlots: [],
  unavailableTimeSlots: [],
};

const blankQualification = { degree: '', field: '', institution: '', yearObtained: '' };
const blankSubject = { subjectCode: '', frequency: '', period: '', selfRating: 0 };
const blankSlot = { day: 'Monday', startTime: '07:30', endTime: '12:00', reason: '' };

/** Only what a teacher may change; the rest is the scheduling office's. */
const toFacultyForm = (f) => ({
  specializations: f.specializations || [],
  qualifications: f.qualifications || [],
  experiencedSubjects: (f.experiencedSubjects || []).map((s) => ({
    subjectCode: s.subjectCode || '',
    frequency: s.frequency || '',
    period: s.period || '',
    selfRating: s.selfRating || 0,
    // Read-only, shown as "on record"
    semestersTaught: s.semestersTaught || 0,
    rating: s.rating || 0,
  })),
  bachelorsDegree: { ...blankDegree, ...(f.bachelorsDegree || {}) },
  mastersDegree: { ...blankDegree, ...(f.mastersDegree || {}) },
  doctoralDegree: { ...blankDegree, ...(f.doctoralDegree || {}) },
  specialTraining: f.specialTraining || '',
  researchInvolvement: f.researchInvolvement || '',
  extensionInvolvement: f.extensionInvolvement || '',
  productionInvolvement: f.productionInvolvement || '',
  preferredTimeSlots: (f.preferredTimeSlots || []).map(({ day, startTime, endTime }) => ({ day, startTime, endTime })),
  unavailableTimeSlots: (f.unavailableTimeSlots || []).map(({ day, startTime, endTime, reason }) => ({ day, startTime, endTime, reason: reason || '' })),
});

/** A subject with semesters or an evaluation on record came from the office. */
const isRecorded = (s) => s.semestersTaught > 0 || s.rating > 0;

/* ---------- small building blocks ---------- */
const Section = ({ id, icon: Icon, title, description, badge, children }) => (
  <section id={id} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
    <header className="mb-5 flex items-start gap-3">
      {Icon && (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          {badge}
        </div>
        {description && <p className="mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </header>
    <div className="space-y-5">{children}</div>
  </section>
);

const Field = ({ id, label, hint, children }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>
);

const TagInput = ({ id, label, items, onAdd, onRemove, placeholder }) => {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft('');
  };

  return (
    <Field id={id} label={label} hint="Press Enter or comma to add.">
      {items.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 py-1 pl-3 pr-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item}`}
                className="rounded p-1 text-blue-500 transition hover:bg-blue-100 hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-800/50 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        className={inputClass}
      />
    </Field>
  );
};

const RemoveButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="rounded p-1 text-gray-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
  >
    <X className="h-4 w-4" />
  </button>
);

const EmptyNote = ({ children }) => (
  <p className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
    {children}
  </p>
);

/** 1-5 stars the teacher clicks; clicking the current value clears it. */
const StarRating = ({ value, onChange, label }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex items-center" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5: ${SELF_RATING_LABELS[n]}`}
            title={SELF_RATING_LABELS[n]}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? 0 : n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <Star className={`h-6 w-6 ${n <= shown ? 'fill-orange-400 text-orange-400' : 'text-gray-300 dark:text-gray-600'}`} />
          </button>
        ))}
      </div>
      <span className={`text-xs ${shown ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-orange-700 dark:text-orange-400'}`}>
        {shown ? SELF_RATING_LABELS[shown] : 'Not rated yet: how well can you teach this?'}
      </span>
    </div>
  );
};

/** Progress ring for the profile completeness card. */
const Ring = ({ percent }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = percent >= 100 ? 'text-emerald-500' : percent >= 60 ? 'text-blue-500' : 'text-orange-500';
  return (
    <div className="relative h-16 w-16 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-gray-200 dark:stroke-gray-700" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className={`stroke-current ${tone} transition-all duration-500`}
          strokeDasharray={c} strokeDashoffset={c - (c * percent) / 100} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white">{percent}%</span>
    </div>
  );
};

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/* ---------- page ---------- */
const ProfilePage = () => {
  const [facultyData, setFacultyData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phoneNumber: '',
    address: '',
    bio: '',
    displayNameFormat: 'full'
  });
  const [facultyFormData, setFacultyFormData] = useState(defaultFacultyForm);
  // Last-saved snapshot, used to detect unsaved changes and to support "Discard"
  const [initial, setInitial] = useState(null);

  const { loadUser } = useAuth();

  const {
    data: profileResponse,
    loading,
    refetch: reloadProfile,
  } = useCachedData(
    () => authAPI.getMe(),
    'user-profile',
    {
      cacheDuration: 10 * 60 * 1000, // 10 minutes
      enabled: true,
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Could not load your profile. Refresh the page to try again.'));
      }
    }
  );

  // Extract user data
  const user = React.useMemo(() => {
    if (!profileResponse) return null;
    const data = profileResponse.data || profileResponse;
    return data?.data || data || null;
  }, [profileResponse]);

  const facultyId = user?.role === 'faculty' && user.facultyProfile
    ? (user.facultyProfile._id || user.facultyProfile)
    : null;

  // Fetch faculty profile when user data is available and user is faculty
  useEffect(() => {
    const loadFacultyProfile = async () => {
      if (!user) return;

      const form = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        middleName: user.middleName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        bio: user.bio || '',
        displayNameFormat: user.displayNameFormat || 'full'
      };

      setFormData(form);

      let facultyForm = defaultFacultyForm;
      let faculty = null;

      if (facultyId) {
        try {
          const facultyResponse = await facultyAPI.getById(facultyId);
          faculty = facultyResponse.data.data;
          facultyForm = toFacultyForm(faculty);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Could not load your teaching profile.'));
        }
      }

      setFacultyData(faculty);
      setFacultyFormData(facultyForm);
      setInitial({ form, faculty: facultyForm });
    };

    loadFacultyProfile();
  }, [user, facultyId]);

  // Subject codes and names, for suggestions while adding expertise
  useEffect(() => {
    if (!facultyId) return;
    subjectAPI.getAll({ limit: 1000 })
      .then((res) => setSubjects(res.data.data || []))
      .catch(() => {});
  }, [facultyId]);

  const subjectNames = useMemo(() => {
    const names = { ...(facultyData?.subjectNames || {}) };
    subjects.forEach((s) => { if (s.subjectCode) names[s.subjectCode] = s.subjectName; });
    return names;
  }, [subjects, facultyData]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      JSON.stringify(formData) !== JSON.stringify(initial.form) ||
      JSON.stringify(facultyFormData) !== JSON.stringify(initial.faculty)
    );
  }, [formData, facultyFormData, initial]);

  /* ----- handlers ----- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const setFacultyField = (key, value) => setFacultyFormData((prev) => ({ ...prev, [key]: value }));

  const setDegree = (key, field, value) =>
    setFacultyFormData((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const addTag = (key) => (value) =>
    setFacultyFormData((prev) =>
      prev[key].includes(value) ? prev : { ...prev, [key]: [...prev[key], value] }
    );

  const removeAt = (key, index) =>
    setFacultyFormData((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));

  const addRow = (key, blank) =>
    setFacultyFormData((prev) => ({ ...prev, [key]: [...prev[key], { ...blank }] }));

  const updateRow = (key, index, field, value) =>
    setFacultyFormData((prev) => ({
      ...prev,
      [key]: prev[key].map((row, i) => (i === index ? { ...row, [field]: value } : row))
    }));

  // There is no setUser in this component (the user comes from the cached
  // profile query), so refresh the profile and the signed-in user instead,
  // so the new photo shows here and in the header.
  const handleAvatarUpdate = (updatedUser) => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...storedUser, ...updatedUser }));
    reloadProfile();
    loadUser();
  };

  const handleDiscard = () => {
    if (!initial) return;
    setFormData(initial.form);
    setFacultyFormData(initial.faculty);
  };

  const slotProblem = (slots, label) => {
    const bad = slots.find((s) => !s.startTime || !s.endTime || s.startTime >= s.endTime);
    return bad ? `${label}: ${bad.day} must end after it starts.` : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (facultyId) {
      const problem = slotProblem(facultyFormData.preferredTimeSlots, 'Preferred times')
        || slotProblem(facultyFormData.unavailableTimeSlots, 'Unavailable times');
      if (problem) {
        toast.error(problem);
        scrollTo('availability');
        return;
      }
    }

    setSaving(true);
    try {
      // The teaching profile goes first: it's the one with rules the server
      // can refuse, and saving the name before it used to leave half a save
      if (facultyId) {
        const f = facultyFormData;
        // Drop empty rows so half-filled "Add" clicks don't get saved. Only
        // the fields a teacher may change are sent - programs and the load
        // limit used to go along too, and the server refused the whole save.
        await facultyAPI.update(facultyId, {
          specializations: f.specializations,
          qualifications: f.qualifications
            .filter((q) => [q.degree, q.field, q.institution, q.yearObtained].some((v) => String(v ?? '').trim()))
            .map((q) => ({ ...q, yearObtained: q.yearObtained === '' ? undefined : Number(q.yearObtained) })),
          experiencedSubjects: f.experiencedSubjects
            .filter((s) => (s.subjectCode || '').trim())
            .map(({ subjectCode, frequency, period, selfRating }) => ({ subjectCode: subjectCode.trim(), frequency, period, selfRating })),
          bachelorsDegree: f.bachelorsDegree,
          mastersDegree: f.mastersDegree,
          doctoralDegree: f.doctoralDegree,
          specialTraining: f.specialTraining,
          researchInvolvement: f.researchInvolvement,
          extensionInvolvement: f.extensionInvolvement,
          productionInvolvement: f.productionInvolvement,
          preferredTimeSlots: f.preferredTimeSlots,
          unavailableTimeSlots: f.unavailableTimeSlots,
        });
      }

      await authAPI.updateProfile(formData);

      toast.success('Changes saved');
      await reloadProfile(); // refresh profile data
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save your changes. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  /* ----- derived ----- */
  const isFaculty = !!facultyId && !!facultyData;
  const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Your profile';
  const displayOptions = [
    { value: 'first', label: formData.firstName || 'First name' },
    { value: 'full', label: [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'First Last' },
    {
      value: 'last-first',
      label: [formData.lastName, formData.firstName].filter(Boolean).join(', ') || 'Last, First'
    }
  ];

  const expertise = facultyFormData.experiencedSubjects.filter((s) => (s.subjectCode || '').trim());
  const unrated = expertise.filter((s) => !s.selfRating);

  /**
   * What the profile still needs. Required items count toward the
   * percentage; recommended ones are listed but don't hold it back.
   */
  const checklist = useMemo(() => profileChecklist({
    profilePicture: user?.profilePicture,
    phoneNumber: formData.phoneNumber,
    bio: formData.bio,
    faculty: isFaculty ? facultyFormData : null,
  }), [user, formData, facultyFormData, isFaculty]);

  const required = checklist.filter((i) => !i.recommended);
  const percent = required.length ? Math.round((required.filter((i) => i.done).length / required.length) * 100) : 100;
  const todo = checklist.filter((i) => !i.done);

  const navItems = [
    { id: 'personal', label: 'Personal information', icon: User },
    { id: 'about', label: 'About you', icon: Info },
    ...(isFaculty ? [
      { id: 'teaching', label: 'Teaching assignment', icon: Briefcase },
      { id: 'education', label: 'Education', icon: GraduationCap },
      { id: 'expertise', label: 'Subject expertise', icon: BookOpen, count: unrated.length },
      { id: 'availability', label: 'Availability', icon: CalendarClock },
      { id: 'research', label: 'Research & extension', icon: FlaskConical },
    ] : []),
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center" role="status" aria-label="Loading profile">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  const slotEditor = (key, { withReason }) => (
    <>
      {facultyFormData[key].length === 0 && (
        <EmptyNote>{withReason ? 'No blocked times. You can be scheduled any time the school is open.' : 'No preference.'}</EmptyNote>
      )}
      {facultyFormData[key].map((slot, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
          <select aria-label="Day" value={slot.day} onChange={(e) => updateRow(key, index, 'day', e.target.value)} className={`${inputClass} w-36`}>
            {DAYS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <input aria-label="From" type="time" step="1800" value={slot.startTime} onChange={(e) => updateRow(key, index, 'startTime', e.target.value)} className={`${inputClass} w-32`} />
          <span className="text-sm text-gray-500">to</span>
          <input aria-label="Until" type="time" step="1800" value={slot.endTime} onChange={(e) => updateRow(key, index, 'endTime', e.target.value)} className={`${inputClass} w-32`} />
          {withReason && (
            <input aria-label="Reason" value={slot.reason} onChange={(e) => updateRow(key, index, 'reason', e.target.value)} placeholder="Reason (optional)" className={`${inputClass} min-w-[10rem] flex-1`} />
          )}
          <RemoveButton label={`Remove ${slot.day} ${slot.startTime}`} onClick={() => removeAt(key, index)} />
          {slot.startTime >= slot.endTime && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">The end time must be after the start time.</p>
          )}
        </div>
      ))}
      <button type="button" onClick={() => addRow(key, blankSlot)} className={ghostButtonClass}>
        <Plus className="h-4 w-4" /> {withReason ? 'Add unavailable time' : 'Add preferred time'}
      </button>
    </>
  );

  return (
    <Layout>
      {/* Cover */}
      <div id="top" className="relative h-36 overflow-hidden rounded-2xl bg-cover bg-center md:h-48" style={{ backgroundImage: `url(${ctuBg})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 to-gray-900/10" />
      </div>

      <div className="mx-auto max-w-6xl px-2 pb-32 sm:px-4">
        {/* Identity: avatar overlaps the cover, name sits beside it */}
        <div className="-mt-14 flex flex-col gap-4 md:-mt-16 md:flex-row md:items-end">
          <div className="shrink-0">
            <AvatarUpload user={user} onUpdate={handleAvatarUpdate} />
          </div>
          <div className="min-w-0 flex-1 md:pb-2">
            <h1 className="truncate text-2xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{formData.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
              {isFaculty && facultyData.position && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{facultyData.position}</span>
              )}
              {(isFaculty ? facultyData.programs || [] : [user?.program].filter(Boolean)).map((p) => (
                <span key={p} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{p}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          {/* Side: completeness + section links */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <Ring percent={percent} />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {percent >= 100 ? 'Profile complete' : 'Complete your profile'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {todo.length ? `${todo.length} thing${todo.length === 1 ? '' : 's'} left` : 'Nothing missing'}
                  </p>
                </div>
              </div>
              {checklist.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {checklist.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => scrollTo(item.target)}
                        title={item.why}
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-gray-50 dark:hover:bg-gray-700/60"
                      >
                        {item.done
                          ? <CheckCircle2 className="mt-px h-4 w-4 flex-shrink-0 text-emerald-500" />
                          : <Circle className={`mt-px h-4 w-4 flex-shrink-0 ${item.recommended ? 'text-gray-400' : 'text-orange-500'}`} />}
                        <span className={item.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}>
                          {item.label}
                          {item.recommended && !item.done && <span className="ml-1 text-gray-400">(optional)</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {navItems.length > 2 && (
              <nav aria-label="Profile sections" className="hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:block">
                {navItems.map(({ id, label, icon: Icon, count }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollTo(id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60"
                  >
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="flex-1">{label}</span>
                    {count > 0 && <span className="rounded-full bg-orange-100 px-1.5 text-[11px] font-semibold text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">{count}</span>}
                  </button>
                ))}
              </nav>
            )}
          </aside>

          <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
            {/* Personal information */}
            <Section id="personal" icon={User} title="Personal information" description="Your name and contact details.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="firstName" label="First name">
                  <input id="firstName" name="firstName" type="text" value={formData.firstName} onChange={handleChange} className={inputClass} autoComplete="given-name" />
                </Field>
                <Field id="lastName" label="Last name">
                  <input id="lastName" name="lastName" type="text" value={formData.lastName} onChange={handleChange} className={inputClass} autoComplete="family-name" />
                </Field>
                <Field id="email" label="Username" hint="Your username is your school email and can't be changed here.">
                  <input id="email" name="email" type="text" value={formData.email} className={readOnlyClass} readOnly />
                </Field>
                <Field id="phoneNumber" label="Phone number" hint={isFaculty ? 'Shown to the scheduling office on your faculty profile.' : undefined}>
                  <input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleChange} className={inputClass} placeholder="09XX XXX XXXX" autoComplete="tel" />
                </Field>
              </div>
              {/* NOTE: bound to `address` in the API, but labelled as skills. Rename one side when you can. */}
              <Field id="address" label="Skills / occupation">
                <input id="address" name="address" type="text" value={formData.address} onChange={handleChange} className={inputClass} placeholder="e.g. UX designer, full-stack developer" />
              </Field>
            </Section>

            {/* About */}
            <Section id="about" icon={Info} title="About you" description="A short bio and how your name appears to others.">
              <Field id="bio" label="Bio">
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  maxLength={500}
                  className={`${inputClass} resize-y leading-relaxed`}
                  placeholder="Write a few sentences about your background and interests."
                />
                <p className="mt-1.5 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {formData.bio.length} / 500
                </p>
              </Field>
              <Field
                id="displayNameFormat"
                label="Show my name as"
                hint="Used on certificates and anywhere your name is listed publicly, such as instructor and author fields."
              >
                <select id="displayNameFormat" name="displayNameFormat" value={formData.displayNameFormat} onChange={handleChange} className={inputClass}>
                  {displayOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            {isFaculty && (
              <>
                {/* Teaching assignment: the office's fields, read-only */}
                <Section
                  id="teaching"
                  icon={Briefcase}
                  title="Teaching assignment"
                  description="Set by the scheduling office. Ask them if something here is wrong."
                  badge={<span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"><Lock className="h-3 w-3" /> Read-only</span>}
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
                    {[
                      ['Employee ID', facultyData.employeeId],
                      ['Department', facultyData.department],
                      ['Position', facultyData.position],
                      ['Employment', facultyData.employmentType],
                      ['Max teaching load', `${facultyData.maxTeachingHours || 36} hrs/week`],
                      ['Current load', `${facultyData.currentTeachingHours || 0} hrs/week · ${facultyData.assignedClasses || 0} classes`],
                    ].map(([term, value]) => (
                      <div key={term} className="min-w-0">
                        <dt className="text-xs text-gray-500 dark:text-gray-400">{term}</dt>
                        <dd className="mt-0.5 truncate font-medium text-gray-900 dark:text-white">{value || '—'}</dd>
                      </div>
                    ))}
                    <div className="col-span-2 sm:col-span-3">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Programs you teach in</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {(facultyData.programs || []).length
                          ? facultyData.programs.map((p) => (
                            <span key={p} className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">{p}</span>
                          ))
                          : <span className="text-gray-400">None yet</span>}
                      </dd>
                    </div>
                  </dl>
                  <TagInput
                    id="specializations"
                    label="Your specializations"
                    items={facultyFormData.specializations}
                    onAdd={addTag('specializations')}
                    onRemove={(i) => removeAt('specializations', i)}
                    placeholder="e.g. Web development"
                  />
                </Section>

                {/* Education */}
                <Section id="education" icon={GraduationCap} title="Education" description="Your degrees. The scheduling office uses these to check which subjects you’re qualified for.">
                  {[
                    ['bachelorsDegree', 'Bachelor’s degree', 'e.g. BSIT'],
                    ['mastersDegree', 'Master’s degree', 'e.g. MSIT'],
                    ['doctoralDegree', 'Doctoral degree', 'e.g. PhD'],
                  ].map(([key, label, example]) => (
                    <fieldset key={key} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</legend>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <input aria-label={`${label}: degree`} className={inputClass} placeholder={`Degree (${example})`} value={facultyFormData[key].degree} onChange={(e) => setDegree(key, 'degree', e.target.value)} />
                        <input aria-label={`${label}: major`} className={inputClass} placeholder="Major" value={facultyFormData[key].major} onChange={(e) => setDegree(key, 'major', e.target.value)} />
                        <input aria-label={`${label}: minor`} className={inputClass} placeholder="Minor (optional)" value={facultyFormData[key].minor} onChange={(e) => setDegree(key, 'minor', e.target.value)} />
                      </div>
                    </fieldset>
                  ))}

                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Other qualifications</p>
                    <div className="space-y-3">
                      {facultyFormData.qualifications.map((qual, index) => (
                        <div key={index} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                            <input aria-label="Degree" className={inputClass} placeholder="Degree or certificate" value={qual.degree || ''} onChange={(e) => updateRow('qualifications', index, 'degree', e.target.value)} />
                            <input aria-label="Field of study" className={inputClass} placeholder="Field of study" value={qual.field || ''} onChange={(e) => updateRow('qualifications', index, 'field', e.target.value)} />
                            <input aria-label="Institution" className={inputClass} placeholder="Institution" value={qual.institution || ''} onChange={(e) => updateRow('qualifications', index, 'institution', e.target.value)} />
                            <input aria-label="Year obtained" type="number" className={inputClass} placeholder="Year obtained" value={qual.yearObtained || ''} onChange={(e) => updateRow('qualifications', index, 'yearObtained', e.target.value)} />
                          </div>
                          <RemoveButton label={`Remove qualification ${index + 1}`} onClick={() => removeAt('qualifications', index)} />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => addRow('qualifications', blankQualification)} className={`${ghostButtonClass} mt-2`}>
                      <Plus className="h-4 w-4" /> Add qualification
                    </button>
                  </div>

                  <Field id="specialTraining" label="Special training & certifications">
                    <textarea id="specialTraining" rows={3} value={facultyFormData.specialTraining} onChange={(e) => setFacultyField('specialTraining', e.target.value)} className={`${inputClass} resize-y`} placeholder="e.g. CCNA (2023), TESDA NC II in Computer Systems Servicing" />
                  </Field>
                </Section>

                {/* Subject expertise with self-rating */}
                <Section
                  id="expertise"
                  icon={BookOpen}
                  title="Subject expertise"
                  description="Subjects you’ve taught, and how well you can teach each one. Your self-rating helps the scheduling office give you subjects you’re strong in."
                  badge={expertise.length > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${unrated.length ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                      {expertise.length - unrated.length} of {expertise.length} rated
                    </span>
                  )}
                >
                  <details className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
                    <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">How should I rate myself?</summary>
                    <ul className="mt-2 space-y-1">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <li key={n} className="flex items-center gap-2">
                          <span className="inline-flex w-16 text-orange-500">{'★'.repeat(n)}<span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - n)}</span></span>
                          {SELF_RATING_LABELS[n]}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">Semesters taught and evaluation ratings come from school records and can’t be edited here.</p>
                  </details>

                  {facultyFormData.experiencedSubjects.length === 0 && (
                    <EmptyNote>No subjects yet. Add the subjects you’ve taught before.</EmptyNote>
                  )}

                  <datalist id="subject-codes">
                    {subjects.map((s) => <option key={s._id} value={s.subjectCode}>{s.subjectName}</option>)}
                  </datalist>

                  <div className="space-y-3">
                    {facultyFormData.experiencedSubjects.map((subject, index) => {
                      const recorded = isRecorded(subject);
                      const name = subjectNames[subject.subjectCode?.trim()];
                      return (
                        <div
                          key={index}
                          className={`rounded-xl border p-4 transition-colors ${
                            subject.subjectCode && !subject.selfRating
                              ? 'border-orange-300 bg-orange-50/40 dark:border-orange-700/60 dark:bg-orange-900/10'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {subject.subjectCode || `New subject`}
                                {name && <span className="font-normal text-gray-500 dark:text-gray-400"> · {name}</span>}
                              </p>
                              {recorded && (
                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    <Lock className="h-3 w-3" /> On record
                                  </span>
                                  {subject.semestersTaught > 0 && <span>{subject.semestersTaught} semesters taught</span>}
                                  {subject.rating > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                                      {subject.rating}/5 evaluation
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            {!recorded && (
                              <RemoveButton label={`Remove ${subject.subjectCode || `subject ${index + 1}`}`} onClick={() => removeAt('experiencedSubjects', index)} />
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {recorded ? (
                              <input aria-label="Subject code" className={readOnlyClass} value={subject.subjectCode} readOnly />
                            ) : (
                              <input aria-label="Subject code" list="subject-codes" className={inputClass} placeholder="Subject code (e.g. CC 214)" value={subject.subjectCode || ''} onChange={(e) => updateRow('experiencedSubjects', index, 'subjectCode', e.target.value)} />
                            )}
                            <input aria-label="Times taught" className={inputClass} placeholder="Times taught (e.g. 3x)" value={subject.frequency || ''} onChange={(e) => updateRow('experiencedSubjects', index, 'frequency', e.target.value)} />
                            <select aria-label="Last taught" className={inputClass} value={subject.period || ''} onChange={(e) => updateRow('experiencedSubjects', index, 'period', e.target.value)}>
                              <option value="">Last taught…</option>
                              {[...new Set([subject.period, ...PERIODS].filter(Boolean))].map((p) => <option key={p} value={p}>Last taught {p}</option>)}
                            </select>
                          </div>

                          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700/70">
                            <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Your self-rating</p>
                            <StarRating
                              label={`Self-rating for ${subject.subjectCode || 'this subject'}`}
                              value={subject.selfRating || 0}
                              onChange={(v) => updateRow('experiencedSubjects', index, 'selfRating', v)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => addRow('experiencedSubjects', blankSubject)} className={ghostButtonClass}>
                    <Plus className="h-4 w-4" /> Add subject
                  </button>
                </Section>

                {/* Availability */}
                <Section id="availability" icon={CalendarClock} title="Availability" description="When you can and can’t teach. The schedule generator never puts your classes in your unavailable times.">
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <AlertTriangle className="h-4 w-4 text-red-500" /> Unavailable
                    </p>
                    <div className="space-y-2">{slotEditor('unavailableTimeSlots', { withReason: true })}</div>
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Sparkles className="h-4 w-4 text-emerald-500" /> Preferred
                    </p>
                    <div className="space-y-2">{slotEditor('preferredTimeSlots', { withReason: false })}</div>
                  </div>
                </Section>

                {/* Research & extension */}
                <Section id="research" icon={FlaskConical} title="Research & extension" description="Work outside teaching. It appears on your faculty profile for the scheduling office.">
                  {[
                    ['researchInvolvement', 'Research involvement', 'Studies, papers or projects you’re part of'],
                    ['extensionInvolvement', 'Extension involvement', 'Community programs and outreach'],
                    ['productionInvolvement', 'Production involvement', 'Income-generating or production projects'],
                  ].map(([key, label, placeholder]) => (
                    <Field key={key} id={key} label={label}>
                      <textarea id={key} rows={2} value={facultyFormData[key]} onChange={(e) => setFacultyField(key, e.target.value)} className={`${inputClass} resize-y`} placeholder={placeholder} />
                    </Field>
                  ))}
                </Section>
              </>
            )}

            {/* Sticky save bar — appears only when there is something to save */}
            {(isDirty || saving) && (
              <div className="sticky bottom-4 z-20">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
                  <p className="text-sm text-gray-600 dark:text-gray-300" role="status">
                    You have unsaved changes.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDiscard}
                      disabled={saving}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
