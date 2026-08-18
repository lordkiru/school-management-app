const express = require('express');
const router = express.Router();
const { captureError, captureMessage } = require('../config/sentry');

// Test endpoint to trigger an error (for testing Sentry)
router.get('/error', (req, res) => {
  // This will be caught by Sentry
  throw new Error('Test error for Sentry - This is intentional!');
});

// Test endpoint to capture a message
router.get('/message', (req, res) => {
  captureMessage('Test message from Sentry', 'info');
  res.json({ message: 'Test message sent to Sentry' });
});

// Test endpoint to manually capture an error
router.get('/manual-error', (req, res) => {
  try {
    // Simulate some operation that fails
    const result = JSON.parse('invalid json');
  } catch (error) {
    captureError(error, {
      endpoint: '/test/manual-error',
      user: req.user?.email || 'anonymous',
    });
    res.status(500).json({ error: 'Error captured and sent to Sentry' });
  }
});

module.exports = router;
