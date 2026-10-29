import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Wand2, ShieldCheck, FolderOpen } from 'lucide-react';
import { AuthLayout, AuthField, PasswordField, FormAlert, SubmitButton } from '../components/auth/AuthLayout';
import CampusWalkLoader from '../components/CampusWalkLoader';

// What the system actually does, shown beside the form
const FEATURES = [
  { icon: Wand2, title: 'Generated timetables', text: 'A constraint solver builds the whole week at once.' },
  { icon: ShieldCheck, title: 'No double-booking', text: 'Every result is checked for room, teacher and section clashes.' },
  { icon: FolderOpen, title: 'Class spaces', text: 'Announcements and materials for every class.' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [loginSuccess, setLoginSuccess] = useState(false);
  // Set by the API client when a saved session stops working
  const [notice, setNotice] = useState(() => {
    try {
      return sessionStorage.getItem('authNotice') || '';
    } catch (_) {
      return '';
    }
  });
  useEffect(() => {
    try { sessionStorage.removeItem('authNotice'); } catch (_) { /* storage blocked */ }
  }, []);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Start where the user needs to type: the password when sign-up already
  // handed over the email, otherwise the email.
  useEffect(() => {
    (formData.email ? passwordRef : emailRef).current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if already authenticated (but not mid success animation)
  useEffect(() => {
    if (isAuthenticated && !loginSuccess) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loginSuccess, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email.trim(), formData.password);

    if (result.success) {
      setLoginSuccess(true);
      // Let the walk-in finish before the dashboard replaces it
      setTimeout(() => navigate('/dashboard'), 1300);
    } else {
      setLoading(false);
      // Kept on the page as well as in the toast, which disappears
      setError(result.message || 'Login failed. Check your email and password.');
      passwordRef.current?.select();
    }
  };

  if (loginSuccess) {
    return (
      <CampusWalkLoader
        duration={1.3}
        title="Welcome back"
        subtitle="Signed in successfully"
        caption="Opening your dashboard…"
      />
    );
  }

  return (
    <AuthLayout
      eyebrow="Smart Timetabling System"
      title="Your week,"
      highlight="already worked out."
      description="Sign in to see your timetable, manage schedules and keep up with your classes."
      features={FEATURES}
    >
      <div className="auth-rise" style={{ animationDelay: '.05s' }}>
        <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">
          Welcome back
        </h1>
        <p className="mb-7 text-sm text-gray-600 dark:text-dark-text-secondary">
          Log in with your CTU account to continue.
        </p>
      </div>

      {successMessage && (
        <FormAlert tone="success" onDismiss={() => setSuccessMessage('')}>{successMessage}</FormAlert>
      )}
      {notice && !error && (
        <FormAlert tone="info" onDismiss={() => setNotice('')}>{notice}</FormAlert>
      )}
      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={handleSubmit} className="auth-rise space-y-5" style={{ animationDelay: '.1s' }}>
        <AuthField
          ref={emailRef}
          label="Email address"
          icon={Mail}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="you@ctu.edu.ph"
        />

        <PasswordField
          ref={passwordRef}
          label="Password"
          icon={Lock}
          name="password"
          autoComplete="current-password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          labelAside={(
            <Link to="/forgot-password" state={{ email: formData.email.trim() }} className="text-xs font-semibold text-blue-700 hover:underline dark:text-dark-blue-info">
              Forgot password?
            </Link>
          )}
        />

        <SubmitButton loading={loading} loadingText="Signing in…">Log in</SubmitButton>
      </form>

      {/* No public faculty sign-up: faculty join through an invite link from
          the scheduling office */}
      <div className="auth-rise mt-8 border-t border-gray-200 pt-6 text-sm dark:border-dark-border-subtle" style={{ animationDelay: '.15s' }}>
        <p className="text-gray-600 dark:text-dark-text-secondary">
          New student?{' '}
          <Link to="/signup" className="font-semibold text-blue-700 hover:underline dark:text-dark-blue-info">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
