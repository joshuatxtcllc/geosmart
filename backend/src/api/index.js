/**
 * CloudCall API Server
 * Main API routing and middleware configuration
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { authenticateJWT } = require('../middleware/auth');
const config = require('../config');

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const phoneRoutes = require('./routes/phone-numbers');
const callRoutes = require('./routes/calls');
const smsRoutes = require('./routes/sms');
const analyticsRoutes = require('./routes/analytics');
const webhookRoutes = require('./routes/webhooks');

// Create Express app
const app = express();

// Basic security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
app.use(morgan('combined'));

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: config.version });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateJWT, userRoutes);
app.use('/api/phone-numbers', authenticateJWT, phoneRoutes);
app.use('/api/calls', authenticateJWT, callRoutes);
app.use('/api/sms', authenticateJWT, smsRoutes);
app.use('/api/analytics', authenticateJWT, analyticsRoutes);

// Webhooks don't use JWT auth, they use API keys
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  res.status(err.status || 500).json({
    error: config.environment === 'production' ? 'Internal Server Error' : err.message
  });
});

module.exports = app;
