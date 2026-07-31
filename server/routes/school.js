const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const School = require('../models/School');

// Get school info (creates a default one if none exists yet)
router.get('/', requireAuth, async (req, res) => {
  try {
    let school = await School.findOne();
    if (!school) {
      school = await School.create({});
    }
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update school info
router.patch('/', requireAuth, async (req, res) => {
  try {
    let school = await School.findOne();
    if (!school) {
      school = await School.create(req.body);
    } else {
      school = await School.findByIdAndUpdate(school._id, req.body, {
        new: true,
        runValidators: true,
      });
    }
    res.json(school);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;