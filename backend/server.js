const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { requestId, notFound, errorHandler } = require('./middleware/error.middleware');
const {
  sanitizeRequest, noDuplicateParams, securityHeaders, aiLimiter, uploadLimiter,
} = require('./middleware/security.middleware');

// Refuse to run without a signing secret: every login token depends on it
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add a long random value to backend/.env before starting the server.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET is shorter than 32 characters; use a long random value so tokens cannot be guessed.');
}

const app = express();

// Don't advertise the framework: it tells an attacker which exploits to try
app.disable('x-powered-by');

// Trust proxy - Required for Render deployment
// This allows Express to trust the X-Forwarded-* headers from the proxy
app.set('trust proxy', 1);

app.use(requestId);

// Security middleware
app.use(helmet({
  // Browsers that have seen this header refuse to talk to the API over plain
  // HTTP for a year, which closes the downgrade window on public Wi-Fi.
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  // The API serves JSON and uploaded images; nothing here should ever be
  // framed, embedded as a script, or treated as a document by a browser.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // avatars load from the SPA
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(securityHeaders);

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Get frontend URL and normalize it (remove trailing slash)
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Allow the frontend URL and localhost
    const allowedOrigins = [
      frontendUrl,
      'https://time-table-ivory.vercel.app',
      'https://technotabler.cebutech.digital',
      // Local dev servers only when explicitly in development
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:5173'] : []),
    ];
    
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id']
}));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development for localhost
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && 
           (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1');
  }
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 200 }));

// Strip Mongo operators and collapse repeated query parameters before any
// handler sees the request
app.use(sanitizeRequest);
app.use(noDuplicateParams);

// Serve static files from uploads folder with CORS headers.
// UPLOAD_ROOT is absolute, so this resolves the same way regardless of the
// directory the server was started from (express.static('uploads') was
// relative to the process CWD and silently served nothing otherwise).
const { UPLOAD_ROOT } = require('./middleware/upload.middleware');
app.use('/uploads', (req, res, next) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  res.header('Access-Control-Allow-Origin', frontendUrl);
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOAD_ROOT));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Database connection (awaited in the startup report below)
const connectDB = require('./config/database');
const dbReady = connectDB();

// Activity logger middleware - logs all authenticated actions
const { activityLoggerMiddleware } = require('./services/activityLogger.service');
app.use('/api/', activityLoggerMiddleware({
  logReads: false, // Don't log GET requests to reduce noise
  excludePaths: ['/api/health', '/api/auth/me', '/api/activity-logs']
}));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes')); // Optimized dashboard stats
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/faculty', require('./routes/faculty.routes'));
app.use('/api/subjects', require('./routes/subject.routes'));
app.use('/api/rooms', require('./routes/room.routes'));
app.use('/api/schedules', require('./routes/schedule.routes'));
app.use('/api/classSpaces', require('./routes/classSpace.routes'));
app.use('/api/students', require('./routes/student.routes'));
app.use('/api/sections', require('./routes/section.routes'));
app.use('/api/programs', require('./routes/program.routes'));
app.use('/api/activity-logs', require('./routes/activityLog.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/ai', aiLimiter, require('./routes/ai.routes'));
app.use('/api/ai', aiLimiter, require('./routes/aiChat.routes'));
app.use('/api/import', uploadLimiter, require('./routes/import.routes'));
app.use('/api/terms', require('./routes/term.routes'));
app.use('/api/faculty-invites', require('./routes/facultyInvite.routes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'CoTE Timetabling API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 for unknown API routes, then one handler for every error
app.use(notFound);
app.use(errorHandler);

// Log crashes with context instead of dying silently
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
const startedAt = Date.now() - process.uptime() * 1000;

// When nodemon restarts, the old process can take a moment to release the
// port (especially on Windows), so wait for it instead of crashing at once.
const PORT_RETRIES = 10;
const PORT_RETRY_MS = 500;

const onReady = async () => {
  const { printStartupReport } = require('./utils/startupReport');
  const { checkORToolsAvailability } = require('./services/ortoolsBridge.service');

  const [db, solver] = await Promise.all([
    dbReady,
    checkORToolsAvailability().catch((err) => ({ available: false, error: err.message })),
  ]);

  printStartupReport({
    app,
    port: PORT,
    startedAt,
    db,
    solver,
    ai: { keys: new Set(['', '_1', '_2', '_3', '_4', '_5'].map((n) => process.env[`GEMINI_API_KEY${n}`]).filter(Boolean)).size },
    email: {
      consoleMode: process.env.EMAIL_CONSOLE_MODE === 'true',
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER,
    },
  });

  // Without a database every request fails; stop so nodemon shows the crash
  if (!db.ok) process.exit(1);

  // Start each academic term on its start date (moves sections, archives
  // the previous term). Checks shortly after start-up, then every 30 min.
  require('./services/academicTerm.service').startTermWatcher();
  require('./services/weeklyDigest.service').startDigestWatcher();
  // Faculty: today's classes in the morning, and a heads-up before each class
  require('./services/classReminder.service').startReminderWatcher();
  // Nobody opens Settings unprompted, so the two-factor deadline comes to them
  require('./services/twoFactorReminder.service').startTwoFactorReminderWatcher();
};

const listen = (attempt = 1) => {
  const server = app.listen(PORT, onReady);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < PORT_RETRIES) {
      if (attempt === 1) console.log(`  … port ${PORT} is busy, waiting for it to free up`);
      setTimeout(() => listen(attempt + 1), PORT_RETRY_MS);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(`
✗ Port ${PORT} is still in use after ${(PORT_RETRIES * PORT_RETRY_MS) / 1000}s.`
        + `
  Another server is running there: stop it (netstat -ano | findstr :${PORT}), or set PORT in backend/.env.
`);
    } else {
      console.error('✗ Server failed to start:', err.message);
    }
    process.exit(1);
  });
};

listen();

module.exports = app;
