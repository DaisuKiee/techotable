/**
 * A section join link opened while signed out. Remembered (for a day) so the
 * student lands back on it after signing in - even when signing up meant
 * leaving the site to verify their email first.
 */
const KEY = 'pendingSectionJoin';
const TTL = 24 * 60 * 60 * 1000;

export const rememberPendingJoin = (code) => {
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* not remembered */ }
};

export const clearPendingJoin = () => {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
};

/** "/join/CODE" if a recent join link is waiting, else null. */
export const pendingJoinPath = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!v?.code || Date.now() - v.at > TTL) return null;
    return `/join/${encodeURIComponent(v.code)}`;
  } catch {
    return null;
  }
};

/** A same-site path from ?next=, or null (never an outside URL). */
export const safeNext = (search) => {
  const next = new URLSearchParams(search || '').get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
};
