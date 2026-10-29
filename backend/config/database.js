const mongoose = require('mongoose');

// Common Atlas / local failures, with what to do about them
const hintFor = (error) => {
  const text = `${error.name} ${error.message}`;
  if (!process.env.MONGODB_URI) return 'MONGODB_URI is not set in backend/.env';
  if (/bad auth|Authentication failed/i.test(text)) return 'check the username and password in MONGODB_URI';
  if (/ENOTFOUND|querySrv|EAI_AGAIN/i.test(text)) return 'the cluster host could not be resolved: check MONGODB_URI and your internet connection';
  if (/whitelist|IP.*not.*allowed|Could not connect to any servers/i.test(text)) return 'add this machine\'s IP to the Atlas Network Access list';
  if (/ECONNREFUSED/i.test(text)) return 'is MongoDB running on that host and port?';
  return undefined;
};

/**
 * Connect to MongoDB. Resolves with what the startup report shows;
 * never throws (the caller decides whether to exit).
 */
const connectDB = async () => {
  const started = Date.now();
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
    const conn = await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

    mongoose.connection.on('error', (err) => {
      console.error(`✗ MongoDB error: ${err.message}`);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('! MongoDB disconnected, retrying...');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('✓ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('\n✓ MongoDB connection closed, server stopped');
      process.exit(0);
    });

    return {
      ok: true,
      host: conn.connection.host,
      name: conn.connection.name,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message.split('\n')[0].slice(0, 160),
      hint: hintFor(error),
      ms: Date.now() - started,
    };
  }
};

module.exports = connectDB;
