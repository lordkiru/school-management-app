const requireAuth = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const Class = require('../models/Class');
const User = require('../models/User');
const requireRole = require('../middleware/requireRole');
const { validateSubject, validateSubjectBulk, validateAssignTeacherBulk, validateMongoId } = require('../middleware/validators');

router.get('/', requireAuth, async (req, res) => {
  try {
    const subjects = await Subject.find({ tenantId: req.user.tenantId })
      .populate('classId')
      .populate('teacherId', 'name email');
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('proprietor', 'admin'), validateSubject, async (req, res) => {
  try {
    const subject = new Subject({
      ...req.body,
      tenantId: req.user.tenantId,
    });
    await subject.save();
    res.status(201).json(subject);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subjects/bulk
// Add one subject name across several classes in a single action — each class
// still gets its own Subject document underneath (unchanged data model), this
// just does the repetitive per-class creation for you. Registered before
// PATCH /:id / POST /:id-shaped routes so "bulk" is never swallowed as an id.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/bulk', requireAuth, requireRole('proprietor', 'admin'), validateSubjectBulk, async (req, res) => {
  try {
    const { name } = req.body;
    const classIds = [...new Set(req.body.classIds)];

    const validClassCount = await Class.countDocuments({ tenantId: req.user.tenantId, _id: { $in: classIds } });
    if (validClassCount !== classIds.length) {
      return res.status(400).json({ error: 'One or more selected classes do not belong to your school' });
    }

    const created = [];
    let alreadyExistedCount = 0;
    for (const classId of classIds) {
      const existing = await Subject.findOne({ tenantId: req.user.tenantId, name, classId });
      if (existing) {
        alreadyExistedCount++;
        continue;
      }
      created.push(await Subject.create({ tenantId: req.user.tenantId, name, classId }));
    }

    res.status(201).json({
      created,
      message: `${name} added to ${created.length} class(es)` +
        (alreadyExistedCount ? `; already existed in ${alreadyExistedCount} class(es)` : ''),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /subjects/assign-teacher-bulk
// Assign (or unassign, with teacherId: null) one teacher to a subject across
// several classes in one action. Only touches classes where that subject
// already exists — it doesn't create the subject there. A different teacher
// can still be assigned separately to the same subject name in another class,
// since each class's Subject document keeps its own independent teacherId.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/assign-teacher-bulk', requireAuth, requireRole('proprietor', 'admin'), validateAssignTeacherBulk, async (req, res) => {
  try {
    const { name, teacherId } = req.body;
    const classIds = [...new Set(req.body.classIds)];

    if (teacherId) {
      const teacherOk = await User.exists({ _id: teacherId, tenantId: req.user.tenantId, role: 'teacher' });
      if (!teacherOk) return res.status(404).json({ error: 'Teacher not found' });
    }

    const result = await Subject.updateMany(
      { tenantId: req.user.tenantId, name, classId: { $in: classIds } },
      { teacherId: teacherId || null }
    );

    const skipped = classIds.length - result.matchedCount;
    res.json({
      matchedCount: result.matchedCount,
      message: `Updated in ${result.matchedCount} class(es)` +
        (skipped ? `; ${skipped} class(es) skipped — ${name} isn't a subject there yet` : ''),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, validateSubject, async (req, res) => {
  try {
    // Never let the client move a record between tenants via the update body
    const { tenantId, _id, ...updates } = req.body;
    const updated = await Subject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      updates,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Subject not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const deleted = await Subject.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: 'Subject not found' });

    await Score.deleteMany({ tenantId: req.user.tenantId, subjectId: req.params.id });

    res.json({ message: 'Subject and related scores deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign (or unassign) a teacher for a subject
router.patch('/:id/assign-teacher', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const { teacherId } = req.body;

    if (teacherId && !/^[0-9a-fA-F]{24}$/.test(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { teacherId: teacherId || null },
      { new: true, runValidators: true }
    ).populate('teacherId', 'name email');

    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    res.json(subject);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;