/**
 * Brute-force protection at the source, not just the target.
 *
 * The account lockout in session.service.js stops someone hammering ONE
 * account: five wrong passwords and it freezes for fifteen minutes. It does
 * nothing about the attack that is actually common - credential stuffing,
 * where a leaked list of e-mail/password pairs is tried once each against
 * thousands of accounts. No single account ever reaches five failures, so
 * no lock ever fires, and the whole run looks like ordinary traffic.
 *
 * What gives it away is the source: one address failing against many
 * different accounts. A real person fails against their own account, a few
 * times, and then succeeds or resets.
 *
 * Thresholds are tuned for the fact that this whole campus shares one public
 * address. A morning rush of students signing in produces a steady trickle of
 * mistyped passwords across many different accounts, so "many accounts" on
 * its own is NOT evidence of an attack here - it is a normal Monday.
 *
 * The signal that does separate them is failures against accounts that do not
 * exist. Real students have accounts; a stuffing list is mostly addresses
 * this system has never seen. So an unknown address is counted far more
 * strictly than a wrong password on a real one.
 *
 * State is in memory on purpose: it costs nothing per request, and losing it
 * on restart is fine - an attacker gains one restart's worth of attempts, and
 * the per-account lockout is still there underneath.
 */

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 10 * 60 * 1000;

// Sheer volume from one address. High enough that a campus signing in at
// 7:30am never reaches it.
const MAX_FAILURES = 120;
// Many different real accounts. Still possible for a busy campus, so this is
// set well above a plausible morning rather than at the attack's floor.
const MAX_DISTINCT_ACCOUNTS = 40;
// Accounts that do not exist here. Almost nothing legitimate produces these
// in bulk, so this is the threshold that actually catches stuffing.
const MAX_UNKNOWN_ACCOUNTS = 12;

// ip -> { failures, accounts:Set, windowStartedAt, blockedUntil }
const sources = new Map();

const now = () => Date.now();

const freshEntry = () => ({
  failures: 0,
  accounts: new Set(),
  unknownAccounts: new Set(),
  windowStartedAt: now(),
  blockedUntil: 0,
});

const entryFor = (ip) => {
  let entry = sources.get(ip);
  if (!entry) {
    entry = freshEntry();
    sources.set(ip, entry);
    return entry;
  }
  // A quiet window expires, so yesterday's typos never add to today's count
  if (now() - entry.windowStartedAt > WINDOW_MS && now() > entry.blockedUntil) {
    entry = freshEntry();
    sources.set(ip, entry);
  }
  return entry;
};

/**
 * Drop entries nobody has touched in a while, so a long-running server does
 * not hold a row for every address that ever mistyped a password.
 */
const sweep = () => {
  const cutoff = now() - WINDOW_MS * 2;
  sources.forEach((entry, ip) => {
    if (entry.windowStartedAt < cutoff && entry.blockedUntil < now()) sources.delete(ip);
  });
};
const sweeper = setInterval(sweep, 10 * 60 * 1000);
if (sweeper.unref) sweeper.unref(); // never hold the process open

/**
 * Record one failed sign-in from this request's address.
 * `known` says whether the e-mail belongs to a real account here, which is
 * the difference between a student fumbling their password and a list being
 * worked through.
 */
const recordFailure = (req, email, { known = true } = {}) => {
  const entry = entryFor(req.ip);
  entry.failures += 1;
  const address = email ? String(email).toLowerCase() : null;
  if (address) {
    entry.accounts.add(address);
    if (!known) entry.unknownAccounts.add(address);
  }

  const reason = entry.unknownAccounts.size >= MAX_UNKNOWN_ACCOUNTS
    ? `${entry.unknownAccounts.size} addresses with no account here`
    : entry.accounts.size >= MAX_DISTINCT_ACCOUNTS
    ? `${entry.accounts.size} different accounts`
    : entry.failures >= MAX_FAILURES
    ? `${entry.failures} failed attempts`
    : null;

  if (reason) {
    entry.blockedUntil = now() + BLOCK_MS;
    console.warn(`[security] blocking ${req.ip} for ${BLOCK_MS / 60000} minutes: ${reason} in ${WINDOW_MS / 60000} minutes`);
  }
};

/** A sign-in succeeded: this address is evidently not running a script. */
const recordSuccess = (req) => {
  sources.delete(req.ip);
};

/**
 * Refuse sign-in attempts from an address that is currently blocked.
 *
 * Sits in front of the login routes. The message says how long is left rather
 * than what tripped it: an attacker who learns which signal fired learns how
 * to stay under it.
 */
const blockSuspectedBruteForce = (req, res, next) => {
  const entry = sources.get(req.ip);
  if (!entry || entry.blockedUntil < now()) return next();

  const minutes = Math.max(1, Math.ceil((entry.blockedUntil - now()) / 60000));
  return res.status(429).json({
    success: false,
    code: 'TOO_MANY_ATTEMPTS',
    message: `Too many failed sign-in attempts from this network. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  });
};

/** For the tests and for an operator who needs to clear a block by hand. */
const reset = (ip) => (ip ? sources.delete(ip) : sources.clear());
const inspect = (ip) => sources.get(ip) || null;

module.exports = {
  blockSuspectedBruteForce,
  recordFailure,
  recordSuccess,
  reset,
  inspect,
  MAX_FAILURES,
  MAX_DISTINCT_ACCOUNTS,
  MAX_UNKNOWN_ACCOUNTS,
};
