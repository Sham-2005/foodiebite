require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const { validateEnv } = require('./config/envValidation');
const requestCorrelation = require('./middleware/requestCorrelation');
const errorHandler   = require('./middleware/errorHandler');

const authRoutes     = require('./routes/authRoutes');
const userRoutes     = require('./routes/userRoutes');
const foodRoutes     = require('./routes/foodRoutes');
const coachRoutes    = require('./routes/coachRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const feedbackRoutes  = require('./routes/feedbackRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const medicalRoutes  = require('./routes/medicalRoutes');
const nearbyRoutes   = require('./routes/nearbyRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const emailRoutes      = require('./routes/emailRoutes');

// Validate production environment variables at startup
validateEnv();

const app = express();

// ── Correlation ID & Operational Logging ────────────────
app.use(requestCorrelation);

// ── Security middlewares ──────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = new Set([
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ── Rate limiting ─────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

app.use('/api/food/search', rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 min
  max: 30,
  message: { success: false, message: 'Too many search requests.' },
}));

app.use('/api/coach', rateLimit({
  windowMs: parseInt(process.env.COACH_RATE_LIMIT_WINDOW_MS, 10) || 1 * 60 * 1000,
  max: parseInt(process.env.COACH_RATE_LIMIT_MAX, 10) || 60,
  message: { success: false, message: 'Too many AI coach requests. Please slow down.' }
}));

app.use('/api/nearby', rateLimit({
  windowMs: parseInt(process.env.NEARBY_RATE_LIMIT_WINDOW_MS, 10) || 1 * 60 * 1000,
  max: parseInt(process.env.NEARBY_RATE_LIMIT_MAX, 10) || 60,
  message: { success: false, message: 'Too many nearby discovery requests. Please slow down.' }
}));

// ── Body parsing ──────────────────────────────────────
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Logger (dev only) ─────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Static uploads ────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Operational Endpoints: Health & Readiness ─────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'pass',
    message: 'FoodieBite API is running',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    reloadedAt: Date.now()
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({
    success: true,
    ready: true,
    services: {
      aiEngine: 'healthy',
      nearbyService: 'healthy'
    },
    timestamp: new Date().toISOString()
  });
});

// ── Debug / Diagnostic Endpoints ──────────────────────
app.get('/api/debug/ai', (req, res) => {
  res.status(200).json({
    success: true,
    engine: 'FoodieBite Local AI Engine',
    configured: true,
    provider: 'local_deterministic',
    model: 'foodiebite-ai-v1',
    externalAiCalls: 0,
    apiKeyRequired: false,
    apiKeyPresent: false,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug/tars', async (req, res) => {
  res.status(200).json({
    legacyNotice: 'TARS has been deprecated in favor of local FoodieBite AI Engine',
    activeEngineEndpoint: '/api/debug/ai',
    externalAiCalls: 0
  });
});

app.get('/api/debug/gemini', (req, res) => {
  res.status(200).json({
    externalAiCalls: 0,
    apiKeyPresent: false,
    geminiConfigured: false,
    notice: 'FoodieBite runs 100% locally with 0 external AI dependencies.'
  });
});

app.get('/api/debug/firestore', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'mock-foodiebite'
      });
    }
    const db = admin.firestore();
    await db.collection('apiHealth').limit(1).get();
    res.status(200).json({
      firestoreConnected: true
    });
  } catch (err) {
    console.error('Debug Firestore check failed:', err.message);
    res.status(200).json({
      firestoreConnected: false
    });
  }
});

// ── API Routes ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/medical', medicalRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/nearby', nearbyRoutes);
app.use('/api/email', emailRoutes);

// ── API route summary (dev helper) ───────────────────
if (process.env.NODE_ENV === 'development') {
  app.get('/api', (req, res) => {
    res.json({
      message: 'FoodieBite API v2.0',
      endpoints: {
        auth: {
          'POST /api/auth/register':  'Register user',
          'POST /api/auth/login':     'Login user',
          'GET  /api/auth/me':        'Get current user (auth)',
          'PUT  /api/auth/password':  'Update password (auth)',
        },
        user: {
          'GET  /api/user/profile':                   'Get profile (auth)',
          'PUT  /api/user/profile':                   'Update profile (auth)',
          'GET  /api/user/preferences':               'Get preferences (auth)',
          'PUT  /api/user/preferences':               'Update preferences (auth)',
          'GET  /api/user/favorites':                 'Get favorites (auth)',
          'POST /api/user/favorites/food':            'Add food favorite (auth)',
          'DEL  /api/user/favorites/food/:foodId':    'Remove food favorite (auth)',
          'POST /api/user/favorites/restaurant':      'Add restaurant favorite (auth)',
          'DEL  /api/user/favorites/restaurant/:id':  'Remove restaurant favorite (auth)',
          'GET  /api/user/medical':                   'Get medical reports (auth)',
          'POST /api/user/medical':                   'Upload medical report (auth)',
          'DEL  /api/user/medical/:reportId':         'Delete medical report (auth)',
          'GET  /api/user/search-history':            'Get search history (auth)',
          'DEL  /api/user/search-history':            'Clear search history (auth)',
        },
        food: {
          'GET /api/food/recommendations': 'Get personalised recommendations (auth)',
          'GET /api/food/search?q=':       'Search foods (optional auth)',
          'GET /api/food/:barcode':        'Get food by barcode',
        },
        email: {
          'GET  /api/email/verify': 'Verify Gmail SMTP connection & STARTTLS (auth)',
          'POST /api/email/test':   'Send test email via Gmail SMTP (auth)',
        },
      },
    });
  });
}

// ── 404 handler ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Central error handler ─────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 FoodieBite API running on http://localhost:${PORT}`);
  console.log(`📋 Routes summary: http://localhost:${PORT}/api`);
  console.log(`💚 Health check:   http://localhost:${PORT}/health`);
  console.log(`🚦 Readiness:      http://localhost:${PORT}/ready`);
  console.log(`🌍 ENV: ${process.env.NODE_ENV || 'development'}\n`);

  // Start background daily email scheduler
  try {
    const { initScheduler } = require('./services/scheduler');
    initScheduler();
  } catch (err) {
    console.error('❌ Failed to initialize background scheduler:', err);
  }
});

// ── Graceful Shutdown Handler ─────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('✅ HTTP server closed successfully.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
