/**
 * Building database queries out of things the caller typed.
 *
 * Mongo is not SQL, so there is no "DROP TABLE" to worry about - but a search
 * box that is pasted straight into `$regex` is the same class of bug, with
 * two ways to go wrong:
 *
 *   Denial of service. `(a+)+$` is a valid regular expression that takes
 *   exponential time on a long non-matching string. One request with that in
 *   ?search= pins a CPU core until the query times out, and a handful of them
 *   take the API down. This is the realistic attack on this app.
 *
 *   Unintended matching. `.*` in a search term quietly turns a narrow lookup
 *   into "everything", which can walk straight past a filter that was meant
 *   to scope results to one programme.
 *
 * Both disappear if the term is escaped to a literal and capped in length.
 */

/** Every regex metacharacter, turned into an ordinary character. */
const escapeRegex = (value) => String(value == null ? '' : value)
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Longer than this is not a search, it is an attempt to make one expensive. */
const MAX_TERM = 80;

/**
 * A search term, ready to drop into `$regex`: escaped, trimmed and capped.
 * Returns null when there is nothing worth searching for, so callers can skip
 * adding the clause at all.
 */
const searchTerm = (raw) => {
  const text = String(raw == null ? '' : raw).trim().slice(0, MAX_TERM);
  return text ? escapeRegex(text) : null;
};

/**
 * `searchClause('abc', ['firstName', 'email'])`
 *   -> { $or: [{ firstName: {...} }, { email: {...} }] }
 * Returns null when the term is empty, so it can be spread conditionally.
 */
const searchClause = (raw, fields) => {
  const term = searchTerm(raw);
  if (!term || !fields || fields.length === 0) return null;
  return { $or: fields.map((field) => ({ [field]: { $regex: term, $options: 'i' } })) };
};

/**
 * Page size the caller asked for, kept inside something the server can
 * actually serve. An unbounded ?limit= is a one-request way to make the
 * database read an entire collection into memory.
 */
const clampLimit = (raw, { fallback = 50, max = 200 } = {}) => {
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
};

/** Same idea for an offset: no negatives, and not far enough out to be a scan. */
const clampSkip = (raw, { max = 100000 } = {}) => {
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, max);
};

module.exports = { escapeRegex, searchTerm, searchClause, clampLimit, clampSkip, MAX_TERM };
