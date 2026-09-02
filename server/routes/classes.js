const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const { validateClass, validateMongoId } = require('../middleware/validators');

router.get('/', requireAuth, async (req, res) => {
  try {
    const classes = await Class.find({ tenantId: req.user.tenantId });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('proprietor', 'admin'), validateClass, async (req, res) => {
  try {
    const newClass = new Class({
      ...req.body,
      tenantId: req.user.tenantId,
    });
    await newClass.save();
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, validateClass, async (req, res) => {
  try {
    // Never let the client move a record between tenants via the update body
    const { tenantId, _id, ...updates } = req.body;
    const updated = await Class.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      updates,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Class not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const deleted = await Class.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Class deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;