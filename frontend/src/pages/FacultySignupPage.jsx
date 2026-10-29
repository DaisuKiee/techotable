import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, Lock, User, Building2, GraduationCap, BookOpen, Clock, Loader2, Link2Off, CheckCircle2,
  Wand2, Users, ClipboardCheck,
} from 'lucide-react';
import api, { authAPI } from '../services/api';
import {
  AuthLayout, AuthField, PasswordField, AuthStatus, FormAlert, SubmitButton, SecondaryButton,
} from '../components/auth/AuthLayout';
import {
  PasswordChecklist, passwordProblem, confirmProblem, liveConfirmProblem,
} from '../components/auth/PasswordStrength';

const FEATURES = [
  { icon: Wand2, title: 'Your teaching load', text: 'Classes assigned by the scheduling office, clash-free.' },
  { icon: Users, title: 'Class spaces', text: 'Post announcements and materials to your sections.' },
  { icon: ClipboardCheck, title: 'Approved access', text: 'Your account is reviewed before it goes live.' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS = ['name', 'department', 'qualification', 'email', 'password', 'confirmPassword'];

const validate = (data) => {
  const errors = {};
  if (!data.name.trim()) errors.name = 'Enter your full name';
  else if (data.name.trim().length < 3) errors.name = 'Name must be at least 3 characters';
  if (!data.email.trim()) errors.email = 'Enter your email address';
  else if (!EMAIL_RE.test(data.email.trim())) errors.email = 'That doesn\'t look like an email address';
  if (!data.department) errors.department = 'Choose your college';
  if (!data.qualification.trim()) errors.qualification = 'Enter your highest qualification';
  const pw = passwordProblem(data.password);
  if (pw) errors.password = pw;
  const confirm = confirmProblem(data.password, data.confirmPassword);
  if (confirm) errors.confirmPassword = confirm;
  return errors;
};

const SectionLabel = ({ step, children }) => (
  <div className="mb-3 flex items-center gap-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
      {step}
    </span>
    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted">{children}</span>
  </div>
);

const LAYOUT = {
  eyebrow: 'For faculty',
  title: 'Teach with a timetable',
  highlight: 'that works for you.',
  description: 'Create your faculty account from the invite your scheduling office sent you.',
  features: FEATURES,
};

const FacultySignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite') || '';
  // 'checking' | 'valid' | { message } - this page only works from an invite
  // link issued by the scheduling office
  const [inviteState, setInviteState] = useState('checking');
  const [expirationDate, setExpirationDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const refs = useRef({});

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    qualification: '',
    specialization: ''
  });

  // The server checks the signed invite. The expiry used to be computed in
  // the browser from a local setting, so every link looked valid forever.
  useEffect(() => {
    if (!invite) {
      setInviteState({ message: 'Faculty accounts are created from an invite link. Ask your scheduling office to send you one.' });
      return;
    }
    authAPI.checkFacultyInvite(invite)
      .then(({ data }) => {
        setExpirationDate(new Date(data.data.expiresAt));
        setInviteState('valid');
      })
      .catch((err) => {
        setInviteState({ message: err.response?.data?.message || 'This invite link could not be checked. Try again later.' });
      });
  }, [invite]);

  useEffect(() => {
    if (inviteState === 'valid') refs.current.name?.focus();
  }, [inviteState]);

  const errors = { ...validate(formData), ...serverErrors };
  const shown = (name) => (touched[name] ? errors[name] : undefined);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (serverErrors[name]) setServerErrors(prev => ({ ...prev, [name]: undefined }));
    setError('');
  };

  // Typed-in fields are checked on leaving; empty ones wait for submit
  const handleBlur = (e) => {
    if (e.target.value === '') return;
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  };

  const field = (name) => ({
    name,
    ref: (el) => { refs.current[name] = el; },
    value: formData[name],
    onChange: handleChange,
    onBlur: handleBlur,
    error: shown(name),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));
    const invalid = FIELDS.find((f) => errors[f]);
    if (invalid) {
      refs.current[invalid]?.focus();
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/faculty-signup', {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        department: formData.department.trim(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        invite
      });
      setDone(true);
    } catch (err) {
      console.error('Signup error:', err);
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      if (err.response?.status === 403) {
        // The invite expired while the form was open
        setInviteState({ message });
      } else if (/email/i.test(message)) {
        setServerErrors({ email: message });
        refs.current.email?.focus();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (inviteState === 'checking') {
    return (
      <AuthLayout {...LAYOUT}>
        <AuthStatus tone="info" icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Checking your invite">
          <p>This only takes a moment.</p>
        </AuthStatus>
      </AuthLayout>
    );
  }

  if (inviteState !== 'valid') {
    return (
      <AuthLayout {...LAYOUT}>
        <AuthStatus
          tone="error"
          icon={<Link2Off className="h-8 w-8" />}
          title="Invite link required"
          actions={<SecondaryButton onClick={() => navigate('/login')}>Go to login</SecondaryButton>}
        >
          <p>{inviteState.message}</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">
            Already have an account? Log in instead.
          </p>
        </AuthStatus>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout {...LAYOUT}>
        <AuthStatus
          tone="success"
          icon={<CheckCircle2 className="h-8 w-8" />}
          title="Request sent for approval"
          actions={(
            <SubmitButton type="button" onClick={() => navigate('/login', { state: { email: formData.email.trim().toLowerCase() } })}>
              Go to login
            </SubmitButton>
          )}
        >
          <p>Your faculty account has been created and is waiting for the scheduling office to approve it.</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">
            You'll be able to log in with {formData.email.trim().toLowerCase()} once it's approved.
          </p>
        </AuthStatus>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...LAYOUT}>
      <div className="auth-rise" style={{ animationDelay: '.05s' }}>
        <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">
          Create your faculty account
        </h1>
        <p className="mb-5 text-sm text-gray-600 dark:text-dark-text-secondary">
          You were invited by the scheduling office. Your account is activated once they approve it.
        </p>
        {expirationDate && (
          <p className="mb-6 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
            <Clock className="h-3.5 w-3.5" />
            Invite valid until {expirationDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="auth-rise" style={{ animationDelay: '.1s' }}>
        <SectionLabel step={1}>About you</SectionLabel>
        <div className="space-y-4">
          <AuthField label="Full name" icon={User} autoComplete="name" placeholder="Juan Dela Cruz" {...field('name')} />
          {/* The profile's department is CoTE or Other; free text used to make
              the whole sign-up fail */}
          <AuthField label="College" icon={Building2} as="select" {...field('department')}>
            <option value="">Choose your college</option>
            <option value="CoTE">College of Technology and Engineering (CoTE)</option>
            <option value="Other">Other</option>
          </AuthField>
          <AuthField label="Highest qualification" icon={GraduationCap} placeholder="MS in Information Technology" {...field('qualification')} />
          <AuthField
            label="Specialization (optional)"
            icon={BookOpen}
            placeholder="Networking, Programming"
            hint="Helps match you to the subjects you teach best"
            {...field('specialization')}
          />
        </div>

        <div className="my-6 border-t border-gray-200 dark:border-dark-border-subtle" />

        <SectionLabel step={2}>Your login</SectionLabel>
        <div className="space-y-4">
          <AuthField
            label="Email address"
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@ctu.edu.ph"
            {...field('email')}
          />
          <div>
            <PasswordField label="Password" icon={Lock} autoComplete="new-password" placeholder="Create a password" {...field('password')} />
            <PasswordChecklist password={formData.password} />
          </div>
          <PasswordField
            label="Confirm password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            hint={formData.confirmPassword && formData.confirmPassword === formData.password ? '✓ Passwords match' : undefined}
            {...field('confirmPassword')}
            error={shown('confirmPassword') || liveConfirmProblem(formData.password, formData.confirmPassword)}
          />
        </div>

        <div className="mt-7">
          <SubmitButton loading={loading} loadingText="Sending request…">Create faculty account</SubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
};

export default FacultySignupPage;
