const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Key by authenticated user when a token is present, so staff sharing one office
// IP don't share one rate-limit budget — falls back to IP for anonymous requests
// (public pages, login). Uses jwt.decode (no signature check) purely to read the
// user id for bucketing; requireAuth elsewhere still does real verification.
function rateLimitKey(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.id) return `user:${decoded.id}`;
    } catch {
      // malformed token — fall through to IP-based key
    }
  }
  return req.ip;
}

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Generous headroom: most dashboard pages fire several parallel fetches on
  // mount, and this budget is shared by everyone behind the same key, so the
  // old 100/15min limit was tripping during normal use, not abuse.
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again shortly.'
    });
  },
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts, please try again after 15 minutes.'
    });
  },
});

// Rate limiter for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 payment attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many payment attempts, please try again later.'
    });
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  paymentLimiter,
};
