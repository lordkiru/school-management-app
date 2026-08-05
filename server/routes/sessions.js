const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const Session = require('../models/Session');

// Get all sessions
router.get('/', requireAuth, async (req, res) => {
  try {
    const sessions = await Session.find().sort({ name: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new session
router.post('/', requireAuth, async (req, res) => {
  try {
    const session = new Session(req.body);
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark a session as the current one (unmarks every other session)
router.patch('/:id/set-current', requireAuth, async (req, res) => {
  try {
    await Session.updateMany({}, { $set: { isCurrent: false } });

    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { isCurrent: true },
      { new: true }
    );

    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a session
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await Session.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;