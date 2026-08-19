const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const AuditLog = require('../models/AuditLog');

router.get('/', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const logs = await AuditLog.find({ tenantId: req.user.tenantId }).sort({ performedAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
