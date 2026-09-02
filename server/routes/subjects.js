const requireAuth = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const requireRole = require('../middleware/requireRole');
const { validateSubject, validateMongoId } = require('../middleware/validators');

router.get('/', requireAuth, async (req, res) => {
  try {
    const subjects = await Subject.find({ tenantId: req.user.tenantId })
      .populate('classId')
      .populate('teacherId', 'name email');
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('proprietor', 'admin'), validateSubject, async (req, res) => {
  try {
    const subject = new Subject({
      ...req.body,
      tenantId: req.user.tenantId,
    });
    await subject.save();
    res.status(201).json(subject);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, validateSubject, async (req, res) => {
  try {
    // Never let the client move a record between tenants via the update body
    const { tenantId, _id, ...updates } = req.body;
    const updated = await Subject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      updates,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Subject not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const deleted = await Subject.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: 'Subject not found' });

    await Score.deleteMany({ tenantId: req.user.tenantId, subjectId: req.params.id });

    res.json({ message: 'Subject and related scores deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign (or unassign) a teacher for a subject
router.patch('/:id/assign-teacher', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const { teacherId } = req.body;

    if (teacherId && !/^[0-9a-fA-F]{24}$/.test(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
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