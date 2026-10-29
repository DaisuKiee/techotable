import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Contact, GraduationCap, Calendar, Bell, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePrograms } from '../hooks/usePrograms';
import { AuthLayout, AuthField, PasswordField, FormAlert, SubmitButton } from '../components/auth/AuthLayout';
import { PasswordChecklist, passwordProblem, confirmProblem, liveConfirmProblem } from '../components/auth/PasswordStrength';

const FEATURES = [
  { icon: Calendar, title: 'Your schedule', text: 'Your whole week, on any device.' },
  { icon: Bell, title: 'Change alerts', text: 'Notified when a class moves or a room changes.' },
  { icon: Users, title: 'Class spaces', text: 'Announcements and materials from your instructors.' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Field order matters: on submit, focus jumps to the first invalid one
const FIELDS = ['firstName', 'lastName', 'studentId', 'program', 'email', 'password', 'confirmPassword'];

const validate = (data) => {
  const errors = {};
  if (!data.firstName.trim()) errors.firstName = 'Enter your first name';
  if (!data.lastName.trim()) errors.lastName = 'Enter your last name';
  if (!data.studentId.trim()) errors.studentId = 'Enter your student ID';
  if (!data.program) errors.program = 'Choose your program';
  if (!data.email.trim()) errors.email = 'Enter your email address';
  else if (!EMAIL_RE.test(data.email.trim())) errors.email = 'That doesn\'t look like an email address';
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

const SignupPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { programs } = usePrograms();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    email: '',
    program: '',
    password: '',
    confirmPassword: ''
  });
  // Errors only show once a field has been left (or on submit), so nobody is
  // told off for a field they haven't reached yet.
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refs = useRef({});

  // Default the program selection to the first program from the database,
  // and reset it if the current pick is no longer an active program.
  useEffect(() => {
    if (programs.length === 0) return;
    const codes = programs.map(p => p.code);
    if (!codes.includes(formData.program)) {
      setFormData(prev => ({ ...prev, program: codes[0] }));
    }
  }, [programs, formData.program]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    refs.current.firstName?.focus();
  }, []);

  const errors = { ...validate(formData), ...serverErrors };
  const shown = (name) => (touched[name] ? errors[name] : undefined);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (serverErrors[name]) setServerErrors(prev => ({ ...prev, [name]: undefined }));
    setError('');
  };

  // Leaving a field you've typed in checks it; skipping past an empty one
  // doesn't - that is flagged on submit instead.
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
    setError('');
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));

    const invalid = FIELDS.find((f) => errors[f]);
    if (invalid) {
      refs.current[invalid]?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          studentId: formData.studentId.trim(),
          program: formData.program
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Account created! Check ${formData.email.trim()} to verify your account.`,
          { duration: 5000, icon: '📧' }
        );

        navigate('/login', {
          state: {
            message: 'Account created! Please check your email to verify your account.',
            email: formData.email.trim()
          }
        });
      } else {
        const message = data.message || 'Failed to create account';
        // Put "already registered" errors on the field they belong to
        if (/email/i.test(message)) {
          setServerErrors({ email: message });
          refs.current.email?.focus();
        } else if (/student id/i.test(message)) {
          setServerErrors({ studentId: message });
          refs.current.studentId?.focus();
        } else {
          setError(message);
        }
      }
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="For students"
      title="Join your classes"
      highlight="at CTU Daanbantayan."
      description="Create your student account to see your timetable, get notified about changes and follow your class spaces."
      features={FEATURES}
    >
      <div className="auth-rise" style={{ animationDelay: '.05s' }}>
        <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">
          Create your student account
        </h1>
        <p className="mb-7 text-sm text-gray-600 dark:text-dark-text-secondary">
          Already have one?{' '}
          <Link to="/login" className="font-semibold text-blue-700 hover:underline dark:text-dark-blue-info">Log in</Link>
        </p>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="auth-rise" style={{ animationDelay: '.1s' }}>
        <SectionLabel step={1}>About you</SectionLabel>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthField label="First name" icon={User} autoComplete="given-name" placeholder="Juan" {...field('firstName')} />
            <AuthField label="Last name" autoComplete="family-name" placeholder="Dela Cruz" {...field('lastName')} />
          </div>
          <AuthField
            label="Student ID"
            icon={Contact}
            autoComplete="off"
            placeholder="2024-12345"
            hint="As printed on your school ID"
            {...field('studentId')}
          />
          <AuthField label="Program" icon={GraduationCap} as="select" disabled={programs.length === 0} {...field('program')}>
            {programs.length === 0 && <option value="">Loading programs…</option>}
            {programs.map(prog => (
              <option key={prog._id} value={prog.code}>
                {prog.code} - {prog.name}
              </option>
            ))}
          </AuthField>
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
            hint="We'll send a verification link here"
            {...field('email')}
          />

          <div>
            <PasswordField
              label="Password"
              icon={Lock}
              autoComplete="new-password"
              placeholder="Create a password"
              {...field('password')}
            />
            <PasswordChecklist password={formData.password} />
          </div>

          <PasswordField
            label="Confirm password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            hint={formData.confirmPassword && formData.confirmPassword === formData.password ? '✓ Passwords match' : undefined}
            {...field('confirmPassword')}
            // Mismatch shows while typing once there's something to compare
            error={shown('confirmPassword') || liveConfirmProblem(formData.password, formData.confirmPassword)}
          />
        </div>

        <div className="mt-7">
          <SubmitButton loading={loading} loadingText="Creating account…">Create account</SubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
};

export default SignupPage;
