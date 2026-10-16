const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { isIP } = require('net');

// Key used when req.ip is missing or still isn't a real address after cleaning, so
// the request is still counted (in one shared bucket) instead of throwing or
// skipping rate limiting.
const UNKNOWN_IP_KEY = 'ip:unknown';

// Turn req.ip into a clean address, or null if it can't be made into one.
//
// Why this exists: our traffic goes Cloudflare -> Worker -> Azure App Service, and
// Azure's front end appends the source port to the X-Forwarded-For entry it adds
// ("104.23.229.60:9368"). With `trust proxy` on, Express hands that string back as
// req.ip. express-rate-limit's default key generator then throws
// ERR_ERL_INVALID_IP_ADDRESS on it, and used raw as a key it changes with every
// connection (new port), so one client would get a fresh budget each time. Don't
// "simplify" this back to plain req.ip.
function cleanIp(raw) {
  if (typeof raw !== 'string') return null;
  let ip = raw.trim();

  const bracketed = ip.match(/^\[([^\]]+)\](?::\d{1,5})?$/); // "[2001:db8::1]:443" or "[::1]"
  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/); // "1.2.3.4:5678"
  if (bracketed) ip = bracketed[1];
  else if (ipv4WithPort) ip = ipv4WithPort[1];
  // a bare IPv6 address ("2001:db8::1") is left alone: its colons aren't a port

  return isIP(ip) ? ip : null;
}

// IP-only key. Used by the login and payment limiters, where the bucket must be the
// caller's network address and never something the caller can choose.
function ipKey(req) {
  const ip = cleanIp(req.ip);
  return ip ? `ip:${ip}` : UNKNOWN_IP_KEY;
}

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
  return ipKey(req);
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

// Pulling questions from the Lemida question bank samples the database each time, so it gets its own
// budget. Keyed per user (the route runs requireAuth first, so the token has been verified).
const bankPickLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'You are adding questions too quickly. Please wait a few minutes and try again.'
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
  keyGenerator: ipKey,
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
  keyGenerator: ipKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many payment attempts, please try again later.'
    });
  },
});

module.exports = {
  apiLimiter,
  bankPickLimiter,
  authLimiter,
  paymentLimiter,
  // exported for verification only
  cleanIp,
  ipKey,
  rateLimitKey,
};
