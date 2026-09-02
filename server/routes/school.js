const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const School = require('../models/School');
const upload = require('../uploadConfig');

// Get school info (creates a default one if none exists yet)
router.get('/', requireAuth, async (req, res) => {
  try {
    let school = await School.findOne({ tenantId: req.user.tenantId });
    if (!school) {
      school = await School.create({ tenantId: req.user.tenantId });
    }
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update school info (proprietor or admin only)
router.patch('/', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    // Never let the client move a record between tenants via the update body
    const { tenantId, _id, ...updates } = req.body;
    let school = await School.findOne({ tenantId: req.user.tenantId });
    if (!school) {
      school = await School.create({ ...updates, tenantId: req.user.tenantId });
    } else {
      school = await School.findOneAndUpdate(
        { tenantId: req.user.tenantId },
        updates,
        { new: true, runValidators: true }
      );
    }
    res.json(school);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload a new school logo (proprietor or admin only)
router.post('/logo', requireAuth, requireRole('proprietor', 'admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoUrl = req.file.secure_url || req.file.url;
    if (!logoUrl) {
      return res.status(500).json({ error: 'Upload succeeded but Cloudinary did not return a URL' });
    }

    let school = await School.findOne({ tenantId: req.user.tenantId });
    if (!school) {
      school = await School.create({ tenantId: req.user.tenantId, logoUrl });
    } else {
      school = await School.findOneAndUpdate(
        { tenantId: req.user.tenantId },
        { logoUrl },
        { new: true }
      );
    }

    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;