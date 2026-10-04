const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy - Required for Render deployment
// This allows Express to trust the X-Forwarded-* headers from the proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

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
      'http://localhost:3000',
      'http://localhost:5173',
      'https://time-table-ivory.vercel.app',
      'https://technotabler.cebutech.digital'
    ];
    
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: 'Too many requests from this IP, please try again later.',
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Database connection
const connectDB = require('./config/database');
connectDB();

// Activity logger middleware - logs all authenticated actions
const { activityLoggerMiddleware } = require('./services/activityLogger.service');
app.use('/api/', activityLoggerMiddleware({
  logReads: false, // Don't log GET requests to reduce noise
  excludePaths: ['/api/health', '/api/auth/me', '/api/activity-logs']
}));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
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
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/ai', require('./routes/aiChat.routes'));
app.use('/api/import', require('./routes/import.routes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'CoTE Timetabling API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000' // Debug: show what FRONTEND_URL is set to
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Multer failures are client errors, not 500s. Without this an oversized or
  // wrong-type upload surfaces as "Internal Server Error" with no explanation.
  if (err && err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large.'
      : err.code === 'LIMIT_UNEXPECTED_FILE'
      ? 'Unexpected file field.'
      : err.message;
    return res.status(400).json({ success: false, message });
  }

  // fileFilter rejections arrive as plain Errors
  if (err && /Unsupported file type/i.test(err.message || '')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(60));
  console.log('🎓 CoTE Timetabling System - Backend Server');
  console.log('═'.repeat(60));
  console.log(`📍 Mode:        ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Port:        ${PORT}`);
  console.log(`🌐 API:         http://localhost:${PORT}/api`);
  console.log(`💚 Health:      http://localhost:${PORT}/api/health`);
  console.log(`📊 Endpoints:   91 API endpoints active`);
  console.log('═'.repeat(60) + '\n');
  console.log('✓ Server is ready to handle requests');
  console.log('✓ Press Ctrl+C to stop\n');
});

module.exports = app;
