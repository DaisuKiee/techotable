import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * A gentle reminder, on every page, to turn on two-step verification.
 *
 * Two-step verification is recommended, not required — there is no deadline and
 * no lock-out. This just puts the nudge where people already are instead of
 * only inside Settings, which nobody opens unprompted. It can be dismissed for
 * the day.
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

  // Nothing to say: not recommended for this account, or already set up.
  if (!state || !state.required || state.enrolled) return null;
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, today()); } catch (_) { /* fine */ }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/25"
    >
      <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-900 dark:text-blue-200" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          Secure your account with two-step verification
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Add a second sign-in step — a fingerprint, an authenticator app or
          emailed codes. It takes about a minute and you can do it any time.
        </p>
      </div>

      <Link
        to="/settings?tab=twofactor"
        className="flex flex-shrink-0 items-center gap-1 self-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Set it up
        <ChevronRight className="h-4 w-4" />
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide until tomorrow"
        title="Hide until tomorrow"
        className="flex-shrink-0 self-center rounded p-1 text-blue-900 opacity-60 transition-opacity hover:opacity-100 dark:text-blue-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
