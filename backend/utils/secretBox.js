const crypto = require('crypto');

/**
 * Authenticated encryption for the few secrets that must be stored
 * recoverably - today that is the TOTP seed, which the server has to read
 * back to check a six-digit code.
 *
 * Everything else that can be hashed is hashed (passwords, reset tokens,
 * recovery codes): hashing is strictly safer and those never need reading
 * back. This exists only for the cases where that is not an option.
 *
 * AES-256-GCM, random 12-byte nonce, stored as v1.<iv>.<tag>.<ciphertext> in
 * base64url. The version prefix means the format can change later without
 * guessing at what old rows contain.
 */

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

let cachedKey = null;

/**
 * The key comes from ENCRYPTION_KEY when it is set. Without it, one is
 * derived from JWT_SECRET so the feature works on an existing deployment
 * that has not added a new variable yet - with a warning, because rotating
 * JWT_SECRET would then make every stored TOTP seed unreadable.
 */
const key = () => {
  if (cachedKey) return cachedKey;

  const configured = process.env.ENCRYPTION_KEY;
  if (configured) {
    // Accept either 64 hex characters or any long passphrase
    cachedKey = /^[0-9a-f]{64}$/i.test(configured)
      ? Buffer.from(configured, 'hex')
      : crypto.createHash('sha256').update(configured).digest();
    return cachedKey;
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('Cannot encrypt secrets: set ENCRYPTION_KEY in the environment.');
  }
  if (!key.warned) {
    console.warn(
      '  ! ENCRYPTION_KEY is not set; deriving the two-factor encryption key from JWT_SECRET.\n'
      + '    Set ENCRYPTION_KEY (64 hex characters) so rotating JWT_SECRET does not lock\n'
      + '    everyone out of their authenticator app.'
    );
    key.warned = true;
  }
  cachedKey = crypto.hkdfSync('sha256', Buffer.from(process.env.JWT_SECRET), Buffer.alloc(0),
    Buffer.from('timetable:secretbox:v1'), 32);
  return (cachedKey = Buffer.from(cachedKey));
};

const encrypt = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.');
};

/** Returns '' for anything unreadable rather than throwing mid-request. */
const decrypt = (payload) => {
  if (!payload) return '';
  try {
    const [version, iv, tag, body] = String(payload).split('.');
    if (version !== VERSION || !iv || !tag || !body) return '';
    const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch (_) {
    return '';
  }
};

/** Constant-time compare for anything secret, so timing cannot leak a prefix. */
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a == null ? '' : a));
  const right = Buffer.from(String(b == null ? '' : b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

/** SHA-256 hex, for values that only ever need comparing. */
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

module.exports = { encrypt, decrypt, safeEqual, digest };
