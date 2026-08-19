const express = require('express');
const router = express.Router();
const Parent = require('../models/Parent');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateParent, validateLogin, validateStudentId, validateMongoId } = require('../middleware/validators');

// Get all parents (admin only)
router.get('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const parents = await Parent.find({ tenantId: req.user.tenantId }).populate('children');
    res.json(parents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new parent (admin only)
router.post('/', requireAuth, requireRole('proprietor', 'admin'), validateParent, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if parent already exists in this tenant
    const existingParent = await Parent.findOne({ tenantId: req.user.tenantId, email });
    if (existingParent) {
      return res.status(400).json({ error: 'Parent with this email already exists' });
    }

    // Password will be automatically hashed by the pre-save hook in the model
    const parent = new Parent({
      tenantId: req.user.tenantId,
      name,
      email,
      phone,
      password, // No manual hashing needed - model handles it
    });

    await parent.save();
    res.status(201).json(parent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Parent login
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({ email });
    if (!parent) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Use the comparePassword method from the model
    const isMatch = await parent.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: parent._id, role: 'parent', tenantId: parent.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, parent: { _id: parent._id, name: parent.name, email: parent.email, tenantId: parent.tenantId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get parent's children
router.get('/me/children', requireAuth, async (req, res) => {
  try {
    const parent = await Parent.findOne({ _id: req.user.id, tenantId: req.user.tenantId }).populate({
      path: 'children',
      populate: { path: 'classId' }
    });
    
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    res.json(parent.children);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link a child to parent
router.post('/:id/link-child', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, validateStudentId, async (req, res) => {
  try {
    const { studentId } = req.body;
    const parent = await Parent.findOne({ _id: req.params.id, tenantId: req.user.tenantId });

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    if (parent.children.includes(studentId)) {
      return res.status(400).json({ error: 'Child already linked to this parent' });
    }

    parent.children.push(studentId);
    await parent.save();

    res.json(parent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unlink a child from parent
router.post('/:id/unlink-child', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, validateStudentId, async (req, res) => {
  try {
    const { studentId } = req.body;
    const parent = await Parent.findOne({ _id: req.params.id, tenantId: req.user.tenantId });

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    parent.children = parent.children.filter(id => id.toString() !== studentId);
    await parent.save();

    res.json(parent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a parent
router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const parent = await Parent.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }
    res.json({ message: 'Parent deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
