import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { authAPI, facultyAPI } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import AvatarUpload from '../components/AvatarUpload';
import { X, Plus, Star, Loader2 } from 'lucide-react';
import ctuBg from '../assets/images/backgrounds/ctu-bg.png';

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

const defaultFacultyForm = {
  specializations: [],
  programs: [],
  qualifications: [],
  maxTeachingHours: 36,
  experiencedSubjects: []
};

const blankQualification = { degree: '', field: '', institution: '', yearObtained: '' };
const blankSubject = { subjectCode: '', frequency: '', period: '' };

/* ---------- small building blocks ---------- */
const Section = ({ title, description, children }) => (
  <section className="grid gap-5 py-8 md:grid-cols-3 md:gap-10">
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
    <div className="space-y-5 md:col-span-2">{children}</div>
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
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 py-1 pl-3 pr-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-100"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item}`}
                className="rounded p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-600 dark:hover:text-white"
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

const RowCard = ({ title, onRemove, removeLabel, children }) => (
  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded p-1 text-gray-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
    {children}
  </div>
);

const EmptyNote = ({ children }) => (
  <p className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
    {children}
  </p>
);

/* ---------- page ---------- */
const ProfilePage = () => {
  const [facultyData, setFacultyData] = useState(null);
  const [saving, setSaving] = useState(false);
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

  // ✅ CACHE: User profile with 10-minute cache
  const {
    data: profileResponse,
    loading,
    error,
    refetch: reloadProfile,
    isFromCache
  } = useCachedData(
    () => authAPI.getMe(),
    'user-profile',
    {
      cacheDuration: 10 * 60 * 1000, // 10 minutes
      enabled: true,
      onSuccess: (data) => {
        console.log('✅ Profile loaded:', isFromCache ? '📦 from cache' : '🌐 fresh fetch');
      },
      onError: (err) => {
        console.error('Failed to load profile:', err);
        toast.error('Could not load your profile. Refresh the page to try again.');
      }
    }
  );

  // Extract user data
  const user = React.useMemo(() => {
    if (!profileResponse) return null;
    const data = profileResponse.data || profileResponse;
    return data?.data || data || null;
  }, [profileResponse]);

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

      if (user.role === 'faculty' && user.facultyProfile) {
        try {
          const facultyId = user.facultyProfile._id || user.facultyProfile;
          const facultyResponse = await facultyAPI.getById(facultyId);
          faculty = facultyResponse.data.data;
          facultyForm = {
            specializations: faculty.specializations || [],
            programs: faculty.programs || [],
            qualifications: faculty.qualifications || [],
            maxTeachingHours: faculty.maxTeachingHours || 36,
            experiencedSubjects: faculty.experiencedSubjects || []
          };
        } catch (error) {
          console.error('Error loading faculty profile:', error);
        }
      }

      setFacultyData(faculty);
      setFacultyFormData(facultyForm);
      setInitial({ form, faculty: facultyForm });
    };

    loadFacultyProfile();
  }, [user]);

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

  const handleAvatarUpdate = (updatedUser) => {
    setUser(updatedUser);
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...storedUser, ...updatedUser }));
  };

  const handleDiscard = () => {
    if (!initial) return;
    setFormData(initial.form);
    setFacultyFormData(initial.faculty);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await authAPI.updateProfile(formData);

      if (user?.role === 'faculty' && user.facultyProfile) {
        const facultyId = user.facultyProfile._id || user.facultyProfile;
        // Drop empty rows so half-filled "Add" clicks don't get saved
        const payload = {
          ...facultyFormData,
          maxTeachingHours: Number(facultyFormData.maxTeachingHours) || 0,
          qualifications: facultyFormData.qualifications
            .filter((q) => [q.degree, q.field, q.institution, q.yearObtained].some((v) => String(v ?? '').trim()))
            .map((q) => ({
              ...q,
              yearObtained: q.yearObtained === '' ? undefined : Number(q.yearObtained)
            })),
          experiencedSubjects: facultyFormData.experiencedSubjects.filter((s) => (s.subjectCode || '').trim())
        };
        await facultyAPI.update(facultyId, payload);
      }

      toast.success('Changes saved');
      await reloadProfile(); // refresh profile data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save your changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ----- derived ----- */
  const isFaculty = user?.role === 'faculty' && !!facultyData;
  const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Your profile';
  const displayOptions = [
    { value: 'first', label: formData.firstName || 'First name' },
    { value: 'full', label: [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'First Last' },
    {
      value: 'last-first',
      label: [formData.lastName, formData.firstName].filter(Boolean).join(', ') || 'Last, First'
    }
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

  return (
    <Layout>
      {/* Cover */}
      <div className="relative h-40 bg-cover bg-center md:h-52" style={{ backgroundImage: `url(${ctuBg})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-gray-900/10" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-32 sm:px-6">
        {/* Identity: avatar overlaps the cover, name sits beside it */}
        <div className="-mt-14 flex flex-col gap-5 md:-mt-16 md:flex-row md:items-end">
          <div className="shrink-0">
            <AvatarUpload user={user} onUpdate={handleAvatarUpdate} />
          </div>
          <div className="min-w-0 flex-1 md:pb-2">
            <h1 className="truncate text-2xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{formData.email}</p>
          </div>
        </div>

        {/* Faculty facts (read-only) */}
        {isFaculty && (
          <dl className="mt-6 grid grid-cols-1 gap-y-3 border-y border-gray-200 py-4 text-sm dark:border-gray-700 sm:grid-cols-3">
            {[
              ['Employee ID', facultyData.employeeId],
              ['Department', facultyData.department],
              ['Position', facultyData.position || 'Faculty']
            ].map(([term, value]) => (
              <div key={term} className="min-w-0 sm:pr-4">
                <dt className="text-gray-500 dark:text-gray-400">{term}</dt>
                <dd className="mt-0.5 truncate font-medium text-gray-900 dark:text-white">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        )}

        <form onSubmit={handleSubmit} className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
          {/* Personal information */}
          <Section title="Personal information" description="Your name and contact details.">
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
              <Field id="phoneNumber" label="Phone number">
                <input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleChange} className={inputClass} placeholder="09XX XXX XXXX" autoComplete="tel" />
              </Field>
            </div>
            {/* NOTE: bound to `address` in the API, but labelled as skills. Rename one side when you can. */}
            <Field id="address" label="Skills / occupation">
              <input id="address" name="address" type="text" value={formData.address} onChange={handleChange} className={inputClass} placeholder="e.g. UX designer, full-stack developer" />
            </Field>
          </Section>

          {/* About */}
          <Section title="About you" description="A short bio and how your name appears to others.">
            <Field id="bio" label="Bio">
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={5}
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
              {/* Teaching profile */}
              <Section title="Teaching profile" description="The programs you teach and the areas you know best.">
                <TagInput
                  id="programs"
                  label="Programs"
                  items={facultyFormData.programs}
                  onAdd={addTag('programs')}
                  onRemove={(i) => removeAt('programs', i)}
                  placeholder="e.g. BSIT"
                />
                <TagInput
                  id="specializations"
                  label="Specializations"
                  items={facultyFormData.specializations}
                  onAdd={addTag('specializations')}
                  onRemove={(i) => removeAt('specializations', i)}
                  placeholder="e.g. Web development"
                />
                <Field id="maxTeachingHours" label="Maximum teaching hours">
                  <input
                    id="maxTeachingHours"
                    type="number"
                    min="0"
                    value={facultyFormData.maxTeachingHours}
                    onChange={(e) => setFacultyFormData((p) => ({ ...p, maxTeachingHours: e.target.value }))}
                    className={`${inputClass} sm:max-w-[10rem]`}
                  />
                </Field>
              </Section>

              {/* Education */}
              <Section title="Educational background" description="Degrees you've completed, most recent first.">
                {facultyFormData.qualifications.length === 0 && (
                  <EmptyNote>No degrees added yet.</EmptyNote>
                )}
                {facultyFormData.qualifications.map((qual, index) => (
                  <RowCard
                    key={index}
                    title={`Degree ${index + 1}`}
                    removeLabel={`Remove degree ${index + 1}`}
                    onRemove={() => removeAt('qualifications', index)}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input aria-label="Degree" className={inputClass} placeholder="Degree (BS, MS, PhD)" value={qual.degree || ''} onChange={(e) => updateRow('qualifications', index, 'degree', e.target.value)} />
                      <input aria-label="Field of study" className={inputClass} placeholder="Field of study" value={qual.field || ''} onChange={(e) => updateRow('qualifications', index, 'field', e.target.value)} />
                      <input aria-label="Institution" className={inputClass} placeholder="Institution" value={qual.institution || ''} onChange={(e) => updateRow('qualifications', index, 'institution', e.target.value)} />
                      <input aria-label="Year obtained" type="number" className={inputClass} placeholder="Year obtained" value={qual.yearObtained || ''} onChange={(e) => updateRow('qualifications', index, 'yearObtained', e.target.value)} />
                    </div>
                  </RowCard>
                ))}
                <button type="button" onClick={() => addRow('qualifications', blankQualification)} className={ghostButtonClass}>
                  <Plus className="h-4 w-4" /> Add degree
                </button>
              </Section>

              {/* Teaching experience */}
              <Section title="Most experienced in" description="Subjects you've taught before. Semesters taught and ratings are filled in by the system.">
                {facultyFormData.experiencedSubjects.length === 0 && (
                  <EmptyNote>No subjects added yet.</EmptyNote>
                )}
                {facultyFormData.experiencedSubjects.map((subject, index) => (
                  <RowCard
                    key={index}
                    title={subject.subjectCode || `Subject ${index + 1}`}
                    removeLabel={`Remove subject ${index + 1}`}
                    onRemove={() => removeAt('experiencedSubjects', index)}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input aria-label="Subject code" className={inputClass} placeholder="Subject code (GEC-RPH)" value={subject.subjectCode || ''} onChange={(e) => updateRow('experiencedSubjects', index, 'subjectCode', e.target.value)} />
                      <input aria-label="Times taught" className={inputClass} placeholder="Times taught (3x)" value={subject.frequency || ''} onChange={(e) => updateRow('experiencedSubjects', index, 'frequency', e.target.value)} />
                      <input aria-label="Period" className={inputClass} placeholder="Period (this year)" value={subject.period || ''} onChange={(e) => updateRow('experiencedSubjects', index, 'period', e.target.value)} />
                    </div>
                    {(subject.semestersTaught > 0 || subject.rating > 0) && (
                      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        {subject.semestersTaught > 0 && <span>{subject.semestersTaught} semesters taught</span>}
                        {subject.rating > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {subject.rating}/5.0
                          </span>
                        )}
                      </p>
                    )}
                  </RowCard>
                ))}
                <button type="button" onClick={() => addRow('experiencedSubjects', blankSubject)} className={ghostButtonClass}>
                  <Plus className="h-4 w-4" /> Add subject
                </button>
              </Section>
            </>
          )}

          {/* Sticky save bar — appears only when there is something to save */}
          {(isDirty || saving) && (
            <div className="sticky bottom-4 z-20 !border-t-0 pt-4">
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
    </Layout>
  );
};

export default ProfilePage;