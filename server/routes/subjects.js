const requireAuth = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const requireRole = require('../middleware/requireRole');

router.get('/', requireAuth, async (req, res) => {
  try {
    const subjects = await Subject.find().populate('classId').populate('teacherId', 'name email');
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    res.status(201).json(subject);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const updated = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: 'Subject not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Subject not found' });

    await Score.deleteMany({ subjectId: req.params.id });

    res.json({ message: 'Subject and related scores deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign (or unassign) a teacher for a subject
router.patch('/:id/assign-teacher', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { teacherId } = req.body;

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { teacherId: teacherId || null },
      { new: true, runValidators: true }
    ).populate('teacherId', 'name email');

    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    res.json(subject);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;