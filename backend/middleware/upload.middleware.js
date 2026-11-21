const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Shared upload middleware.
 *
 * NOTE ON PRODUCTION: files are written to local disk. That is fine for local
 * development, but on a serverless host (this project deploys the frontend to
 * Vercel) the filesystem is ephemeral and per-instance, so uploaded class
 * materials will disappear. Moving to object storage (S3 / Cloudinary) is the
 * fix; everything else here is storage-agnostic because only `fileUrl` is
 * persisted on the ClassSpace material.
 */

// Resolve to an absolute path so behaviour doesn't depend on the process CWD.
// The old inline configs used './uploads', which only matched the static
// handler when the server happened to be started from backend/.
const UPLOAD_ROOT = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, '..', 'uploads');

// Create the directory up front; multer errors out if the destination is missing.
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024; // 10 MB

// Class materials can include video, which does not fit a 10 MB cap, so they
// get their own larger limit. Held in memory (see below), so the ceiling also
// bounds how much RAM one upload uses - raise it on a host with room to spare.
const MATERIAL_MAX_FILE_SIZE = parseInt(process.env.MATERIAL_MAX_FILE_SIZE, 10) || 100 * 1024 * 1024; // 100 MB

const DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|csv|zip|rar|png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|avi|mkv|ogv|mp3|wav|m4a|ogg)$/i;

const documentFilter = (req, file, cb) => {
  if (!DOCUMENT_EXTENSIONS.test(file.originalname)) {
    return cb(
      new Error(
        'Unsupported file type. Allowed: pdf, doc(x), ppt(x), xls(x), txt, csv, zip, rar, images, audio and video.'
      )
    );
  }
  cb(null, true);
};

/**
 * Class materials: documents, images, audio and video.
 *
 * Kept in memory and handed to services/fileStorage, which writes to
 * Cloudflare R2 when configured and to local disk otherwise - the same path
 * avatars take. Writing straight to disk here tied materials to one backend,
 * and on the Pterodactyl host that disk does not survive a rebuild, so every
 * uploaded handout was one redeploy from vanishing while the ClassSpace record
 * still pointed at it.
 *
 * The trade-off of memory storage: the whole file sits in RAM until it is
 * stored, so `MATERIAL_MAX_FILE_SIZE` doubles as a RAM guard. For large videos
 * on a small container, streaming straight to R2 would be the next step.
 */
const uploadMaterial = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MATERIAL_MAX_FILE_SIZE,
    // One file per request, and a cap on the non-file fields that come with
    // it. Without these a single request can open thousands of parts and
    // keep the parser busy long after the size limit would have stopped a
    // large upload.
    files: 1,
    fields: 20,
    parts: 25,
  },
  fileFilter: documentFilter,
});

module.exports = {
  UPLOAD_ROOT,
  MAX_FILE_SIZE,
  MATERIAL_MAX_FILE_SIZE,
  uploadMaterial,
  // Exposed for unit testing (Appendix G).
  DOCUMENT_EXTENSIONS,
  documentFilter,
};
