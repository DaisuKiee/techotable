import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, MailCheck, KeyRound, ShieldCheck, Clock } from 'lucide-react';
import { authAPI } from '../services/api';
import {
  AuthLayout, AuthField, AuthStatus, FormAlert, SubmitButton, SecondaryButton,
} from '../components/auth/AuthLayout';

const FEATURES = [
  { icon: Mail, title: 'Link by email', text: 'We send a one-time reset link to your inbox.' },
  { icon: Clock, title: 'Expires in 10 min', text: 'An old link can\'t be used to get in later.' },
  { icon: ShieldCheck, title: 'Private', text: 'We never say whether an email has an account.' },
];

// Resending straight away mostly produces duplicate emails
const RESEND_COOLDOWN = 30;

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Carried over from the login form, so it doesn't have to be typed twice
  const [email, setEmail] = useState(location.state?.email || '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef(null);

  useEffect(() => {
    if (!submitted) emailRef.current?.focus();
  }, [submitted]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendLink = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.forgotPassword({ email: email.trim() });

      if (response.data.success) {
        setSubmitted(true);
        setCooldown(RESEND_COOLDOWN);
      } else {
        setError(response.data.message || 'Failed to process request');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendLink();
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Locked out?"
      highlight="Let's get you back in."
      description="Reset your password from your email and pick up right where your timetable left off."
      features={FEATURES}
    >
      {submitted ? (
        <AuthStatus
          tone="success"
          icon={<MailCheck className="h-8 w-8" />}
          title="Check your email"
          actions={(
            <>
              {error && <FormAlert>{error}</FormAlert>}
              <SubmitButton type="button" onClick={() => navigate('/login', { state: { email: email.trim() } })}>
                Back to login
              </SubmitButton>
              <SecondaryButton onClick={sendLink} disabled={loading || cooldown > 0}>
                {loading ? 'Sending…' : cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
              </SecondaryButton>
              <button
                type="button"
                onClick={() => { setSubmitted(false); setError(''); }}
                className="w-full text-center text-sm font-semibold text-blue-700 hover:underline dark:text-dark-blue-info"
              >
                Use a different email
              </button>
            </>
          )}
        >
          <p>If an account uses this address, a reset link is on its way to</p>
          <p className="font-semibold text-gray-900 dark:text-dark-text-primary">{email.trim()}</p>
          <p className="pt-2 text-xs text-gray-500 dark:text-dark-text-muted">
            The link expires in 10 minutes. Can't find it? Check your spam folder.
          </p>
        </AuthStatus>
      ) : (
        <>
          <div className="auth-rise" style={{ animationDelay: '.05s' }}>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">
              Forgot your password?
            </h1>
            <p className="mb-7 text-sm text-gray-600 dark:text-dark-text-secondary">
              Enter the email you log in with and we'll send you a link to set a new one.
            </p>
          </div>

          {error && <FormAlert>{error}</FormAlert>}

          <form onSubmit={handleSubmit} className="auth-rise space-y-5" style={{ animationDelay: '.1s' }}>
            <AuthField
              ref={emailRef}
              label="Email address"
              icon={Mail}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@ctu.edu.ph"
            />
            <SubmitButton loading={loading} loadingText="Sending link…">Send reset link</SubmitButton>
          </form>

          <p className="auth-rise mt-8 border-t border-gray-200 pt-6 text-sm text-gray-600 dark:border-dark-border-subtle dark:text-dark-text-secondary" style={{ animationDelay: '.15s' }}>
            Remembered it?{' '}
            <Link to="/login" state={{ email: email.trim() }} className="font-semibold text-blue-700 hover:underline dark:text-dark-blue-info">
              Back to login
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
