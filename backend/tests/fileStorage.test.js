/**
 * Where uploaded files go, and what gets stored in Mongo as a result.
 *
 * Two things are worth guarding here:
 *
 *   1. With no R2 credentials the behaviour must be exactly what it was
 *      before object storage existed, so a developer machine and a server
 *      without the secrets keep working.
 *   2. The value handed back is what ends up in the database and, later, in
 *      an <img src>. A local path and an R2 URL are different shapes, and
 *      `remove()` has to understand both - including refusing to delete
 *      anything outside the upload directory.
 *
 * The R2 driver is exercised with the AWS SDK stubbed. That proves the
 * commands, the key, the content type and the returned URL are right; it does
 * NOT prove anything about a real bucket, which cannot be tested without
 * credentials.
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const os = require('os');

// A scratch upload root, so the test never writes into the project.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ctu-uploads-'));
process.env.UPLOAD_PATH = TMP_ROOT;

/** Smallest valid file headers, so the signature sniffer has something real. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(32, 7)]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4, 1), Buffer.from('WEBP', 'ascii'), Buffer.alloc(32, 7)]);
const NOT_AN_IMAGE = Buffer.from('MZ\u0090\u0000\u0003 this is an executable, not a picture', 'binary');

/** Re-read the module with a given environment. */
const loadWith = (env) => {
  jest.resetModules();
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const mod = require('../services/fileStorage.service');
  return { mod, restore: () => { process.env = saved; } };
};

const R2_ENV = {
  CLOUDFLARE_ACCOUNT_ID: 'acct123',
  R2_ACCESS_KEY_ID: 'key123',
  R2_SECRET_ACCESS_KEY: 'secret123',
  R2_BUCKET_NAME: 'ctu-uploads',
  R2_PUBLIC_URL: 'https://pub-example.r2.dev',
};

const CLEAR_R2 = {
  CLOUDFLARE_ACCOUNT_ID: '', R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '',
  R2_BUCKET_NAME: '', R2_PUBLIC_URL: '', R2_ENDPOINT: '',
};

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

/* ------------------------------------------------------------- local --- */

describe('with no object storage configured', () => {
  let storage;
  let restore;

  beforeAll(() => {
    ({ mod: storage, restore } = loadWith(CLEAR_R2));
  });
  afterAll(() => restore());

  test('it uses local disk, as it always did', () => {
    expect(storage.driver()).toBe('local');
    expect(storage.isCloudConfigured()).toBe(false);
  });

  test('a saved image lands under uploads and is served from /uploads', async () => {
    const out = await storage.save({ buffer: JPEG, folder: 'avatars', imageOnly: true });

    expect(out.driver).toBe('local');
    expect(out.url).toMatch(/^\/uploads\/avatars\/avatar-\d+-[a-f0-9]+\.jpg$/);
    expect(out.contentType).toBe('image/jpeg');

    const onDisk = path.join(TMP_ROOT, out.key);
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.readFileSync(onDisk)).toEqual(JPEG);
  });

  test('two uploads of the same photo never collide', async () => {
    const a = await storage.save({ buffer: PNG, folder: 'avatars', imageOnly: true });
    const b = await storage.save({ buffer: PNG, folder: 'avatars', imageOnly: true });
    expect(a.key).not.toBe(b.key);
  });

  test('removing a stored file deletes it, and removing it twice is harmless', async () => {
    const out = await storage.save({ buffer: GIF, folder: 'avatars', imageOnly: true });
    const target = path.join(TMP_ROOT, out.key);
    expect(fs.existsSync(target)).toBe(true);

    expect(await storage.remove(out.url)).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
    expect(await storage.remove(out.url)).toBe(false);
  });

  test('it will not delete anything outside the upload directory', async () => {
    const outsider = path.join(TMP_ROOT, '..', 'do-not-delete.txt');
    fs.writeFileSync(outsider, 'keep me');
    try {
      expect(await storage.remove('/uploads/../do-not-delete.txt')).toBe(false);
      expect(await storage.remove('../../do-not-delete.txt')).toBe(false);
      expect(fs.existsSync(outsider)).toBe(true);
    } finally {
      fs.rmSync(outsider, { force: true });
    }
  });
});

/* -------------------------------------------------------- validation --- */

describe('what counts as an image', () => {
  let storage;
  let restore;

  beforeAll(() => { ({ mod: storage, restore } = loadWith(CLEAR_R2)); });
  afterAll(() => restore());

  test.each([
    ['JPEG', JPEG, 'image/jpeg', 'jpg'],
    ['PNG', PNG, 'image/png', 'png'],
    ['GIF', GIF, 'image/gif', 'gif'],
    ['WebP', WEBP, 'image/webp', 'webp'],
  ])('a real %s is accepted and typed from its own bytes', async (_name, buf, mime, ext) => {
    const out = await storage.save({ buffer: buf, folder: 'avatars', imageOnly: true });
    expect(out.contentType).toBe(mime);
    expect(out.url.endsWith(`.${ext}`)).toBe(true);
  });

  test('a file that merely claims to be an image is refused', async () => {
    await expect(storage.save({
      buffer: NOT_AN_IMAGE,
      folder: 'avatars',
      // Exactly what a browser would send for a file renamed to .png.
      contentType: 'image/png',
      extension: 'png',
      imageOnly: true,
    })).rejects.toThrow(/not an image/i);
  });

  test('a class material (not an image) is stored under its own folder, typed from the upload', async () => {
    // Materials go through the same storage layer with imageOnly=false, so a
    // PDF or a video is stored as-is rather than being refused for not being
    // an image.
    const pdf = await storage.save({
      buffer: Buffer.from('%PDF-1.4 a handout'),
      folder: 'materials',
      contentType: 'application/pdf',
      extension: 'pdf',
    });
    expect(pdf.url).toMatch(/^\/uploads\/materials\/material-\d+-[a-f0-9]+\.pdf$/);
    expect(pdf.contentType).toBe('application/pdf');

    const video = await storage.save({
      buffer: Buffer.from('fake-mp4-bytes-for-the-test'),
      folder: 'materials',
      contentType: 'video/mp4',
      extension: 'mp4',
    });
    expect(video.url).toMatch(/\/materials\/material-\d+-[a-f0-9]+\.mp4$/);
    expect(video.contentType).toBe('video/mp4');
    // And it really lands on disk when R2 is not configured.
    expect(fs.existsSync(path.join(TMP_ROOT, video.key))).toBe(true);
  });

  test('an empty upload is refused', async () => {
    await expect(storage.save({ buffer: Buffer.alloc(0), folder: 'avatars' }))
      .rejects.toThrow(/nothing to upload/i);
  });
});

/* ---------------------------------------------------------------- R2 --- */

describe('with Cloudflare R2 configured', () => {
  const sent = [];
  // The S3 client is built once and cached, so its config has to be recorded
  // somewhere `beforeEach` does not clear.
  const clientConfigs = [];
  let storage;
  let restore;

  beforeAll(() => {
    jest.resetModules();
    // Stub the SDK: this proves which commands are issued and with what,
    // without needing a bucket or credentials that work.
    jest.doMock('@aws-sdk/client-s3', () => ({
      S3Client: class {
        constructor(config) { clientConfigs.push(config); }
        async send(command) { sent.push({ kind: command.__kind, input: command.input }); return {}; }
      },
      PutObjectCommand: class { constructor(input) { this.__kind = 'put'; this.input = input; } },
      DeleteObjectCommand: class { constructor(input) { this.__kind = 'delete'; this.input = input; } },
    }), { virtual: false });

    const saved = { ...process.env };
    Object.assign(process.env, R2_ENV);
    storage = require('../services/fileStorage.service');
    restore = () => { process.env = saved; jest.dontMock('@aws-sdk/client-s3'); };
  });
  afterAll(() => restore());
  beforeEach(() => { sent.length = 0; });

  test('the driver switches to R2 once every setting is present', () => {
    expect(storage.driver()).toBe('r2');
    expect(storage.describe()).toMatchObject({ driver: 'r2', bucket: 'ctu-uploads' });
  });

  test('an upload becomes a PutObject with the right bucket, key and type', async () => {
    const out = await storage.save({ buffer: JPEG, folder: 'avatars', imageOnly: true });

    const put = sent.find((s) => s.kind === 'put');
    expect(put).toBeDefined();
    expect(put.input.Bucket).toBe('ctu-uploads');
    expect(put.input.Key).toMatch(/^avatars\/avatar-\d+-[a-f0-9]+\.jpg$/);
    expect(put.input.Body).toEqual(JPEG);
    // Without this the browser downloads the file instead of showing it.
    expect(put.input.ContentType).toBe('image/jpeg');

    // And nothing was written to disk.
    expect(fs.existsSync(path.join(TMP_ROOT, out.key))).toBe(false);
  });

  test('what gets stored is a public URL the browser can load directly', async () => {
    const out = await storage.save({ buffer: PNG, folder: 'avatars', imageOnly: true });
    expect(out.driver).toBe('r2');
    expect(out.url).toBe(`https://pub-example.r2.dev/${out.key}`);
  });

  test('the client points at the account’s R2 endpoint, with a region the SDK accepts', async () => {
    await storage.save({ buffer: JPEG, folder: 'avatars', imageOnly: true });
    expect(clientConfigs.length).toBeGreaterThan(0);
    const config = clientConfigs[0];
    expect(config.endpoint).toBe('https://acct123.r2.cloudflarestorage.com');
    // R2 has no regions, but the SDK refuses to start without one.
    expect(config.region).toBe('auto');
  });

  test('removing an R2 URL issues a DeleteObject for just the key', async () => {
    const removed = await storage.remove('https://pub-example.r2.dev/avatars/avatar-1-abc.jpg');
    expect(removed).toBe(true);
    const del = sent.find((s) => s.kind === 'delete');
    expect(del.input).toMatchObject({ Bucket: 'ctu-uploads', Key: 'avatars/avatar-1-abc.jpg' });
  });

  test('it ignores a URL belonging to somewhere else entirely', async () => {
    expect(await storage.remove('https://example.com/someone/elses/file.jpg')).toBe(false);
    expect(sent.some((s) => s.kind === 'delete')).toBe(false);
  });

  test('an old local path still deletes locally after the switch to R2', async () => {
    // Avatars uploaded before the migration are still "/uploads/..." in Mongo.
    const legacy = path.join(TMP_ROOT, 'avatars', 'legacy.jpg');
    fs.mkdirSync(path.dirname(legacy), { recursive: true });
    fs.writeFileSync(legacy, JPEG);

    expect(await storage.remove('/uploads/avatars/legacy.jpg')).toBe(true);
    expect(fs.existsSync(legacy)).toBe(false);
    expect(sent.some((s) => s.kind === 'delete')).toBe(false);
  });
});

/* ------------------------------------------------- partial configuration */

describe('a half-configured bucket', () => {
  test('is treated as not configured, rather than uploading somewhere unreadable', () => {
    // Everything except the public URL: objects would upload and then be
    // impossible to display.
    const { mod, restore } = loadWith({ ...R2_ENV, R2_PUBLIC_URL: '' });
    try {
      expect(mod.isCloudConfigured()).toBe(false);
      expect(mod.driver()).toBe('local');
    } finally {
      restore();
    }
  });

  test('missing credentials also fall back to local', () => {
    const { mod, restore } = loadWith({ ...R2_ENV, R2_SECRET_ACCESS_KEY: '' });
    try {
      expect(mod.driver()).toBe('local');
    } finally {
      restore();
    }
  });
});
