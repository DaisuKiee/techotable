import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2, X, BellRing, Loader2, Eraser } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { notificationLook, FILTERS, matchesFilter, timeAgo, dayGroup } from './notificationMeta';

const NotificationBell = () => {
  const {
    items, unread, hasMore, loading, status, loadMore, markRead, markAllRead, remove, clearRead, open,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-2 top-16 z-50 flex max-h-[min(36rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[26rem]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-400' : 'bg-gray-400'}`} />
                  {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
                  {unread > 0 && <span>· {unread} unread</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unread === 0}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clearRead}
                  disabled={!hasRead}
                  title="Clear read notifications"
                  aria-label="Clear read notifications"
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
                >
                  <Eraser className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 sm:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3 py-2 dark:border-gray-700" role="tablist" aria-label="Filter notifications">
              {FILTERS.map((f) => {
                const count = f.id === 'unread' ? unread : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      filter === f.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f.label}{count ? ` ${count}` : ''}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <Bell className="mb-2 h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Schedule changes, announcements and updates show up here the moment they happen.
                  </p>
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <p className="sticky top-0 z-[1] bg-gray-50/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur dark:bg-gray-900/90 dark:text-gray-400">
                      {g.label}
                    </p>
                    <ul>
                      {g.items.map((n) => {
                        const { Icon, tone } = notificationLook(n);
                        return (
                          <li key={n._id} className={`group relative border-b border-gray-100 dark:border-gray-700/60 ${n.isRead ? '' : 'bg-blue-50/70 dark:bg-blue-900/15'}`}>
                            <button
                              type="button"
                              onClick={() => handleClick(n)}
                              className="flex w-full gap-3 px-4 py-3 pr-10 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start gap-2">
                                  <span className={`flex-1 text-sm ${n.isRead ? 'font-medium text-gray-800 dark:text-gray-200' : 'font-semibold text-gray-900 dark:text-white'}`}>
                                    {n.title}
                                  </span>
                                  {!n.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" aria-label="Unread" />}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600 dark:text-gray-300">{n.message}</span>
                                {n.metadata?.changes?.length > 0 && (
                                  <span className="mt-1.5 block space-y-0.5 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                                    {n.metadata.changes.map((c) => <span key={c} className="block">{c}</span>)}
                                  </span>
                                )}
                                <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400">
                                  {timeAgo(n.createdAt)}{n.actorName ? ` · by ${n.actorName}` : ''}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(n._id)}
                              aria-label="Delete notification"
                              title="Delete"
                              className="absolute right-2 top-3 rounded p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-red-600 focus:opacity-100 dark:hover:bg-gray-700 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Load older
                </button>
              )}
            </div>

            {desktopAllowed === 'default' && (
              <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <BellRing className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Get alerts even when this tab is in the background
                </p>
                <button type="button" onClick={askDesktop} className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  Turn on
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
