const express = require('express');
const router = express.Router();
const FeeStructure = require('../models/FeeStructure');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// GET all fee structures for this tenant (optionally filter by term/session)
router.get('/', requireAuth, requireRole('proprietor', 'admin', 'bursar'), async (req, res) => {
  try {
    const { term, session } = req.query;
    const filter = { tenantId: req.user.tenantId };
    if (term) filter.term = term;
    if (session) filter.session = session;

    const structures = await FeeStructure.find(filter)
      .populate('classId', 'name section')
      .sort({ 'classId.name': 1 });

    res.json(structures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new fee structure for a class/term/session
router.post('/', requireAuth, requireRole('proprietor', 'admin', 'bursar'), async (req, res) => {
  try {
    const { classId, term, session, items } = req.body;

    if (!classId || !term || !session) {
      return res.status(400).json({ error: 'classId, term, and session are required' });
    }

    // Upsert: if one already exists for this class/term/session, replace it
    const structure = await FeeStructure.findOneAndUpdate(
      { tenantId: req.user.tenantId, classId, term, session },
      { tenantId: req.user.tenantId, classId, term, session, items: items || [] },
      { new: true, upsert: true, runValidators: true }
    ).populate('classId', 'name section');

    res.status(201).json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update the items array on an existing fee structure
router.patch('/:id', requireAuth, requireRole('proprietor', 'admin', 'bursar'), async (req, res) => {
  try {
    const { items } = req.body;

    const structure = await FeeStructure.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { items },
      { new: true, runValidators: true }
    ).populate('classId', 'name section');

    if (!structure) return res.status(404).json({ error: 'Fee structure not found' });

    res.json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a fee structure
router.delete('/:id', requireAuth, requireRole('proprietor', 'admin', 'bursar'), async (req, res) => {
  try {
    const deleted = await FeeStructure.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });
    if (!deleted) return res.status(404).json({ error: 'Fee structure not found' });
    res.json({ message: 'Fee structure deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
