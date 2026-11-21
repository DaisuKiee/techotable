/**
 * Where to load an uploaded file from.
 *
 * The server stores one of two shapes, depending on how it is configured:
 *
 *   "/uploads/avatars/avatar-1.jpg"          local disk
 *   "https://pub-xxxx.r2.dev/avatars/..."    Cloudflare R2
 *
 * Screens used to build these by hand, concatenating the API origin onto the
 * stored value. That is correct for the first shape and wrong for the second:
 * it produces "http://localhost:5000https://pub-xxxx.r2.dev/...". With avatars
 * moving to object storage this helper is the single place that knows the
 * difference, so a stored value can change shape without touching any screen.
 *
 * @param {string|null|undefined} stored what the API returned
 * @returns {string|null} a URL the browser can load, or null
 */
export const fileUrl = (stored) => {
  if (!stored || typeof stored !== 'string') return null;

  const value = stored.trim();
  if (!value) return null;

  // Already absolute (R2, a CDN, or a data URI from a local preview).
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
};

export default fileUrl;
