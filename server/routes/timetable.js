const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const Timetable = require('../models/Timetable');

// Get all timetable entries, optionally filtered by class
router.get('/', requireAuth, async (req, res) => {
  try {
    const { classId } = req.query;
    const filter = { tenantId: req.user.tenantId };
    if (classId) filter.classId = classId;

    const entries = await Timetable.find(filter)
      .populate('classId')
      .populate({
        path: 'subjectId',
        populate: { path: 'teacherId', select: 'name email' },
      });

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new timetable entry
router.post('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { type, subjectId, classId, dayOfWeek, startTime, endTime } = req.body;
    const entryType = type || 'lesson';
    const isBreak = entryType === 'short_break' || entryType === 'long_break';

    const entryData = {
      tenantId: req.user.tenantId,
      classId,
      dayOfWeek,
      startTime,
      endTime,
      type: entryType,
    };

    // Only set subjectId for lesson entries — breaks don't have a subject
    if (!isBreak && subjectId) {
      entryData.subjectId = subjectId;
    }

    const entry = new Timetable(entryData);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a timetable entry
router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const deleted = await Timetable.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: 'Timetable entry not found' });
    res.json({ message: 'Timetable entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
