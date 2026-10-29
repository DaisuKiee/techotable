const crypto = require('crypto');

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * An error whose message is safe to show to the user.
 * throw new AppError('Room is already booked at that time', 409)
 */
class AppError extends Error {
  constructor(message, status = 400, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (details) this.details = details;
  }
}

const humanize = (path) => String(path || '')
  .split('.').pop()
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^\w/, (c) => c.toUpperCase());

/**
 * Turn any thrown value into { status, message, errors?, code }.
 * Known database / auth / request errors become 4xx with a message the user
 * can act on, instead of a generic 500.
 */
const classify = (err) => {
  if (!err) return { status: 500, code: 'UNKNOWN', message: 'Something went wrong.' };

  // body-parser failures (these carry expose: true, so check them first)
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'BAD_JSON', message: 'The request body is not valid JSON.' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, code: 'TOO_LARGE', message: 'The request is too large.' };
  }

  if (err.name === 'AppError' || err.expose === true) {
    return { status: err.status || 400, code: err.code || 'REQUEST_ERROR', message: err.message, errors: err.details };
  }

  // Mongoose schema validation: report every bad field
  if (err.name === 'ValidationError' && err.errors) {
    const errors = {};
    for (const [path, e] of Object.entries(err.errors)) {
      errors[path] = e.kind === 'required'
        ? `${humanize(path)} is required.`
        : e.name === 'CastError'
        ? `${humanize(path)} has an invalid value.`
        : e.message;
    }
    const list = Object.values(errors);
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: list.length === 1 ? list[0] : `Please fix ${list.length} fields: ${list.join(' ')}`,
      errors,
    };
  }

  // Bad ObjectId / number in a URL or query
  if (err.name === 'CastError') {
    const message = err.kind === 'ObjectId'
      ? `Invalid ${humanize(err.path === '_id' ? 'id' : err.path).toLowerCase()}: the record may have been deleted.`
      : `${humanize(err.path)} has an invalid value.`;
    return { status: 400, code: 'INVALID_ID', message };
  }

  // Unique index violation
  if (err.code === 11000 || err.code === 11001) {
    const fields = Object.keys(err.keyValue || err.keyPattern || {});
    const shown = fields.filter((f) => !['academicYear', 'semester', 'isActive'].includes(f));
    const field = shown[0] || fields[0];
    const value = field && err.keyValue ? err.keyValue[field] : undefined;
    const message = field
      ? `${humanize(field)}${value !== undefined && typeof value !== 'object' ? ` "${value}"` : ''} already exists.`
      : 'This record already exists.';
    return { status: 409, code: 'DUPLICATE', message, errors: field ? { [field]: message } : undefined };
  }

  if (err.name === 'TokenExpiredError') {
    return { status: 401, code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please sign in again.' };
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return { status: 401, code: 'TOKEN_INVALID', message: 'Your session is invalid. Please sign in again.' };
  }

  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large.'
      : err.code === 'LIMIT_UNEXPECTED_FILE'
      ? 'Unexpected file field.'
      : err.code === 'LIMIT_FILE_COUNT'
      ? 'Too many files.'
      : err.message;
    return { status: 400, code: 'UPLOAD_ERROR', message };
  }
  // upload fileFilter rejections arrive as plain Errors
  if (/Unsupported file type/i.test(err.message || '')) {
    return { status: 400, code: 'UPLOAD_ERROR', message: err.message };
  }

  if (err.message === 'Not allowed by CORS') {
    return { status: 403, code: 'CORS', message: 'This origin is not allowed to use the API.' };
  }

  // Database unreachable
  if (/^Mongo(Network|ServerSelection)Error$/.test(err.name || '') || /buffering timed out/i.test(err.message || '')) {
    return { status: 503, code: 'DB_UNAVAILABLE', message: 'The database is not reachable right now. Please try again in a moment.' };
  }

  const status = Number(err.status || err.statusCode);
  if (status >= 400 && status < 500) {
    return { status, code: err.code || 'REQUEST_ERROR', message: err.message };
  }

  return { status: status >= 500 && status < 600 ? status : 500, code: 'SERVER_ERROR', message: err.message };
};

/**
 * Send an error response.
 *
 * `fallback` is the user-facing message for unexpected (5xx) errors, e.g.
 * 'Error updating room'. Known errors (validation, duplicates, bad ids...)
 * get their own specific message and a 4xx status instead.
 */
const sendError = (res, err, fallback = 'Something went wrong. Please try again.') => {
  const req = res.req || {};
  const info = classify(err);
  const requestId = req.id || crypto.randomBytes(4).toString('hex');
  const serverError = info.status >= 500;

  if (serverError) {
    const who = req.user ? ` user=${req.user._id || req.user.id}` : '';
    console.error(`[${requestId}] ${req.method || ''} ${req.originalUrl || ''}${who} -> ${info.status}`);
    console.error(err && err.stack ? err.stack : err);
  }

  if (res.headersSent) {
    // Streaming responses (SSE) can't change status any more; end them cleanly
    try { res.end(); } catch (_) { /* already closed */ }
    return undefined;
  }

  // Internal details only leave the server in development
  const message = serverError && info.code === 'SERVER_ERROR'
    ? (fallback || 'Something went wrong. Please try again.')
    : info.message;

  return res.status(info.status).json({
    success: false,
    message,
    code: info.code,
    ...(info.errors && { errors: info.errors }),
    ...(serverError && { requestId }),
    ...(!isProduction() && serverError && err && {
      error: err.message,
      stack: err.stack,
    }),
  });
};

/**
 * 400 for express-validator failures. Keeps the `errors` array the forms
 * already read and adds the `message` every page shows.
 */
const sendValidationErrors = (res, result) => {
  const errors = result.array();
  const messages = [...new Set(errors.map((e) => e.msg).filter(Boolean))];
  return res.status(400).json({
    success: false,
    code: 'VALIDATION_ERROR',
    message: messages.length === 0
      ? 'Some fields are invalid.'
      : messages.length === 1
      ? messages[0]
      : `Please fix ${messages.length} fields: ${messages.join('; ')}.`,
    errors,
  });
};

/** Give every request a short id, echoed in X-Request-Id and 5xx bodies. */
const requestId = (req, res, next) => {
  req.id = String(req.headers['x-request-id'] || crypto.randomBytes(4).toString('hex')).slice(0, 64);
  res.setHeader('X-Request-Id', req.id);
  next();
};

/** Wrap an async route handler so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `No API route for ${req.method} ${req.originalUrl}`,
  });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => sendError(res, err);

module.exports = {
  AppError,
  classify,
  sendError,
  sendValidationErrors,
  requestId,
  asyncHandler,
  notFound,
  errorHandler,
};
