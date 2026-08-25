require('dotenv').config();

// ─── Startup environment validation ───────────────────────────────────────────
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Check your .env file against server/.env.example');
  process.exit(1);
}
if (!process.env.PAYSTACK_SECRET_KEY) {
  console.warn('⚠️  PAYSTACK_SECRET_KEY not set — payment features will not work.');
}
// ──────────────────────────────────────────────────────────────────────────────

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initSentry, getSentryMiddleware } = require('./config/sentry');

const app = express();

// Initialize Sentry FIRST (before any other middleware)
initSentry(app);
const sentryMiddleware = getSentryMiddleware();

// Sentry request handler must be the first middleware
app.use(sentryMiddleware.requestHandler);
// TracingHandler creates a trace for every incoming request
app.use(sentryMiddleware.tracingHandler);

// Security middleware
app.use(helmet()); // Set security headers

// HTTP request logging — concise in production, verbose in development
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// CORS configuration with origin whitelist
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to ALL routes
app.use(apiLimiter);

// Import routes
const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const subjectRoutes = require('./routes/subjects');
const scoreRoutes = require('./routes/scores');
const feeRoutes = require('./routes/fees');
const authRoutes = require('./routes/auth');
const schoolRoutes = require('./routes/school');
const auditLogRoutes = require('./routes/auditlog');
const paystackWebhookRoutes = require('./routes/paystackWebhook');
const staffRoutes = require('./routes/staff');
const timetableRoutes = require('./routes/timetable');
const sessionRoutes = require('./routes/sessions');
const parentRoutes = require('./routes/parents');
const tenantRoutes = require('./routes/tenants');
const subscriptionRoutes = require('./routes/subscriptions');
const superAdminRoutes = require('./routes/superadmin');
const feeStructureRoutes = require('./routes/feeStructure');
const attendanceRoutes = require('./routes/attendance');
const notificationRoutes = require('./routes/notifications');
const remarkRoutes = require('./routes/remarks');

// Register routes
app.use('/students', studentRoutes);
app.use('/classes', classRoutes);
app.use('/subjects', subjectRoutes);
app.use('/scores', scoreRoutes);
app.use('/fees', feeRoutes);
app.use('/auth', authRoutes);
app.use('/school', schoolRoutes);
app.use('/auditlog', auditLogRoutes);
app.use('/paystack/webhook', paystackWebhookRoutes);
app.use('/staff', staffRoutes);
app.use('/timetable', timetableRoutes);
app.use('/sessions', sessionRoutes);
app.use('/parents', parentRoutes);
app.use('/tenants', tenantRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/superadmin', superAdminRoutes);
app.use('/fee-structure', feeStructureRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/notifications', notificationRoutes);
app.use('/remarks', remarkRoutes);

app.get('/', (req, res) => {
  res.send('API is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), environment: process.env.NODE_ENV || 'development' });
});

// Sentry error handler must be AFTER all routes but BEFORE other error handlers
app.use(sentryMiddleware.errorHandler);

// Custom error handler (after Sentry)
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Sanitize error messages in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An error occurred. Please try again later.'
      : err.message || 'Internal server error';

  res.status(err.status || 500).json({
    error: message,
  });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
