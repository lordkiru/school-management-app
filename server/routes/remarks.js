const express = require('express');
const router = express.Router();
const TeacherRemark = require('../models/TeacherRemark');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// ─────────────────────────────────────────────────────────────────────────────
// GET /remarks?classId=&term=&session=
// Get all remarks for a class in a term/session (for bulk display)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId, term, session } = req.query;
    if (!classId || !term || !session) {
      return res.status(400).json({ error: 'classId, term, and session are required' });
    }
    const remarks = await TeacherRemark.find({
      tenantId: req.user.tenantId,
      classId,
      term,
      session,
    }).populate('studentId', 'name admissionNumber');
    res.json(remarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /remarks/student/:studentId?term=&session=
// Get a single student's remark for a term/session
// ─────────────────────────────────────────────────────────────────────────────
router.get('/student/:studentId', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { term, session } = req.query;
    const remark = await TeacherRemark.findOne({
      tenantId: req.user.tenantId,
      studentId: req.params.studentId,
      term,
      session,
    });
    res.json(remark || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /remarks  — upsert a remark (teacher or admin)
// Body: { studentId, classId, term, session, remark, principalRemark }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { studentId, classId, term, session, remark, principalRemark } = req.body;
    if (!studentId || !classId || !term || !session) {
      return res.status(400).json({ error: 'studentId, classId, term, and session are required' });
    }

    const filter = { tenantId: req.user.tenantId, studentId, term, session };
    const update = {
      tenantId: req.user.tenantId,
      studentId,
      classId,
      term,
      session,
      remark: remark ?? '',
      addedBy: req.user.id,
    };

    // Only proprietor/admin can set principal remark
    if (['proprietor', 'admin'].includes(req.user.role) && principalRemark !== undefined) {
      update.principalRemark = principalRemark;
    }

    const result = await TeacherRemark.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
