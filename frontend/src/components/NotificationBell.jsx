import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Check, Trash2, X, BellRing, Loader2, Eraser } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useDockBlo } from '../utils/bloDock';
import { notificationLook, FILTERS, matchesFilter, timeAgo, dayGroup } from './notificationMeta';

const NotificationBell = () => {
  const {
    items, unread, hasMore, loading, status, loadMore, markRead, markAllRead, remove, clearRead, open,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  // The B-LO bubble sits where the panel's footer is; step it aside while open
  useDockBlo(isOpen);
  const [filter, setFilter] = useState('all');
  const [desktopAllowed, setDesktopAllowed] = useState(
    () => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported')
  );
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // Escape closes; focus goes back to the bell
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const visible = useMemo(() => items.filter((n) => matchesFilter(n, filter)), [items, filter]);
  const groups = useMemo(() => {
    const out = [];
    visible.forEach((n) => {
      const g = dayGroup(n.createdAt);
      if (!out.length || out[out.length - 1].label !== g) out.push({ label: g, items: [] });
      out[out.length - 1].items.push(n);
    });
    return out;
  }, [visible]);
  const hasRead = items.some((n) => n.isRead);
  const unreadBy = useMemo(() => {
    const out = {};
    FILTERS.forEach((f) => { out[f.id] = items.filter((n) => !n.isRead && matchesFilter(n, f.id)).length; });
    out.all = unread; // the server's count, which includes pages not loaded yet
    out.unread = unread;
    return out;
  }, [items, unread]);

  const handleClick = (n) => {
    if (!n.isRead) markRead(n._id);
    if (n.link) {
      setIsOpen(false);
      open(n);
    }
  };

  const askDesktop = async () => {
    try {
      setDesktopAllowed(await Notification.requestPermission());
    } catch (_) { /* ignored */ }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-800">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[99998] bg-black/30 sm:z-40 sm:bg-transparent" onClick={() => setIsOpen(false)} aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            // Phones: a full-height sheet under the top bar. Larger screens: a dropdown.
            className="fixed inset-x-0 bottom-0 top-16 z-[99999] flex flex-col overflow-hidden border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[min(44rem,calc(100dvh-5rem))] sm:z-50 sm:w-[28rem] sm:rounded-xl sm:border"
          >
            {/* Header: title, unread count, plain-text actions */}
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unread > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">{unread} new</span>
              )}
              {status !== 'live' && status !== 'idle' && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400" title="Live updates paused; retrying">
                  <span className={`h-1.5 w-1.5 rounded-full ${status === 'connecting' ? 'bg-orange-400' : 'bg-gray-400'}`} />
                  {status === 'connecting' ? 'Connecting' : 'Offline'}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:text-gray-400 disabled:hover:bg-transparent dark:text-blue-300 dark:hover:bg-blue-900/30 dark:disabled:text-gray-500"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 sm:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filters: equal-width tabs, each with its unread count */}
            <div className="grid grid-cols-5 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Filter notifications">
              {FILTERS.map((f) => {
                const count = unreadBy[f.id] || 0;
                const on = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFilter(f.id)}
                    className={`-mb-px flex items-center justify-center gap-1 border-b-2 px-1 py-2 text-xs font-medium transition-colors ${
                      on
                        ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                        : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] font-semibold ${on ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <Bell className="mb-2 h-9 w-9 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {filter === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Schedule changes, announcements and updates show up here the moment they happen.
                  </p>
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <p className="sticky top-0 z-[1] border-b border-gray-100 bg-white/95 px-4 py-1 text-[11px] font-semibold text-gray-500 backdrop-blur dark:border-gray-700/60 dark:bg-gray-800/95 dark:text-gray-400">
                      {g.label}
                    </p>
                    <ul>
                      {g.items.map((n) => {
                        const { Icon, tone } = notificationLook(n);
                        return (
                          <li key={n._id} className={`group relative border-b border-gray-100 dark:border-gray-700/60 ${n.isRead ? '' : 'bg-blue-50/60 dark:bg-blue-900/10'}`}>
                            {/* Unread marker on the left edge */}
                            {!n.isRead && <span className="absolute inset-y-0 left-0 w-0.5 bg-blue-500" aria-hidden="true" />}
                            <button
                              type="button"
                              onClick={() => handleClick(n)}
                              className="flex w-full gap-3 px-4 py-2.5 pr-16 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                            >
                              <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className={`min-w-0 flex-1 truncate text-sm ${n.isRead ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-white'}`}>
                                    {!n.isRead && <span className="sr-only">Unread: </span>}
                                    {n.title}
                                  </span>
                                  <time className="flex-shrink-0 text-[11px] tabular-nums text-gray-500 dark:text-gray-400" dateTime={n.createdAt}>
                                    {timeAgo(n.createdAt)}
                                  </time>
                                </span>
                                <span className={`mt-0.5 text-xs leading-snug ${n.isRead ? 'line-clamp-1 text-gray-500 dark:text-gray-400' : 'line-clamp-2 text-gray-600 dark:text-gray-300'}`}>
                                  {n.message}
                                </span>
                                {n.metadata?.changes?.length > 0 && (
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {n.metadata.changes.map((c) => (
                                      <span key={c} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-200">{c}</span>
                                    ))}
                                  </span>
                                )}
                                {n.actorName && (
                                  <span className="mt-0.5 block truncate text-[11px] text-gray-400 dark:text-gray-500">by {n.actorName}</span>
                                )}
                              </span>
                            </button>
                            {/* Quick actions: always on phones, on hover/focus elsewhere */}
                            <span className="absolute right-2 top-2 flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                              {!n.isRead && (
                                <button
                                  type="button"
                                  onClick={() => markRead(n._id)}
                                  aria-label="Mark as read"
                                  title="Mark as read"
                                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-300"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => remove(n._id)}
                                aria-label="Delete notification"
                                title="Delete"
                                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}

              {hasMore && filter === 'all' && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-60 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Show older
                </button>
              )}
            </div>

            {/* Footer: clear read, and the desktop-alerts offer when it applies */}
            <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900/40">
              {desktopAllowed === 'default' ? (
                <button type="button" onClick={askDesktop} className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
                  <BellRing className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">Get alerts in the background</span>
                </button>
              ) : (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{items.length} shown</span>
              )}
              <button
                type="button"
                onClick={clearRead}
                disabled={!hasRead}
                className="ml-auto flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear read
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
