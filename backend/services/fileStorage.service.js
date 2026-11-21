/**
 * Where uploaded files live.
 *
 * Two drivers behind one interface:
 *
 *   local  writes under `uploads/` and returns a path the static handler
 *          serves, e.g. "/uploads/avatars/avatar-123.jpg"
 *   r2     puts the object in a Cloudflare R2 bucket and returns its public
 *          URL, e.g. "https://pub-xxxx.r2.dev/avatars/avatar-123.jpg"
 *
 * The driver is chosen from the environment. With no R2 credentials the
 * behaviour is exactly what it was before this file existed, so the system
 * keeps working on a developer machine with nothing configured.
 *
 * WHY THIS MATTERS HERE: the backend runs on a Pterodactyl container whose
 * filesystem does not survive a rebuild. Every avatar and every class material
 * written to local disk is one redeploy away from disappearing, while the
 * MongoDB record still points at it. R2 moves the bytes somewhere that
 * outlives the container.
 *
 * Callers never branch on the driver. They hand over a buffer and get back a
 * value to store; `remove()` takes that same value back.
 */

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const { UPLOAD_ROOT } = require('../middleware/upload.middleware');

/* ------------------------------------------------------------ config --- */

const R2 = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET_NAME,
  // The public base for reading objects back: an r2.dev domain or a custom one.
  publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''),
  // Only needed if you front R2 with something other than the standard host.
  endpoint: process.env.R2_ENDPOINT,
};

/**
 * R2 is usable only when every piece is present. A half-configured bucket is
 * worse than none: uploads would succeed and then be unreadable.
 */
const isCloudConfigured = () => Boolean(
  R2.accessKeyId && R2.secretAccessKey && R2.bucket && R2.publicUrl
  && (R2.accountId || R2.endpoint)
);

const driver = () => (isCloudConfigured() ? 'r2' : 'local');

/* --------------------------------------------------------- validation --- */

/**
 * What the bytes actually are, rather than what the upload claimed.
 *
 * A browser sets Content-Type from the file extension, so a renamed
 * executable arrives labelled `image/png`. These are the signatures of the
 * formats the avatar route accepts; anything else is refused.
 */
const sniffImage = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  const b = buffer;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: 'gif', mime: 'image/gif' };
  if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
};

/* ---------------------------------------------------------- key names --- */

/** A collision-proof object name that keeps a sensible extension. */
const buildKey = (folder, extension) => {
  const stamp = Date.now();
  const rand = crypto.randomBytes(8).toString('hex');
  const ext = String(extension || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const clean = String(folder || '').replace(/^\/+|\/+$/g, '');
  return `${clean ? `${clean}/` : ''}${clean ? clean.replace(/s$/, '') : 'file'}-${stamp}-${rand}.${ext}`;
};

/* ------------------------------------------------------------- client --- */

let client = null;
const s3 = () => {
  if (client) return client;
  // Required lazily so a deployment without R2 never loads the SDK.
  const { S3Client } = require('@aws-sdk/client-s3');
  client = new S3Client({
    // R2 ignores the region but the SDK insists on one.
    region: 'auto',
    endpoint: R2.endpoint || `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
  return client;
};

/* ---------------------------------------------------------------- API --- */

/**
 * Store a file and return where it ended up.
 *
 * @param {object}  opts
 * @param {Buffer}  opts.buffer       the file contents
 * @param {string}  opts.folder       logical folder, e.g. 'avatars'
 * @param {string}  [opts.contentType] used for the stored object; sniffed when omitted
 * @param {string}  [opts.extension]   file extension; sniffed when omitted
 * @param {boolean} [opts.imageOnly]   refuse anything that is not a real image
 * @returns {Promise<{url: string, key: string, driver: string, contentType: string}>}
 */
const save = async ({ buffer, folder, contentType, extension, imageOnly = false }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('There was nothing to upload.');
  }

  const sniffed = sniffImage(buffer);
  if (imageOnly && !sniffed) {
    throw new Error('That file is not an image. Please upload a JPEG, PNG, GIF or WebP.');
  }

  const type = sniffed?.mime || contentType || 'application/octet-stream';
  const ext = sniffed?.ext || extension || 'bin';
  const key = buildKey(folder, ext);

  if (driver() === 'r2') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3().send(new PutObjectCommand({
      Bucket: R2.bucket,
      Key: key,
      Body: buffer,
      // Without this the browser downloads the file instead of rendering it.
      ContentType: type,
      // Avatars change by filename, never in place, so they can be cached hard.
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return { url: `${R2.publicUrl}/${key}`, key, driver: 'r2', contentType: type };
  }

  const target = path.join(UPLOAD_ROOT, key);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, buffer);
  return { url: `/uploads/${key}`, key, driver: 'local', contentType: type };
};

/**
 * Delete a previously stored file, given whatever `save()` returned as `url`.
 *
 * Deleting is best-effort: a missing object must not stop a user from
 * replacing their photo, and an old local path may well be gone already.
 *
 * @returns {Promise<boolean>} whether something was actually removed
 */
const remove = async (storedUrl) => {
  if (!storedUrl) return false;

  try {
    // An absolute URL from R2.
    if (/^https?:\/\//i.test(storedUrl)) {
      if (!isCloudConfigured()) return false;
      if (R2.publicUrl && !storedUrl.startsWith(R2.publicUrl)) return false;
      const key = storedUrl.slice(R2.publicUrl.length + 1);
      if (!key) return false;
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await s3().send(new DeleteObjectCommand({ Bucket: R2.bucket, Key: key }));
      return true;
    }

    // A local path like "/uploads/avatars/avatar-1.jpg". Resolve it inside the
    // upload root and refuse anything that climbs out of it.
    const relative = String(storedUrl).replace(/^\/+/, '').replace(/^uploads\/?/, '');
    if (!relative) return false;
    const target = path.resolve(UPLOAD_ROOT, relative);
    if (!target.startsWith(path.resolve(UPLOAD_ROOT))) return false;
    if (!fs.existsSync(target)) return false;
    await fsp.unlink(target);
    return true;
  } catch (err) {
    console.warn('Could not remove stored file:', err.message);
    return false;
  }
};

/** What the server will do with the next upload, for diagnostics. */
const describe = () => ({
  driver: driver(),
  cloudConfigured: isCloudConfigured(),
  bucket: isCloudConfigured() ? R2.bucket : null,
  publicUrl: isCloudConfigured() ? R2.publicUrl : null,
  localRoot: driver() === 'local' ? UPLOAD_ROOT : null,
});

module.exports = {
  save,
  remove,
  describe,
  driver,
  isCloudConfigured,
  // exported for tests
  __test__: { sniffImage, buildKey },
};
