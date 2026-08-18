const Sentry = require('@sentry/node');

function initSentry(app) {
  // Only initialize Sentry if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not found, skipping error tracking');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions
    // Environment
    environment: process.env.NODE_ENV || 'development',
  });

  console.log('✅ Sentry error tracking initialized');
}

function getSentryMiddleware() {
  // Return simple middleware that uses Sentry directly
  return {
    requestHandler: (req, res, next) => {
      // Sentry automatically captures request context
      next();
    },
    tracingHandler: (req, res, next) => {
      // Tracing is handled by Sentry.init
      next();
    },
    errorHandler: (err, req, res, next) => {
      // Capture the error in Sentry
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
      }
      next(err);
    },
  };
}

// Manual error capture function
function captureError(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

// Manual message capture function
function captureMessage(message, level = 'info') {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

module.exports = {
  initSentry,
  getSentryMiddleware,
  captureError,
  captureMessage,
};
