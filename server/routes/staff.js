const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const User = require('../models/User');
const { validateStaff, validateMongoId } = require('../middleware/validators');

// List all staff (teachers, bursars, admins) — proprietor and admin
router.get('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const staff = await User.find({ 
      tenantId: req.user.tenantId,
      role: { $in: ['teacher', 'bursar', 'admin'] } 
    }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new staff account
router.post('/', requireAuth, requireActiveSubscription, requireRole('proprietor', 'admin'), validateStaff, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const allowedRoles = req.user.role === 'proprietor'
      ? ['teacher', 'bursar', 'admin']
      : ['teacher'];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `You are not allowed to create a ${role} account` });
    }

    const user = new User({ 
      tenantId: req.user.tenantId,
      name, 
      email, 
      password, 
      role 
    });
    await user.save();

    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Edit a staff account — proprietor can change name/email/role; admin can only change name/email
router.patch('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const staff = await User.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      role: { $in: ['teacher', 'bursar', 'admin'] },
    });

    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    // Update name if provided
    if (name && name.trim()) staff.name = name.trim();

    // Update email if provided (check for duplicates within same tenant)
    if (email && email.trim()) {
      const emailLower = email.toLowerCase().trim();
      if (emailLower !== staff.email) {
        const existing = await User.findOne({ tenantId: req.user.tenantId, email: emailLower, _id: { $ne: staff._id } });
        if (existing) return res.status(400).json({ error: 'That email is already in use by another account' });
        staff.email = emailLower;
      }
    }

    // Only proprietors can change roles
    if (role) {
      if (req.user.role !== 'proprietor') {
        return res.status(403).json({ error: 'Only proprietors can change staff roles' });
      }
      const allowedRoles = ['teacher', 'bursar', 'admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      staff.role = role;
    }

    await staff.save();

    res.json({ id: staff._id, name: staff.name, email: staff.email, role: staff.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a staff account — proprietor only
router.delete('/:id', requireAuth, requireRole('proprietor'), validateMongoId, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.user.tenantId,
      role: { $in: ['teacher', 'bursar', 'admin'] } 
    });
    if (!user) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
