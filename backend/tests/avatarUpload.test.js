/**
 * The avatar route, end to end, through the new storage layer.
 *
 * This is the path a profile photo actually takes: multipart upload, the real
 * multer config, the real controller, the real `fileStorage` service, and the
 * value that ends up on the User document and therefore in an <img src>.
 *
 * It runs against an in-memory MongoDB and a scratch upload directory, so the
 * live database and the project's `uploads/` folder are never touched.
 *
 * Not covered: a real Cloudflare R2 bucket. There are no credentials in this
 * environment, so the R2 driver is proved with a stubbed SDK in
 * tests/fileStorage.test.js and the route is exercised here on local disk.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-0123456789';

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ctu-avatar-'));
process.env.UPLOAD_PATH = TMP_ROOT;
// Make sure the local driver is the one under test here.
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_PUBLIC_URL;

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User.model');
// `protect` populates `facultyProfile`, so the Faculty schema has to be
// registered or Mongoose throws and every request comes back as a 401.
require('../models/Faculty.model');

jest.setTimeout(120000);

/** A real 1x1 PNG, so the signature check has something genuine to read. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const NOT_AN_IMAGE = Buffer.from('MZ\u0090\u0000\u0003 definitely not a picture', 'binary');

let mem;
let app;
let user;
let token;

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'avatar_upload' });

  user = await User.create({
    email: 'photo.owner@ctu.edu.ph',
    password: 'Str0ng-Passphrase-123!',
    role: 'faculty',
    firstName: 'Photo',
    lastName: 'Owner',
    isActive: true,
    isEmailVerified: true,
  });
  token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

  app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/user.routes'));
  app.use(require('../middleware/error.middleware').errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const auth = () => ({ Authorization: `Bearer ${token}` });

const upload = (buffer, filename, contentType) => request(app)
  .post(`/api/users/${user._id}/avatar`)
  .set(auth())
  .attach('avatar', buffer, { filename, contentType });

describe('uploading a profile photo', () => {
  test('it is stored, and the saved value points at a file that exists', async () => {
    const res = await upload(PNG_1PX, 'me.png', 'image/png');

    expect(res.status).toBe(200);
    const stored = res.body.data.profilePicture;
    expect(stored).toMatch(/^\/uploads\/avatars\/avatar-\d+-[a-f0-9]+\.png$/);

    // The value in Mongo and the file on disk agree.
    const fresh = await User.findById(user._id).lean();
    expect(fresh.profilePicture).toBe(stored);
    expect(fs.existsSync(path.join(TMP_ROOT, stored.replace(/^\/uploads\//, '')))).toBe(true);
  });

  test('replacing it removes the file the old one pointed at', async () => {
    const first = (await upload(PNG_1PX, 'one.png', 'image/png')).body.data.profilePicture;
    const firstPath = path.join(TMP_ROOT, first.replace(/^\/uploads\//, ''));
    expect(fs.existsSync(firstPath)).toBe(true);

    const second = (await upload(PNG_1PX, 'two.png', 'image/png')).body.data.profilePicture;
    expect(second).not.toBe(first);

    // The replacement is kept; the superseded one is cleaned up rather than
    // left behind for ever. Deletion is fire-and-forget, so allow a moment.
    await new Promise((r) => setTimeout(r, 300));
    expect(fs.existsSync(path.join(TMP_ROOT, second.replace(/^\/uploads\//, '')))).toBe(true);
    expect(fs.existsSync(firstPath)).toBe(false);
  });

  test('a file that only claims to be an image is refused', async () => {
    const before = (await User.findById(user._id).lean()).profilePicture;

    const res = await upload(NOT_AN_IMAGE, 'trojan.png', 'image/png');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not an image/i);

    // And the photo they already had is untouched.
    const after = (await User.findById(user._id).lean()).profilePicture;
    expect(after).toBe(before);
  });

  test('a document is refused by the upload filter', async () => {
    const res = await upload(Buffer.from('%PDF-1.4 hello'), 'notes.pdf', 'application/pdf');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('someone else cannot replace your photo', async () => {
    const other = await User.create({
      email: 'someone.else@ctu.edu.ph',
      password: 'Str0ng-Passphrase-123!',
      role: 'faculty',
      firstName: 'Some',
      lastName: 'Else',
      isActive: true,
      isEmailVerified: true,
    });
    const otherToken = jwt.sign({ id: String(other._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .post(`/api/users/${user._id}/avatar`)
      .set({ Authorization: `Bearer ${otherToken}` })
      .attach('avatar', PNG_1PX, { filename: 'theirs.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  test('removing the photo clears the record and deletes the file', async () => {
    const stored = (await upload(PNG_1PX, 'bye.png', 'image/png')).body.data.profilePicture;
    const onDisk = path.join(TMP_ROOT, stored.replace(/^\/uploads\//, ''));
    expect(fs.existsSync(onDisk)).toBe(true);

    const res = await request(app).delete(`/api/users/${user._id}/avatar`).set(auth());
    expect(res.status).toBe(200);

    const fresh = await User.findById(user._id).lean();
    expect(fresh.profilePicture).toBeFalsy();
    expect(fs.existsSync(onDisk)).toBe(false);
  });
});
