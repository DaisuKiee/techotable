import React, { useEffect, useMemo, useState } from 'react';
import { Users, User, GraduationCap, Phone, FileText, BookOpen, Plus, X, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { studentAPI, sectionAPI, subjectAPI, getErrorMessage } from '../services/api';
import { usePrograms } from '../hooks/usePrograms';
import { useAuth } from '../context/AuthContext';
import BaseModal from './BaseModal';

const MIN_PASSWORD = 8;
const STATUSES = [
  ['enrolled', 'Enrolled'],
  ['not_enrolled', 'Not enrolled'],
  ['dropped', 'Dropped'],
  ['graduated', 'Graduated'],
];

const inputCls = (invalid) => `w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-600 ${
  invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500'
    : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-gray-600'
}`;

const Field = ({ label, required, error, hint, children, className = '' }) => (
  <div className={className}>
    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}{required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle className="h-3 w-3" />{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    ) : null}
  </div>
);

const Panel = ({ icon: Icon, title, children, aside }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> {title}
      </h3>
      {aside}
    </div>
    {children}
  </section>
);

const blankContact = { name: '', relationship: '', contactNumber: '' };

const fromStudent = (student, defaultProgram) => ({
  email: student?.user?.email || '',
  password: '',
  firstName: student?.user?.firstName || '',
  lastName: student?.user?.lastName || '',
  middleName: student?.user?.middleName || '',
  studentId: student?.studentId || '',
  program: student?.program || defaultProgram || '',
  yearLevel: student?.yearLevel || 1,
  sectionCode: student?.sectionCode || '',
  studentType: student?.studentType || 'regular',
  subjectCodes: student?.subjectCodes || [],
  contactNumber: student?.contactNumber || '',
  guardianInfo: { ...blankContact, ...(student?.guardianInfo || {}) },
  emergencyContact: { ...blankContact, ...(student?.emergencyContact || {}) },
  enrollmentStatus: student?.enrollmentStatus || 'not_enrolled',
  gpa: student?.gpa ?? '',
  notes: student?.notes || '',
});

const StudentModal = ({ student, onClose }) => {
  const { user } = useAuth();
  const { programCodes } = usePrograms();
  const isEdit = !!student;
  const lockedProgram = user?.role === 'program_manager' ? user.program : null;
  const hasAccount = !isEdit || !!student.user;

  const [form, setForm] = useState(() => fromStudent(student, lockedProgram || ''));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [subjectInput, setSubjectInput] = useState('');

  // Pick a default program once the list arrives (it used to be hard-coded to BSIT)
  useEffect(() => {
    if (!form.program && programCodes.length) setForm((f) => ({ ...f, program: programCodes[0] }));
  }, [programCodes, form.program]);

  // Sections and subjects of the chosen program
  useEffect(() => {
    if (!form.program) return undefined;
    let live = true;
    setSectionsLoading(true);
    Promise.all([
      sectionAPI.getAll({ program: form.program }).catch(() => ({ data: { data: [] } })),
      subjectAPI.getAll({ program: form.program }).catch(() => ({ data: { data: [] } })),
    ]).then(([sec, sub]) => {
      if (!live) return;
      setSections((sec.data.data || []).filter((s) => s.program === form.program && s.isActive !== false));
      setSubjects(sub.data.data || []);
    }).finally(() => live && setSectionsLoading(false));
    return () => { live = false; };
  }, [form.program]);

  const yearSections = useMemo(
    () => sections
      .filter((s) => Number(s.yearLevel) === Number(form.yearLevel))
      .sort((a, b) => a.sectionCode.localeCompare(b.sectionCode)),
    [sections, form.yearLevel]
  );
  const chosenSection = sections.find((s) => s.sectionCode === form.sectionCode);

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const handleChange = (e) => set(e.target.name, e.target.value);
  const setNested = (parent, field, value) => setForm((f) => ({ ...f, [parent]: { ...f[parent], [field]: value } }));

  const changeProgram = (program) => setForm((f) => ({ ...f, program, sectionCode: '' }));
  const changeYear = (yearLevel) => setForm((f) => ({
    ...f,
    yearLevel,
    // A section from another year doesn't fit any more
    sectionCode: sections.find((s) => s.sectionCode === f.sectionCode && Number(s.yearLevel) === Number(yearLevel)) ? f.sectionCode : '',
  }));
  const changeSection = (sectionCode) => setForm((f) => ({
    ...f,
    sectionCode,
    enrollmentStatus: sectionCode && f.enrollmentStatus === 'not_enrolled' ? 'enrolled' : f.enrollmentStatus,
  }));

  const addSubject = (raw = subjectInput) => {
    const code = raw.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!code) return;
    if (!form.subjectCodes.includes(code)) set('subjectCodes', [...form.subjectCodes, code]);
    setSubjectInput('');
  };
  const removeSubject = (code) => set('subjectCodes', form.subjectCodes.filter((c) => c !== code));
  const knownSubject = (code) => subjects.find((s) => s.subjectCode?.toUpperCase() === code);

  const validate = () => {
    const e = {};
    if (!form.studentId.trim()) e.studentId = 'Student ID is required';
    if (hasAccount) {
      if (!form.firstName.trim()) e.firstName = 'First name is required';
      if (!form.lastName.trim()) e.lastName = 'Last name is required';
      if (!form.email.trim()) e.email = 'Email is required';
      else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
    }
    if (!isEdit && form.password.length < MIN_PASSWORD) e.password = `At least ${MIN_PASSWORD} characters`;
    if (!form.program) e.program = 'Choose a program';
    if (form.gpa !== '' && (Number(form.gpa) < 0 || Number(form.gpa) > 5)) e.gpa = 'GPA is between 0 and 5';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    const payload = { ...form, email: form.email.trim().toLowerCase(), studentId: form.studentId.trim() };
    if (subjectInput.trim()) payload.subjectCodes = [...new Set([...form.subjectCodes, subjectInput.trim().toUpperCase()])];
    if (isEdit) delete payload.password;
    if (!hasAccount) ['email', 'firstName', 'lastName', 'middleName'].forEach((k) => delete payload[k]);

    setLoading(true);
    try {
      if (isEdit) await studentAPI.update(student._id, payload);
      else await studentAPI.create(payload);
      onClose(true);
    } catch (error) {
      // Show field problems next to the field, everything else at the top
      const fieldErrors = error.response?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        setErrors(Object.fromEntries(fieldErrors.map((f) => [f.path || f.param, f.msg])));
      } else if (fieldErrors && typeof fieldErrors === 'object') {
        setErrors(fieldErrors);
      }
      const message = getErrorMessage(error, isEdit ? 'Could not update the student' : 'Could not create the student');
      setServerError(message);
      if (/student id/i.test(message)) setErrors((x) => ({ ...x, studentId: message }));
      else if (/email|registered/i.test(message)) setErrors((x) => ({ ...x, email: message }));
      else if (/section/i.test(message)) setErrors((x) => ({ ...x, sectionCode: message }));
    } finally {
      setLoading(false);
    }
  };

  const name = `${form.firstName} ${form.lastName}`.trim();

  return (
    <BaseModal
      isOpen
      onClose={() => onClose(false)}
      title={isEdit ? 'Edit student' : 'Add student'}
      subtitle={isEdit ? `${name || student.studentId} · ${student.studentId}` : 'Creates the student record and their login'}
      icon={Users}
      size="large"
      formId="student-form"
      loading={loading}
      submitText={isEdit ? 'Save changes' : 'Create student'}
      footerInfo={!isEdit ? 'The student can log in right away with this email and password.' : undefined}
    >
      <form onSubmit={handleSubmit} id="student-form" noValidate className="space-y-4 bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {serverError}
          </div>
        )}
        {!hasAccount && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            This record has no login account (it was removed), so name and email can't be edited. Academic details still save.
          </div>
        )}

        <Panel icon={User} title="Student" aside={<span className="text-xs text-gray-500 dark:text-gray-400">* required</span>}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Student ID" required error={errors.studentId} hint={isEdit ? 'Student IDs cannot be changed' : undefined}>
              <input name="studentId" value={form.studentId} onChange={handleChange} disabled={isEdit} placeholder="e.g. 2025-00001" autoComplete="off" className={inputCls(errors.studentId)} />
            </Field>
            <Field label="Email" required={hasAccount} error={errors.email}>
              <input type="email" name="email" value={form.email} onChange={handleChange} disabled={!hasAccount} placeholder="student@example.com" autoComplete="off" className={inputCls(errors.email)} />
            </Field>
            <Field label="First name" required={hasAccount} error={errors.firstName}>
              <input name="firstName" value={form.firstName} onChange={handleChange} disabled={!hasAccount} placeholder="Juan" className={inputCls(errors.firstName)} />
            </Field>
            <Field label="Last name" required={hasAccount} error={errors.lastName}>
              <input name="lastName" value={form.lastName} onChange={handleChange} disabled={!hasAccount} placeholder="Dela Cruz" className={inputCls(errors.lastName)} />
            </Field>
            <Field label="Middle name">
              <input name="middleName" value={form.middleName} onChange={handleChange} disabled={!hasAccount} placeholder="Santos" className={inputCls()} />
            </Field>
            <Field label="Contact number">
              <input type="tel" name="contactNumber" value={form.contactNumber} onChange={handleChange} placeholder="09123456789" className={inputCls()} />
            </Field>
            {!isEdit && (
              <Field label="Password" required error={errors.password} hint={`At least ${MIN_PASSWORD} characters. Share it with the student.`} className="md:col-span-2">
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} autoComplete="new-password" placeholder="Create a password" className={`${inputCls(errors.password)} pr-11`} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            )}
          </div>
        </Panel>

        <Panel icon={GraduationCap} title="Enrollment">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Program" required error={errors.program}>
              <select value={form.program} onChange={(e) => changeProgram(e.target.value)} disabled={!!lockedProgram} className={inputCls(errors.program)}>
                {lockedProgram ? <option value={lockedProgram}>{lockedProgram}</option> : (
                  <>
                    {!form.program && <option value="">Choose…</option>}
                    {programCodes.map((p) => <option key={p} value={p}>{p}</option>)}
                  </>
                )}
              </select>
            </Field>
            <Field label="Year level">
              <select value={form.yearLevel} onChange={(e) => changeYear(Number(e.target.value))} className={inputCls()}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </Field>
            <Field
              label="Section"
              error={errors.sectionCode}
              hint={sectionsLoading
                ? 'Loading sections…'
                : yearSections.length === 0
                ? `No ${form.program} year ${form.yearLevel} sections yet. You can assign one later.`
                : chosenSection
                ? `${chosenSection.academicYear} · Semester ${chosenSection.semester} · ${chosenSection.shift} shift`
                : 'Optional. Can be assigned later.'}
            >
              <select value={form.sectionCode} onChange={(e) => changeSection(e.target.value)} disabled={sectionsLoading} className={inputCls(errors.sectionCode)}>
                <option value="">No section yet</option>
                {yearSections.map((s) => {
                  const full = s.maxStudents && s.currentStudents >= s.maxStudents && s.sectionCode !== student?.sectionCode;
                  return (
                    <option key={s._id} value={s.sectionCode} disabled={full}>
                      {s.sectionCode} · {s.currentStudents || 0}/{s.maxStudents}{full ? ' (full)' : ''}
                    </option>
                  );
                })}
                {/* Keep a current section that's no longer in the list visible */}
                {form.sectionCode && !yearSections.some((s) => s.sectionCode === form.sectionCode) && !sectionsLoading && (
                  <option value={form.sectionCode}>{form.sectionCode}</option>
                )}
              </select>
            </Field>
            <Field label="Student type" hint={form.studentType === 'irregular' ? 'Takes individual subjects' : 'Follows their section’s schedule'}>
              <select name="studentType" value={form.studentType} onChange={handleChange} className={inputCls()}>
                <option value="regular">Regular</option>
                <option value="irregular">Irregular</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="enrollmentStatus" value={form.enrollmentStatus} onChange={handleChange} className={inputCls()}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="GPA" error={errors.gpa}>
              <input type="number" name="gpa" value={form.gpa} onChange={handleChange} step="0.01" min="0" max="5" placeholder="e.g. 1.75" className={inputCls(errors.gpa)} />
            </Field>
          </div>
        </Panel>

        {form.studentType === 'irregular' && (
          <Panel icon={BookOpen} title="Subjects" aside={<span className="text-xs text-gray-500 dark:text-gray-400">{form.subjectCodes.length} added</span>}>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">The subjects this irregular student takes. Pick from {form.program} subjects or type a code.</p>
            <div className="flex gap-2">
              <input
                list="student-subject-options"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSubject(); }
                }}
                placeholder="Subject code, e.g. CC 111"
                aria-label="Subject code"
                className={inputCls()}
              />
              <datalist id="student-subject-options">
                {subjects.filter((s) => !form.subjectCodes.includes(s.subjectCode?.toUpperCase())).map((s) => (
                  <option key={s._id} value={s.subjectCode}>{s.subjectName}</option>
                ))}
              </datalist>
              <button type="button" onClick={() => addSubject()} disabled={!subjectInput.trim()} className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {form.subjectCodes.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {form.subjectCodes.map((code) => {
                  const known = knownSubject(code);
                  return (
                    <li key={code} title={known ? known.subjectName : 'Not a subject of this program'} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium ${known ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                      {code}
                      {known && <span className="hidden max-w-[10rem] truncate text-xs font-normal opacity-70 sm:inline">{known.subjectName}</span>}
                      <button type="button" onClick={() => removeSubject(code)} aria-label={`Remove ${code}`} className="rounded opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No subjects yet</p>
            )}
          </Panel>
        )}

        <Panel icon={Phone} title="Guardian & emergency contact">
          {[['guardianInfo', 'Guardian', 'e.g. Mother'], ['emergencyContact', 'Emergency contact', 'e.g. Sibling']].map(([key, label, rel]) => (
            <div key={key} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input aria-label={`${label} name`} value={form[key].name} onChange={(e) => setNested(key, 'name', e.target.value)} placeholder="Full name" className={inputCls()} />
                <input aria-label={`${label} relationship`} value={form[key].relationship} onChange={(e) => setNested(key, 'relationship', e.target.value)} placeholder={rel} className={inputCls()} />
                <input aria-label={`${label} contact number`} type="tel" value={form[key].contactNumber} onChange={(e) => setNested(key, 'contactNumber', e.target.value)} placeholder="09123456789" className={inputCls()} />
              </div>
            </div>
          ))}
        </Panel>

        <Panel icon={FileText} title="Notes">
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Anything the scheduling office should know" className={`${inputCls()} resize-y`} aria-label="Notes" />
        </Panel>
      </form>
    </BaseModal>
  );
};

export default StudentModal;
