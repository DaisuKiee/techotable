import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TwoFactorSettings from '../settings/TwoFactorSettings';

/**
 * Stands between a signed-in person and the rest of the app once their
 * grace period for enrolling a second factor has run out.
 *
 * Two deliberate choices:
 *
 *   The grace period means switching this on does not lock out the whole
 *   campus at once; everyone gets a week of reminders from the first time
 *   they are told, not from a deployment date they never saw.
 *
 *   Signing out stays available. A gate nobody can leave is how people end
 *   up locked out of an account they could otherwise still recover.
 */
export default function TwoFactorGate({ children }) {
  const { user, logout, loadUser } = useAuth();
  const state = user?.twoFactor;

  if (!state || !state.required || state.enrolled || !state.mustEnrolNow) {
    return children;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-900/20">
          <ShieldAlert className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
              Set up two-step verification to continue
            </h1>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              This account holds real schedules and student records, so a password
              on its own is no longer enough. Add one method below - it takes about
              a minute, and you will only be asked for it when you sign in on a new
              device.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <TwoFactorSettings />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={loadUser}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            I have set it up - continue
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
