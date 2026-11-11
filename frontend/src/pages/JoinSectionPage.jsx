import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, LogIn, UserPlus, ArrowRightLeft, Users } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { classSpaceAPI, getErrorMessage } from '../services/api';
import { rememberPendingJoin, clearPendingJoin } from '../utils/pendingJoin';

/**
 * /join/:code - a section's shareable join link.
 *
 * Signed out: asks the student to sign in (or create an account) and comes
 * back here afterwards, even through email verification. Signed in as a
 * student: joins the section automatically - unless they're already in a
 * different section, where moving them needs a click.
 */
const JoinSectionPage = () => {
  const { code: rawCode } = useParams();
  const code = String(rawCode || '').toUpperCase().trim();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  // checking | confirm-move | joining | joined | already | error | not-student
  const [state, setState] = useState('checking');
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const started = useRef(false);
  const next = `/join/${encodeURIComponent(code)}`;

  const join = async () => {
    setState('joining');
    try {
      const res = await classSpaceAPI.join(code);
      clearPendingJoin();
      setMessage(res.data.message || `You joined ${res.data.data?.sectionCode || 'the section'}`);
      setState('joined');
      setTimeout(() => navigate('/classes', { replace: true }), 2200);
    } catch (err) {
      clearPendingJoin();
      setMessage(getErrorMessage(err, 'Could not join this section'));
      setState('error');
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      // Remember it through sign-up and email verification
      rememberPendingJoin(code);
      setState('signed-out');
      return;
    }
    if (user?.role !== 'student') { setState('not-student'); return; }
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await classSpaceAPI.joinPreview(code);
        const p = res.data.data;
        setPreview(p);
        if (p.currentSection && p.currentSection === p.sectionCode) {
          clearPendingJoin();
          setState('already');
        } else if (p.full) {
          clearPendingJoin();
          setMessage(`This link has expired because ${p.sectionCode} is full. Ask your program manager for a renewed link.`);
          setState('error');
        } else if (p.currentSection) {
          setState('confirm-move'); // moving sections is never silent
        } else {
          join(); // authorised and not in a section: enrol straight away
        }
      } catch (err) {
        clearPendingJoin();
        setMessage(getErrorMessage(err, 'This join link is not valid'));
        setState('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user?.role, code]);

  const sectionLine = preview
    ? `${preview.program} · Year ${preview.yearLevel} · Sem ${preview.semester} · ${preview.shift} shift`
    : '';

  const Card = ({ tone = 'blue', icon: Icon, title, children }) => {
    const tones = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
      green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
      orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
      red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    };
    return (
      <div className="text-center" role="status" aria-live="polite">
        <span className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon className={`h-7 w-7 ${Icon === Loader2 ? 'animate-spin' : ''}`} />
        </span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{children}</div>
      </div>
    );
  };

  const primary = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700';
  const secondary = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

  return (
    <AuthLayout
      eyebrow="Section invitation"
      title="Join your"
      highlight="section"
      description="Your program manager shared this link so you can join your section and all of its classes in one step."
    >
      <div className="mx-auto w-full max-w-sm">
        {(state === 'checking' || authLoading) && (
          <Card icon={Loader2} title="Checking your link…">Code <span className="font-mono font-semibold">{code}</span></Card>
        )}

        {state === 'signed-out' && !authLoading && (
          <>
            <Card icon={Users} title="Sign in to join">
              Sign in with your <strong>student</strong> account and you&apos;ll be added to the section automatically.
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Join code <span className="font-mono font-semibold">{code}</span></p>
            </Card>
            <div className="mt-6 space-y-2">
              <Link to={`/login?next=${encodeURIComponent(next)}`} className={primary}><LogIn className="h-4 w-4" /> Sign in</Link>
              <Link to={`/signup?next=${encodeURIComponent(next)}`} className={secondary}><UserPlus className="h-4 w-4" /> Create a student account</Link>
            </div>
          </>
        )}

        {state === 'not-student' && (
          <>
            <Card tone="orange" icon={AlertTriangle} title="Students only">
              This link adds a <strong>student</strong> to a section. You&apos;re signed in as {user?.role?.replace(/_/g, ' ')}.
            </Card>
            <Link to="/dashboard" className={`${secondary} mt-6`}>Go to the dashboard</Link>
          </>
        )}

        {state === 'confirm-move' && preview && (
          <>
            <Card tone="orange" icon={ArrowRightLeft} title={`Move to ${preview.sectionCode}?`}>
              You&apos;re currently in <strong>{preview.currentSection}</strong>. Joining moves you to <strong>{preview.sectionCode}</strong>
              {' '}({sectionLine}) and replaces your section&apos;s classes.
            </Card>
            <div className="mt-6 space-y-2">
              <button type="button" onClick={join} className={primary}><ArrowRightLeft className="h-4 w-4" /> Move to {preview.sectionCode}</button>
              <Link to="/classes" onClick={clearPendingJoin} className={secondary}>Stay in {preview.currentSection}</Link>
            </div>
          </>
        )}

        {state === 'joining' && (
          <Card icon={Loader2} title={`Joining ${preview?.sectionCode || 'your section'}…`}>{sectionLine}</Card>
        )}

        {state === 'joined' && (
          <>
            <Card tone="green" icon={CheckCircle2} title="You're in!">
              {message}. Taking you to your classes…
            </Card>
            <Link to="/classes" className={`${primary} mt-6`}>Go to my classes</Link>
          </>
        )}

        {state === 'already' && preview && (
          <>
            <Card tone="green" icon={CheckCircle2} title={`You're already in ${preview.sectionCode}`}>{sectionLine}</Card>
            <Link to="/classes" className={`${primary} mt-6`}>Go to my classes</Link>
          </>
        )}

        {state === 'error' && (
          <>
            <Card tone="red" icon={AlertTriangle} title="Couldn't join">{message}</Card>
            <Link to={isAuthenticated ? '/classes' : '/'} className={`${secondary} mt-6`}>
              {isAuthenticated ? 'Enter a code instead' : 'Back to home'}
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default JoinSectionPage;
