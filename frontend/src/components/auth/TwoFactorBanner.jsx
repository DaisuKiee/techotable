import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * The two-step verification deadline, on every page.
 *
 * The countdown used to live only inside Settings -> Two-step verification,
 * which nobody opens unprompted - so the first warning most people would get
 * was being refused entry on day eight. This puts it where they already are.
 *
 * It can be dismissed, but only for the day, and only while there is still
 * time: on the last day it stays put, because by then "I never saw it" stops
 * being a reasonable thing for someone to be able to say.
 */

const DISMISSED_KEY = 'twofaBannerDismissedOn';

const today = () => new Date().toISOString().slice(0, 10);

const wasDismissedToday = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === today();
  } catch (_) {
    return false; // storage blocked: better to show it than to swallow it
  }
};

export default function TwoFactorBanner() {
  const { user } = useAuth();
  const state = user?.twoFactor;
  const [dismissed, setDismissed] = useState(wasDismissedToday);

  const daysLeft = state?.graceDaysLeft;
  // Past a certain point the warning stops being dismissible, so re-check
  // whenever the countdown changes rather than only on mount
  useEffect(() => {
    if (daysLeft !== null && daysLeft !== undefined && daysLeft <= 1) setDismissed(false);
  }, [daysLeft]);

  // Nothing to say: not required, already done, or the gate has taken over
  if (!state || !state.required || state.enrolled || state.mustEnrolNow) return null;
  if (dismissed) return null;

  const urgent = daysLeft <= 1;
  const soon = daysLeft <= 3;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, today()); } catch (_) { /* fine */ }
    setDismissed(true);
  };

  const headline = daysLeft <= 1
    ? 'Last day to set up two-step verification'
    : `${daysLeft} days left to set up two-step verification`;

  const tone = urgent
    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/25'
    : soon
    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/25'
    : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/25';

  const ink = urgent
    ? 'text-red-900 dark:text-red-200'
    : soon
    ? 'text-amber-900 dark:text-amber-200'
    : 'text-blue-900 dark:text-blue-200';

  const sub = urgent
    ? 'text-red-800 dark:text-red-300'
    : soon
    ? 'text-amber-800 dark:text-amber-300'
    : 'text-blue-800 dark:text-blue-300';

  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${tone}`}
    >
      <ShieldAlert className={`mt-0.5 h-5 w-5 flex-shrink-0 ${ink}`} />

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${ink}`}>{headline}</p>
        <p className={`text-sm ${sub}`}>
          After that you will need one before you can sign in. A fingerprint,
          an authenticator app or emailed codes all work — it takes about a minute.
        </p>
      </div>

      <Link
        to="/settings?tab=twofactor"
        className={`flex flex-shrink-0 items-center gap-1 self-center rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
          urgent ? 'bg-red-600 hover:bg-red-700' : soon ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        Set it up
        <ChevronRight className="h-4 w-4" />
      </Link>

      {!urgent && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide until tomorrow"
          title="Hide until tomorrow"
          className={`flex-shrink-0 self-center rounded p-1 opacity-60 transition-opacity hover:opacity-100 ${ink}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
