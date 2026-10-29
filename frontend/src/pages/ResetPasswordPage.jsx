import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Lock, KeyRound, CheckCircle2, ShieldCheck, Clock, LogIn } from 'lucide-react';
import { authAPI } from '../services/api';
import {
  AuthLayout, PasswordField, AuthStatus, FormAlert, SubmitButton, SecondaryButton,
} from '../components/auth/AuthLayout';
import {
  PasswordChecklist, passwordProblem, confirmProblem, liveConfirmProblem,
} from '../components/auth/PasswordStrength';

const FEATURES = [
  { icon: ShieldCheck, title: 'Stronger password', text: 'Same rules as sign-up, checked as you type.' },
  { icon: Clock, title: 'One-time link', text: 'The link stops working once it\'s used.' },
  { icon: LogIn, title: 'Straight back in', text: 'Log in with the new password right after.' },
];

const REDIRECT_SECONDS = 5;

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { token } = useParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  // The server's only failure here is a bad or expired link; offer a new one
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  // Count down to the login page after success; the button skips the wait
  useEffect(() => {
    if (!success) return undefined;
    if (countdown <= 0) {
      navigate('/login', { state: { message: 'Password updated. Log in with your new password.' } });
      return undefined;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [success, countdown, navigate]);

  const passwordError = submitted ? passwordProblem(formData.password) : undefined;
  const confirmError = (submitted ? confirmProblem(formData.password, formData.confirmPassword) : undefined)
    || liveConfirmProblem(formData.password, formData.confirmPassword);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError('');

    if (passwordProblem(formData.password)) {
      passwordRef.current?.focus();
      return;
    }
    if (confirmProblem(formData.password, formData.confirmPassword)) {
      confirmRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.resetPassword(token, {
        password: formData.password
      });

      if (response.data.success) {
        setSuccess(true);
        setFormData({ password: '', confirmPassword: '' });
      } else {
        setError(response.data.message || 'Failed to reset password');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      const message = err.response?.data?.message || 'Failed to reset password. Please try again.';
      if (/invalid|expired/i.test(message)) setLinkInvalid(true);
      else setError(message);
    } finally {
      setLoading(false);
    }
  };

  const layout = {
    eyebrow: 'Account recovery',
    title: 'A fresh start',
    highlight: 'for your account.',
    description: 'Choose a new password, then log back in to your timetable.',
    features: FEATURES,
  };

  if (success) {
    return (
      <AuthLayout {...layout}>
        <AuthStatus
          tone="success"
          icon={<CheckCircle2 className="h-8 w-8" />}
          title="Password updated"
          actions={(
            <>
              <SubmitButton type="button" onClick={() => navigate('/login', { state: { message: 'Password updated. Log in with your new password.' } })}>
                Log in now
              </SubmitButton>
              <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-border-default">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(countdown / REDIRECT_SECONDS) * 100}%` }}
                />
              </div>
            </>
          )}
        >
          <p>Your password has been changed. Use the new one next time you log in.</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">Taking you to login in {countdown}s…</p>
        </AuthStatus>
      </AuthLayout>
    );
  }

  if (linkInvalid) {
    return (
      <AuthLayout {...layout}>
        <AuthStatus
          tone="error"
          icon={<Clock className="h-8 w-8" />}
          title="This link has expired"
          actions={(
            <>
              <SubmitButton type="button" onClick={() => navigate('/forgot-password')}>Send me a new link</SubmitButton>
              <SecondaryButton onClick={() => navigate('/login')}>Back to login</SecondaryButton>
            </>
          )}
        >
          <p>Reset links work once and expire after 10 minutes. Request a new one and use it straight away.</p>
        </AuthStatus>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...layout}>
      <div className="auth-rise" style={{ animationDelay: '.05s' }}>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">
          Set a new password
        </h1>
        <p className="mb-7 text-sm text-gray-600 dark:text-dark-text-secondary">
          Pick something you haven't used here before.
        </p>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="auth-rise space-y-5" style={{ animationDelay: '.1s' }}>
        <div>
          <PasswordField
            ref={passwordRef}
            label="New password"
            icon={Lock}
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={formData.password}
            onChange={handleChange}
            error={passwordError}
          />
          <PasswordChecklist password={formData.password} />
        </div>

        <PasswordField
          ref={confirmRef}
          label="Confirm new password"
          icon={Lock}
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={confirmError}
          hint={formData.confirmPassword && formData.confirmPassword === formData.password ? '✓ Passwords match' : undefined}
        />

        <SubmitButton loading={loading} loadingText="Updating password…">Update password</SubmitButton>
      </form>

      <p className="auth-rise mt-8 border-t border-gray-200 pt-6 text-sm text-gray-600 dark:border-dark-border-subtle dark:text-dark-text-secondary" style={{ animationDelay: '.15s' }}>
        Changed your mind?{' '}
        <Link to="/login" className="font-semibold text-blue-700 hover:underline dark:text-dark-blue-info">Back to login</Link>
      </p>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
