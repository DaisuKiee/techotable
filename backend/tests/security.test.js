/**
 * The security guarantees this app makes, as assertions.
 *
 * These exist because every one of them is a mistake that is easy to make
 * again: a handler that answers with a raw user document, a login that
 * forgets to stop for the second factor, a code that still works twice. If
 * one of these fails, something that used to be safe no longer is.
 *
 * Runs against an in-memory MongoDB, so it touches nothing real.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.TWOFA_GRACE_DAYS = '7';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { authenticator } = require('otplib');

const User = require('../models/User.model');
const TwoFactor = require('../models/TwoFactor.model');
const twoFactor = require('../services/twoFactor.service');
const { publicUser } = require('../utils/publicUser');
const { checkPassword } = require('../utils/passwordPolicy');
const { sanitizeRequest } = require('../middleware/security.middleware');
const { encrypt, decrypt } = require('../utils/secretBox');

jest.setTimeout(120000);

let mem;
const noReq = { headers: {} };

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'security-test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

const makeUser = (overrides = {}) => User.create({
  email: `u${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`,
  password: 'correct horse battery staple',
  role: 'student',
  firstName: 'Test',
  lastName: 'User',
  ...overrides,
});

describe('password policy', () => {
  it('refuses passwords that are merely six characters', () => {
    expect(checkPassword('abc123', {})).toBeTruthy();
  });

  it('refuses the passwords attackers try first', () => {
    expect(checkPassword('Password123', {})).toBeTruthy();
    expect(checkPassword('qwertyuiop', {})).toBeTruthy();
  });

  it('refuses a password built from the person\'s own name or email', () => {
    expect(checkPassword('Montellano2026', { lastName: 'Montellano' })).toBeTruthy();
    expect(checkPassword('montellanomarco1A', { email: 'montellanomarco.it@gmail.com' })).toBeTruthy();
  });

  it('accepts a long passphrase without demanding symbols', () => {
    expect(checkPassword('correct horse battery staple', {})).toBeNull();
  });

  it('accepts a shorter password that mixes character classes', () => {
    expect(checkPassword('Sched#2026Ctu', {})).toBeNull();
  });
});

describe('request sanitiser', () => {
  it('strips Mongo operators so a query cannot be rewritten by the caller', () => {
    const req = {
      body: { email: { $ne: null }, password: 'x', 'a.b': 1, nested: { $where: 'bad', ok: 2 } },
      query: {},
      params: {},
    };
    sanitizeRequest(req, {}, () => {});

    expect(req.body.email).toBeUndefined();     // {$ne:null} would match any user
    expect(req.body['a.b']).toBeUndefined();    // dotted keys reach nested paths
    expect(req.body.nested.$where).toBeUndefined();
    expect(req.body.nested.ok).toBe(2);         // legitimate data survives
    expect(req.body.password).toBe('x');
  });
});

describe('secrets at rest', () => {
  it('round trips and detects tampering', () => {
    const box = encrypt('JBSWY3DPEHPK3PXP');
    expect(decrypt(box)).toBe('JBSWY3DPEHPK3PXP');
    expect(decrypt(`${box.slice(0, -3)}zzz`)).toBe('');
  });

  it('never produces the same ciphertext twice', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });
});

describe('user serialisation', () => {
  it('never lets a credential or token leave the server', async () => {
    const user = await makeUser({
      passwordResetToken: 'HASHED-RESET',
      emailVerificationToken: 'HASHED-VERIFY',
      failedLoginAttempts: 3,
    });
    const full = await User.findById(user._id).select('+password');
    const json = JSON.stringify(publicUser(full, { self: true }));

    ['HASHED-RESET', 'HASHED-VERIFY', '$2a$', '$2b$',
      'passwordResetToken', 'emailVerificationToken', 'password'].forEach((secret) => {
      expect(json).not.toContain(secret);
    });
    expect(JSON.parse(json).email).toBe(full.email);
  });

  it('hides lockout bookkeeping from anyone but the account owner', async () => {
    const user = await makeUser({ failedLoginAttempts: 3 });
    expect(JSON.stringify(publicUser(user))).not.toContain('failedLoginAttempts');
  });
});

describe('two-factor enrolment policy', () => {
  it('requires a second factor but grants a grace period first', async () => {
    const user = await makeUser();
    const status = await twoFactor.enrolmentStatus(user);

    expect(status.required).toBe(true);
    expect(status.enrolled).toBe(false);
    expect(status.mustEnrolNow).toBe(false);
    expect(status.graceDaysLeft).toBe(7);
  });
});

describe('authenticator app', () => {
  let user;
  let setup;

  beforeAll(async () => {
    user = await makeUser();
    setup = await twoFactor.beginTotpSetup(user);
  });

  it('hands back a scannable QR code', () => {
    expect(setup.qr).toMatch(/^data:image\/png;base64,/);
    expect(setup.otpauth).toContain('otpauth://totp/');
  });

  it('encrypts the seed at rest', async () => {
    const record = await TwoFactor.findOne({ user: user._id });
    expect(record.totpSecret).toMatch(/^v1\./);
    expect(record.totpSecret).not.toContain(setup.secret);
  });

  it('does not count as enrolled until a real code proves the app works', async () => {
    const record = await TwoFactor.findOne({ user: user._id });
    expect(record.totpEnabledAt).toBeNull();
    expect((await twoFactor.enableTotp(user, '000000')).ok).toBe(false);
  });

  it('enables on a correct code and flips the flag the login path reads', async () => {
    const result = await twoFactor.enableTotp(user, authenticator.generate(setup.secret));
    expect(result.ok).toBe(true);
    expect((await User.findById(user._id)).twoFactorEnabled).toBe(true);
  });

  it('refuses to accept the same code twice', async () => {
    const fresh = await User.findById(user._id);
    const code = authenticator.generate(setup.secret);
    // The enable step above already consumed this time step
    const replay = await twoFactor.verifySecondFactor(fresh, { method: 'totp', code }, noReq);
    expect(replay.ok).toBe(false);
  });
});

describe('recovery codes', () => {
  let user;
  let codes;

  beforeAll(async () => {
    user = await makeUser();
    codes = await twoFactor.regenerateRecoveryCodes(user._id);
    user = await User.findById(user._id);
  });

  it('issues ten readable codes', () => {
    expect(codes).toHaveLength(10);
    codes.forEach((c) => expect(c).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/));
  });

  it('stores only their hashes', async () => {
    const record = await TwoFactor.findOne({ user: user._id });
    expect(JSON.stringify(record.recoveryCodes)).not.toContain(codes[0]);
  });

  it('spends each code exactly once', async () => {
    expect((await twoFactor.verifySecondFactor(user, { method: 'recovery', code: codes[0] }, noReq)).ok).toBe(true);
    expect((await twoFactor.verifySecondFactor(user, { method: 'recovery', code: codes[0] }, noReq)).ok).toBe(false);
    expect((await TwoFactor.findOne({ user: user._id })).unusedRecoveryCount()).toBe(9);
  });

  it('accepts a code however the person types it', async () => {
    const typed = codes[1].toUpperCase().replace(/-/g, ' ');
    expect((await twoFactor.verifySecondFactor(user, { method: 'recovery', code: typed }, noReq)).ok).toBe(true);
  });
});

describe('emailed codes', () => {
  let user;
  let code;

  beforeAll(async () => {
    user = await makeUser();
    const record = await twoFactor.recordFor(user._id, { create: true });
    record.emailEnabled = true;
    await record.save();

    // Console mode prints the code rather than sending it (NODE_ENV=test)
    const log = console.log;
    console.log = (...args) => {
      const match = String(args[0] || '').match(/2FA CODE for \S+: (\d{6})/);
      if (match) [, code] = match;
    };
    await twoFactor.sendEmailCode(user, noReq);
    console.log = log;
  });

  it('sends a six-digit code', () => {
    expect(code).toMatch(/^\d{6}$/);
  });

  it('rejects the wrong code and accepts the right one exactly once', async () => {
    const wrong = code === '000000' ? '111111' : '000000';
    expect((await twoFactor.verifyEmailCode(user._id, wrong)).ok).toBe(false);
    expect((await twoFactor.verifyEmailCode(user._id, code)).ok).toBe(true);
    expect((await twoFactor.verifyEmailCode(user._id, code)).ok).toBe(false);
  });
});

describe('what the Settings page is told', () => {
  it('describes the enrolled methods without exposing any of them', async () => {
    const user = await makeUser();
    const setup = await twoFactor.beginTotpSetup(user);
    await twoFactor.enableTotp(user, authenticator.generate(setup.secret));

    const described = await twoFactor.describe(await User.findById(user._id));
    expect(described.enrolled).toBe(true);
    expect(described.methods.totp).toBe(true);
    expect(JSON.stringify(described)).not.toContain(setup.secret);
  });
});

describe('query building', () => {
  const { searchClause, clampLimit, clampSkip, escapeRegex } = require('../utils/safeQuery');

  it('turns a search term into a literal, so the caller cannot run their own regex', () => {
    const clause = searchClause('.*', ['name']);
    expect(clause.$or[0].name.$regex).toBe('\\.\\*');
  });

  it('defuses the classic catastrophic-backtracking payload', () => {
    // (a+)+$ against a long non-matching string is exponential; escaped it is
    // just a string of punctuation that matches nothing in linear time.
    const escaped = escapeRegex('(a+)+$');
    const started = Date.now();
    new RegExp(escaped).test(`${'a'.repeat(5000)}b`);
    expect(Date.now() - started).toBeLessThan(500);
    expect(escaped).toBe('\\(a\\+\\)\\+\\$');
  });

  it('caps the length of a search term', () => {
    const clause = searchClause('x'.repeat(5000), ['name']);
    expect(clause.$or[0].name.$regex.length).toBeLessThanOrEqual(80);
  });

  it('ignores an empty search instead of matching everything', () => {
    expect(searchClause('   ', ['name'])).toBeNull();
  });

  it('keeps page sizes inside what the server can serve', () => {
    expect(clampLimit('999999')).toBe(200);
    expect(clampLimit('-5')).toBe(50);
    expect(clampLimit('25')).toBe(25);
    expect(clampSkip('-10')).toBe(0);
  });
});

describe('prototype pollution', () => {
  const { sanitizeRequest } = require('../middleware/security.middleware');

  it('drops keys that reach the prototype rather than the object', () => {
    const req = {
      body: JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"x":1},"nested":{"__proto__":{"y":1},"keep":2},"ok":1}'),
      query: {},
      params: {},
    };
    sanitizeRequest(req, {}, () => {});

    expect(req.body.nested.keep).toBe(2);   // real data survives
    expect(req.body.ok).toBe(1);
    expect(Object.keys(req.body)).toEqual(['nested', 'ok']);
    expect(Object.keys(req.body.nested)).toEqual(['keep']);
    expect({}.isAdmin).toBeUndefined();
  });
});

describe('brute-force guard', () => {
  const guard = require('../middleware/loginGuard');

  const req = (ip) => ({ ip });
  const runGuard = (ip) => {
    let blocked = null;
    const res = { status: (s) => ({ json: (body) => { blocked = { s, body }; } }) };
    guard.blockSuspectedBruteForce(req(ip), res, () => { blocked = false; });
    return blocked;
  };

  beforeEach(() => guard.reset());

  it('lets an ordinary wrong password through', () => {
    guard.recordFailure(req('1.1.1.1'), 'someone@example.com');
    expect(runGuard('1.1.1.1')).toBe(false);
  });

  it('blocks a stuffing list: many addresses that have no account here', () => {
    // One try each, so no single account ever reaches the 5-strike lockout -
    // which is exactly the attack the per-account lock cannot see
    for (let i = 0; i < guard.MAX_UNKNOWN_ACCOUNTS; i += 1) {
      guard.recordFailure(req('2.2.2.2'), `leaked${i}@elsewhere.com`, { known: false });
    }
    const blocked = runGuard('2.2.2.2');
    expect(blocked).not.toBe(false);
    expect(blocked.s).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('does NOT block a normal campus morning behind one NAT address', () => {
    /**
     * The whole university shares one public IP. Thirty students each
     * mistyping their own real password once is an ordinary Monday, and
     * blocking it would take the system down daily - a far likelier outcome
     * than the attack it is meant to stop.
     */
    for (let i = 0; i < 30; i += 1) {
      guard.recordFailure(req('6.6.6.6'), `student${i}@ctu.edu.ph`, { known: true });
    }
    expect(runGuard('6.6.6.6')).toBe(false);
  });

  it('still blocks an address grinding through very many real accounts', () => {
    for (let i = 0; i < guard.MAX_DISTINCT_ACCOUNTS; i += 1) {
      guard.recordFailure(req('7.7.7.7'), `victim${i}@example.com`, { known: true });
    }
    expect(runGuard('7.7.7.7')).not.toBe(false);
  });

  it('blocks a flood of failures against one account', () => {
    for (let i = 0; i < guard.MAX_FAILURES; i += 1) {
      guard.recordFailure(req('3.3.3.3'), 'target@example.com');
    }
    expect(runGuard('3.3.3.3')).not.toBe(false);
  });

  it('does not punish other networks', () => {
    for (let i = 0; i < guard.MAX_FAILURES; i += 1) {
      guard.recordFailure(req('3.3.3.3'), 'target@example.com');
    }
    expect(runGuard('4.4.4.4')).toBe(false);
  });

  it('forgives an address as soon as someone signs in from it', () => {
    for (let i = 0; i < guard.MAX_UNKNOWN_ACCOUNTS; i += 1) {
      guard.recordFailure(req('5.5.5.5'), `v${i}@example.com`, { known: false });
    }
    expect(runGuard('5.5.5.5')).not.toBe(false);
    guard.recordSuccess(req('5.5.5.5'));
    expect(runGuard('5.5.5.5')).toBe(false);
  });
});

describe('two-factor deadline reminders', () => {
  const Notification = require('../models/Notification.model');
  const { stageFor, daysLeftFor, sendReminders } = require('../services/twoFactorReminder.service');
  const DAY = 24 * 60 * 60 * 1000;
  const daysAgo = (n) => new Date(Date.now() - n * DAY);

  it('warns at the right points in the grace period', () => {
    expect(stageFor(daysAgo(0), 7)).toBe(1);   // first notice
    expect(stageFor(daysAgo(4), 7)).toBe(2);   // three days left
    expect(stageFor(daysAgo(6), 7)).toBe(3);   // last day
    expect(stageFor(daysAgo(8), 7)).toBe(4);   // overdue
    expect(daysLeftFor(daysAgo(4), 7)).toBe(3);
  });

  it('tells the person, rather than leaving the deadline in a settings page', async () => {
    const user = await makeUser({ twoFactorRequiredSince: daysAgo(4) });

    await sendReminders();

    const notices = await Notification.find({ recipient: user._id });
    expect(notices).toHaveLength(1);
    expect(notices[0].title).toMatch(/three days left/i);
    expect(notices[0].link).toBe('/settings?tab=twofactor');
  });

  it('never sends the same warning twice', async () => {
    const user = await makeUser({ twoFactorRequiredSince: daysAgo(4) });

    await sendReminders();
    await sendReminders();
    await sendReminders();

    expect(await Notification.countDocuments({ recipient: user._id })).toBe(1);
  });

  it('escalates as the deadline gets closer', async () => {
    const user = await makeUser({ twoFactorRequiredSince: daysAgo(4) });
    await sendReminders();

    // The clock moves on: now it is the last day
    await User.updateOne({ _id: user._id }, { twoFactorRequiredSince: daysAgo(6) });
    await sendReminders();

    const titles = (await Notification.find({ recipient: user._id }).sort({ createdAt: 1 }))
      .map((n) => n.title);
    expect(titles).toHaveLength(2);
    expect(titles[1]).toMatch(/last day/i);
  });

  it('says nothing to someone who has already enrolled', async () => {
    const user = await makeUser({ twoFactorRequiredSince: daysAgo(6), twoFactorEnabled: true });
    await sendReminders();
    expect(await Notification.countDocuments({ recipient: user._id })).toBe(0);
  });
});
