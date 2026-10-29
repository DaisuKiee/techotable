import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MailX, MailCheck, Mail, Loader2, Calendar, Bell, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AuthLayout, AuthField, AuthStatus, FormAlert, SubmitButton, SecondaryButton,
} from '../components/auth/AuthLayout';
import CampusWalkLoader from '../components/CampusWalkLoader';

const FEATURES = [
  { icon: Calendar, title: 'Your schedule', text: 'Your whole week, on any device.' },
  { icon: Bell, title: 'Change alerts', text: 'Notified when a class moves or a room changes.' },
  { icon: Users, title: 'Class spaces', text: 'Announcements and materials from your instructors.' },
];

const EmailVerificationPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState({ loading: false, sent: false, error: '' });
  // A verification token works once. React runs effects twice in development,
  // and the second request found the token already used and showed
  // "verification failed" over a verification that had just succeeded.
  const requested = useRef(null);

  useEffect(() => {
    if (requested.current === token) return;
    requested.current = token;

    api.get(`/auth/verify-email/${token}`)
      .then((response) => {
        if (!response.data.success) throw new Error(response.data.message);
        setMessage(response.data.message);
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          setAuth(response.data.user, response.data.token);
        }
        setStatus('success');
      })
      .catch((error) => {
        setMessage(error.response?.data?.message || error.message || 'Email verification failed');
        setStatus('error');
      });
  }, [token, setAuth]);

  // Verification signs the user in, so go straight to the dashboard. This
  // used to send them to the login page with "please log in", which the login
  // page then skipped because they already were.
  useEffect(() => {
    if (status !== 'success') return undefined;
    const t = setTimeout(() => navigate('/dashboard'), 1400);
    return () => clearTimeout(t);
  }, [status, navigate]);

  const resend = async (e) => {
    e.preventDefault();
    setResendState({ loading: true, sent: false, error: '' });
    try {
      await api.post('/auth/resend-verification', { email: resendEmail.trim() });
      setResendState({ loading: false, sent: true, error: '' });
    } catch (err) {
      setResendState({
        loading: false,
        sent: false,
        error: err.response?.data?.message || 'Could not send the email. Try again.',
      });
    }
  };

  if (status === 'success') {
    return (
      <CampusWalkLoader
        duration={1.4}
        title="Email verified"
        subtitle="Welcome to CTU Daanbantayan"
        caption="Opening your dashboard…"
      />
    );
  }

  const alreadyVerified = /already verified/i.test(resendState.error);

  return (
    <AuthLayout
      eyebrow="For students"
      title="One last step"
      highlight="before your timetable."
      description="Confirming your email keeps your account and your schedule notifications going to the right place."
      features={FEATURES}
    >
      {status === 'verifying' ? (
        <AuthStatus tone="info" icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Verifying your email">
          <p>This only takes a moment.</p>
        </AuthStatus>
      ) : resendState.sent ? (
        <AuthStatus
          tone="success"
          icon={<MailCheck className="h-8 w-8" />}
          title="New link sent"
          actions={<SecondaryButton onClick={() => navigate('/login')}>Back to login</SecondaryButton>}
        >
          <p>We've sent a fresh verification link to</p>
          <p className="font-semibold text-gray-900 dark:text-dark-text-primary">{resendEmail.trim()}</p>
          <p className="pt-2 text-xs text-gray-500 dark:text-dark-text-muted">Open the newest email - earlier links no longer work.</p>
        </AuthStatus>
      ) : (
        <AuthStatus
          tone="error"
          icon={<MailX className="h-8 w-8" />}
          title="This link didn't work"
          actions={(
            <form onSubmit={resend} className="space-y-4">
              {resendState.error && (
                <FormAlert>
                  {resendState.error}
                  {alreadyVerified && ' You can log in now.'}
                </FormAlert>
              )}
              <AuthField
                label="Send a new link to"
                icon={Mail}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={resendEmail}
                onChange={(e) => { setResendEmail(e.target.value); setResendState((s) => ({ ...s, error: '' })); }}
                placeholder="you@ctu.edu.ph"
              />
              <SubmitButton loading={resendState.loading} loadingText="Sending…">Resend verification email</SubmitButton>
              <SecondaryButton onClick={() => navigate('/login', alreadyVerified ? { state: { email: resendEmail.trim() } } : undefined)}>
                Back to login
              </SecondaryButton>
            </form>
          )}
        >
          <p>{message || 'The verification link is invalid or has expired.'}</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">Links expire after a while, and each one works only once.</p>
        </AuthStatus>
      )}
    </AuthLayout>
  );
};

export default EmailVerificationPage;
