import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';
import NotificationToast from '../components/NotificationToast';

/**
 * One live connection per tab for notifications and data-change signals.
 *
 * Replaces the bell's polling (every 60s, and once per bell - the phone and
 * desktop headers each had their own). The server pushes over
 * GET /api/notifications/stream:
 *   notification -> prepend, bump the badge, show a toast
 *   unread / read / deleted / cleared -> keep tabs in step
 *   changed { topics } -> pages using useLiveRefresh refetch their data
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const PAGE = 15;

const NotificationContext = createContext(null);

// Parse a text/event-stream body into { event, data } messages
const readEvents = async (body, onEvent, signal) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let event = 'message';
      const data = [];
      block.split('\n').forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trim());
      });
      if (data.length) {
        try { onEvent(event, JSON.parse(data.join('\n'))); } catch (_) { /* bad frame */ }
      }
    }
  }
};

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | live | offline
  const listeners = useRef(new Set());
  const seen = useRef(new Set());
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title.replace(/^\(\d+\+?\) /, '') : '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll({ limit: PAGE });
      setItems(res.data.data || []);
      setHasMore(!!res.data.hasMore);
      setUnread(res.data.unreadCount || 0);
      (res.data.data || []).forEach((n) => seen.current.add(n._id));
    } catch (_) {
      // The bell just stays as it was; the stream retries on its own
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const res = await notificationAPI.getAll({ limit: PAGE, before: last._id });
      setItems((prev) => [...prev, ...(res.data.data || []).filter((n) => !prev.some((p) => p._id === n._id))]);
      setHasMore(!!res.data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [items]);

  const open = useCallback((n) => {
    if (n.link) navigate(n.link);
  }, [navigate]);

  // A new notification while the user is here: toast it (and a desktop
  // notification when the tab is in the background and permission was given)
  const announce = useCallback((n) => {
    toast.custom((t) => (
      <NotificationToast
        t={t}
        notification={n}
        onOpen={() => {
          toast.dismiss(t.id);
          notificationAPI.markAsRead(n._id).catch(() => {});
          open(n);
        }}
      />
    ), { duration: 6000, position: 'top-right' });

    if (typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const desktop = new Notification(n.title, { body: n.message, tag: n._id, icon: '/favicon.png' });
        desktop.onclick = () => { window.focus(); open(n); desktop.close(); };
      } catch (_) { /* some browsers only allow this from a service worker */ }
    }
  }, [open]);

  const handleEvent = useCallback((event, data) => {
    switch (event) {
      case 'ready':
        setStatus('live');
        if (typeof data.unread === 'number') setUnread(data.unread);
        break;
      case 'notification':
        if (seen.current.has(data._id)) return;
        seen.current.add(data._id);
        setItems((prev) => [data, ...prev]);
        setUnread((u) => u + 1);
        announce(data);
        break;
      case 'unread':
        setUnread(data.count || 0);
        break;
      case 'read':
        setItems((prev) => prev.map((n) => (data.all || (data.ids || []).includes(n._id) ? { ...n, isRead: true } : n)));
        break;
      case 'deleted':
        setItems((prev) => prev.filter((n) => !(data.ids || []).includes(n._id)));
        break;
      case 'cleared':
        setItems((prev) => prev.filter((n) => !n.isRead));
        break;
      case 'changed':
        listeners.current.forEach((fn) => {
          try { fn(data.topics || []); } catch (_) { /* a page's refresh failed */ }
        });
        break;
      default:
    }
  }, [announce]);

  // The live connection, with backoff, reconnecting when the tab comes back
  // online. Rebuilt when the signed-in user changes.
  useEffect(() => {
    if (!isAuthenticated || !user?._id) {
      setItems([]);
      setUnread(0);
      setStatus('idle');
      return undefined;
    }

    let stopped = false;
    let attempt = 0;
    let controller;
    let timer;

    const connect = async () => {
      if (stopped) return;
      controller = new AbortController();
      setStatus(attempt ? 'connecting' : 'connecting');
      try {
        const res = await fetch(`${API_BASE}/notifications/stream`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'text/event-stream' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 401) { setStatus('offline'); return; } // signed out elsewhere
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        attempt = 0;
        // Anything that arrived while disconnected
        if (!stopped) load();
        await readEvents(res.body, handleEvent, controller.signal);
      } catch (_) {
        // network drop, server restart, or abort
      }
      if (stopped) return;
      setStatus('offline');
      attempt += 1;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)) + Math.random() * 1000;
      timer = setTimeout(connect, delay);
    };

    const reconnectNow = () => {
      if (stopped) return;
      clearTimeout(timer);
      controller?.abort();
      attempt = 0;
      connect();
    };

    load();
    connect();
    window.addEventListener('online', reconnectNow);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      window.removeEventListener('online', reconnectNow);
    };
  }, [isAuthenticated, user?._id, load, handleEvent]);

  // Unread count in the tab title, e.g. "(3) CoTE Timetabling"
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const base = baseTitle.current || document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${base}` : base;
  }, [unread]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await notificationAPI.markAsRead(id); } catch (_) { load(); }
  }, [load]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try { await notificationAPI.markAllAsRead(); } catch (_) { load(); }
  }, [load]);

  const remove = useCallback(async (id) => {
    const target = items.find((n) => n._id === id);
    setItems((prev) => prev.filter((n) => n._id !== id));
    if (target && !target.isRead) setUnread((u) => Math.max(0, u - 1));
    try { await notificationAPI.delete(id); } catch (_) { load(); }
  }, [items, load]);

  const clearRead = useCallback(async () => {
    setItems((prev) => prev.filter((n) => !n.isRead));
    try { await notificationAPI.clearRead(); } catch (_) { load(); }
  }, [load]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const value = useMemo(() => ({
    items, unread, hasMore, loading, status,
    load, loadMore, markRead, markAllRead, remove, clearRead, open, subscribe,
  }), [items, unread, hasMore, loading, status, load, loadMore, markRead, markAllRead, remove, clearRead, open, subscribe]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
};

/**
 * Refetch when the server says some of `topics` changed (e.g. a class was
 * moved). Rapid bursts are folded into one call.
 */
export const useLiveRefresh = (topics, refresh) => {
  // Only the stable subscribe function: depending on the whole context
  // re-subscribed on every badge update, and that cleanup cancelled the
  // refresh that the same server message had just scheduled.
  const subscribe = useContext(NotificationContext)?.subscribe;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const key = [].concat(topics).join(',');

  useEffect(() => {
    if (!subscribe) return undefined;
    const wanted = key.split(',');
    let timer;
    const unsubscribe = subscribe((changed) => {
      if (!changed.some((t) => wanted.includes(t))) return;
      clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current?.(), 400);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [subscribe, key]);
};

export default NotificationContext;
