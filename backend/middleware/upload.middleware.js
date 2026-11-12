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

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    // Keep the extension, randomise the stem so originals can't collide or
    // be guessed from the uploaded name.
    const ext = path.extname(file.originalname).toLowerCase();
    const stem = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${stem}${ext}`);
  },
});

const DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|csv|zip|rar|png|jpe?g|gif|webp)$/i;

const documentFilter = (req, file, cb) => {
  if (!DOCUMENT_EXTENSIONS.test(file.originalname)) {
    return cb(
      new Error(
        'Unsupported file type. Allowed: pdf, doc(x), ppt(x), xls(x), txt, csv, zip, rar, and images.'
      )
    );
  }
  cb(null, true);
};

/** Class materials: documents and images, written to disk. */
const uploadMaterial = multer({
  storage: diskStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
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
  uploadMaterial,
};
