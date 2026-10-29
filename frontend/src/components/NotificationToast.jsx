import React from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { notificationLook } from './notificationMeta';

/** Pop-up for a notification that just arrived. Click opens it. */
const NotificationToast = ({ t, notification: n, onOpen }) => {
  const { Icon, tone } = notificationLook(n);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl transition-all dark:border-gray-700 dark:bg-gray-800 ${
        t.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900 dark:text-white">{n.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600 dark:text-gray-300">{n.message}</span>
          {n.metadata?.changes?.length > 0 && (
            <span className="mt-1 block truncate text-[11px] text-gray-500 dark:text-gray-400">{n.metadata.changes[0]}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss"
        className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default NotificationToast;
