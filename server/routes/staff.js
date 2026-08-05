const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');

// List all staff (teachers, bursars, admins) — proprietor and admin
router.get('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const staff = await User.find({ role: { $in: ['teacher', 'bursar', 'admin'] } }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new staff account
router.post('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const allowedRoles = req.user.role === 'proprietor'
      ? ['teacher', 'bursar', 'admin']
      : ['teacher'];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `You are not allowed to create a ${role} account` });
    }

    const user = new User({ name, email, password, role });
    await user.save();

    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a staff account — proprietor only
router.delete('/:id', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, role: { $in: ['teacher', 'bursar', 'admin'] } });
    if (!user) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;