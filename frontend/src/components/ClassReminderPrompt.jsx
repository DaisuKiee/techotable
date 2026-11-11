import React, { useEffect, useState } from 'react';
import { AlarmClock, BellOff, BellRing, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

/*
 * Asks a teacher to let this site show desktop notifications, so class
 * reminders can pop up even while they're in another window. Browsers only
 * allow the permission request from a click, so it's a button, never automatic.
 *
 *   <ClassReminderPrompt />                 dashboard banner (hides once allowed)
 *   <ClassReminderPrompt variant="row" />   Settings: always shows the status
 */

const DISMISS_KEY = 'classReminderPrompt.dismissed';
const supported = () => typeof window !== 'undefined' && 'Notification' in window;
const readPermission = () => (supported() ? Notification.permission : 'unsupported');

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
};
const saveDismissed = () => {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) { /* private mode */ }
};

/** Notification permission, kept in sync if the user changes it in the browser. */
export const useNotificationPermission = () => {
  const [permission, setPermission] = useState(readPermission);

  useEffect(() => {
    let status;
    const sync = () => setPermission(readPermission());
    navigator.permissions?.query({ name: 'notifications' })
      .then((s) => { status = s; s.onchange = sync; })
      .catch(() => {});
    // Fallback for browsers without permissions.onchange: re-check on return
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('focus', sync);
      if (status) status.onchange = null;
    };
  }, []);

  const request = async () => {
    if (!supported()) return 'unsupported';
    let result;
    try {
      result = await Notification.requestPermission();
    } catch (_) {
      result = readPermission();
    }
    setPermission(result);
    if (result === 'granted') {
      try {
        new Notification('Class reminders are on', {
          body: 'You’ll get your classes each morning and a heads-up 15 minutes before each one.',
          icon: '/favicon.png',
        });
      } catch (_) { /* some browsers only allow this from a service worker */ }
      toast.success('Desktop class reminders are on');
    } else if (result === 'denied') {
      toast.error('Notifications are blocked for this site');
    }
    return result;
  };

  return { permission, request };
};

const BLOCKED_HELP = 'Click the lock icon next to the address bar, set Notifications to Allow, then reload the page.';

const ClassReminderPrompt = ({ variant = 'banner' }) => {
  const { permission, request } = useNotificationPermission();
  const [dismissed, setDismissed] = useState(readDismissed);

  /* ---- Settings row: always shows where things stand ---- */
  if (variant === 'row') {
    const look = {
      granted: { Icon: CheckCircle, tone: 'text-emerald-600 dark:text-emerald-400', text: 'Desktop alerts are allowed in this browser.' },
      default: { Icon: BellRing, tone: 'text-blue-600 dark:text-blue-400', text: 'Allow desktop alerts so reminders pop up even when this tab isn’t open in front.' },
      denied: { Icon: BellOff, tone: 'text-orange-600 dark:text-orange-400', text: `Desktop alerts are blocked. ${BLOCKED_HELP}` },
      unsupported: { Icon: BellOff, tone: 'text-gray-500', text: 'This browser can’t show desktop alerts. Reminders still appear in the bell.' },
    }[permission] || {};
    const { Icon } = look;
    return (
      <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
        {Icon && <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${look.tone}`} />}
        <p className="flex-1 text-sm text-gray-600 dark:text-gray-300">{look.text}</p>
        {permission === 'default' && (
          <button
            type="button"
            onClick={request}
            className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Allow
          </button>
        )}
      </div>
    );
  }

  /* ---- Dashboard banner: only while there's something to do ---- */
  if (permission === 'granted' || permission === 'unsupported' || dismissed) return null;

  const blocked = permission === 'denied';
  const dismiss = () => { saveDismissed(); setDismissed(true); };

  return (
    <div
      role="region"
      aria-label="Class reminders"
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
        blocked
          ? 'border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30'
          : 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30'
      }`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
        blocked ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300'
      }`}
      >
        {blocked ? <BellOff className="h-5 w-5" /> : <AlarmClock className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 dark:text-white">
          {blocked ? 'Class reminders can’t pop up' : 'Never miss a class'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {blocked
            ? `Your browser is blocking notifications from this site, so reminders only show in the bell. ${BLOCKED_HELP}`
            : 'Allow notifications to get today’s classes each morning and a reminder 15 minutes before each class.'}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {!blocked && (
          <button
            type="button"
            onClick={request}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Allow notifications
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-lg p-2 text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ClassReminderPrompt;
