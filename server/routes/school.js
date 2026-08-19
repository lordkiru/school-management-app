const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
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

// Update school info
router.patch('/', requireAuth, async (req, res) => {
  try {
    let school = await School.findOne({ tenantId: req.user.tenantId });
    if (!school) {
      school = await School.create({ ...req.body, tenantId: req.user.tenantId });
    } else {
      school = await School.findOneAndUpdate(
        { tenantId: req.user.tenantId },
        req.body,
        { new: true, runValidators: true }
      );
    }
    res.json(school);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload a new school logo
router.post('/logo', requireAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let school = await School.findOne({ tenantId: req.user.tenantId });
    if (!school) {
      school = await School.create({ tenantId: req.user.tenantId, logoUrl: req.file.path });
    } else {
      school = await School.findOneAndUpdate(
        { tenantId: req.user.tenantId },
        { logoUrl: req.file.path },
        { new: true }
      );
    }

    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
