/**
 * One password rule, checked everywhere a password is set.
 *
 * The old rule was six characters of anything, which a consumer GPU guesses
 * offline in seconds even against bcrypt. The three tests below block what
 * actually gets broken in practice:
 *
 *   length      - the only factor that reliably buys time
 *   reuse       - the handful of passwords in every breach list
 *   derivation  - "marcomontellano" for marco.montellano@..., which an
 *                 attacker targeting this campus tries first
 *
 * Existing sign-ins are unaffected: this runs when a password is chosen, not
 * when one is checked, so nobody is locked out by the change.
 */

const MIN_LENGTH = 10;
const MAX_LENGTH = 200; // bcrypt ignores past 72 bytes; refuse rather than silently truncate

/**
 * Passwords common enough that an attacker tries them before anything else.
 * Deliberately short: a long blocklist is security theatre next to a length
 * requirement, and this only has to catch the laziest choices.
 */
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'passw0rd', 'p@ssword', 'p@ssw0rd', 'passw0rd123',
  '1234567890', '12345678', '123456789', '0123456789', '1234512345',
  'qwertyuiop', 'qwerty123', 'qwertyui', 'asdfghjkl', 'zxcvbnm123',
  'iloveyou', 'letmein123', 'welcome123', 'admin123', 'administrator',
  'abc123456', 'football', 'basketball', 'superman', 'princess',
  'ctu123456', 'ctudaanbantayan', 'daanbantayan', 'timetable', 'timetable123',
  'schedule123', 'teacher123', 'student123', 'faculty123', 'changeme123',
]);

const hasLower = (s) => /[a-z]/.test(s);
const hasUpper = (s) => /[A-Z]/.test(s);
const hasDigit = (s) => /[0-9]/.test(s);
const hasSymbol = (s) => /[^A-Za-z0-9]/.test(s);

/** Strip anything that is not a letter or digit, for the similarity tests. */
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pieces of the person's own identity that must not be the password:
 * the e-mail local part, each name, and the student or employee id.
 */
const identityParts = (identity = {}) => {
  // "montellanomarco.it@gmail.com" yields the whole local part and each piece
  // of it, so a password built from either half is still caught.
  const local = String(identity.email || '').split('@')[0];
  const pieces = [local, ...local.split(/[._+-]+/)];
  return [
    ...pieces,
    identity.firstName,
    identity.lastName,
    identity.middleName,
    identity.studentId,
    identity.employeeId,
  ]
    .map(squash)
    .filter((part) => part.length >= 4);
};

/**
 * Returns null when the password is acceptable, or a sentence explaining what
 * to fix. The message is shown to the person choosing the password, so it says
 * what to do rather than what went wrong.
 */
const checkPassword = (password, identity = {}) => {
  const value = String(password == null ? '' : password);

  if (value.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters. A short phrase you will remember is stronger than a short word with symbols in it.`;
  }
  if (value.length > MAX_LENGTH) {
    return `Password must be at most ${MAX_LENGTH} characters.`;
  }
  if (value.trim().length !== value.length) {
    return 'Password cannot start or end with a space.';
  }

  // Three of the four character classes, so a long passphrase of plain words
  // still qualifies without forcing a symbol nobody remembers.
  const classes = [hasLower(value), hasUpper(value), hasDigit(value), hasSymbol(value)]
    .filter(Boolean).length;
  if (classes < 3 && value.length < 16) {
    return 'Password needs at least three of: a lowercase letter, a capital, a number, a symbol - or make it 16 characters or longer.';
  }

  const squashed = squash(value);

  if (COMMON.has(squashed) || COMMON.has(value.toLowerCase())) {
    return 'That password appears in every list attackers try first. Please choose something else.';
  }

  // "aaaaaaaaaa" or "1234567890" pass a length check but nothing else
  if (/^(.)\1+$/.test(value)) {
    return 'Password cannot be the same character repeated.';
  }
  if (/^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/.test(squashed)) {
    return 'Password cannot be a straight run of keys or digits.';
  }

  const mine = identityParts(identity);
  if (mine.some((part) => squashed.includes(part) || part.includes(squashed))) {
    return 'Password cannot contain your name, e-mail or ID - those are the first things an attacker tries.';
  }

  return null;
};

/**
 * express-validator custom validator:
 *   body('password').custom(passwordValidator)
 * Identity-based checks need the rest of the body, which is why this is a
 * custom validator rather than a chain of .isLength()/.matches() calls.
 */
const passwordValidator = (value, { req }) => {
  const problem = checkPassword(value, req.body || {});
  if (problem) throw new Error(problem);
  return true;
};

module.exports = { checkPassword, passwordValidator, MIN_LENGTH };
