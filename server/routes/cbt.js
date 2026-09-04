const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const CbtTest = require('../models/CbtTest');
const CbtAttempt = require('../models/CbtAttempt');
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const School = require('../models/School');
const { validateCbtTest, validateCbtSubmit, validateMongoId } = require('../middleware/validators');

// Restrict a teacher to subjects they're actually assigned to. Admins/proprietors bypass this.
async function assertCanManageSubject(req, subjectId) {
  if (req.user.role !== 'teacher') return true;
  const subject = await Subject.findOne({ _id: subjectId, tenantId: req.user.tenantId });
  return !!subject && String(subject.teacherId) === String(req.user.id);
}

// Strip answer keys before sending a test to a student — never let correctIndex leave the server.
function stripAnswerKey(test) {
  const obj = test.toObject ? test.toObject() : test;
  return {
    ...obj,
    questions: obj.questions.map(({ correctIndex, ...q }) => q),
  };
}

// ── Teacher/admin: create a test ─────────────────────────────────────────────
router.post('/tests', requireAuth, requireActiveSubscription, requireRole('proprietor', 'admin', 'teacher'), validateCbtTest, async (req, res) => {
  try {
    const canManage = await assertCanManageSubject(req, req.body.subjectId);
    if (!canManage) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject' });
    }

    // Cross-check each correctIndex actually fits within its own options array —
    // express-validator can't do this per-item cross-field check inline.
    for (const q of req.body.questions) {
      if (q.correctIndex >= q.options.length) {
        return res.status(400).json({ error: `correctIndex out of range for question: "${q.text}"` });
      }
    }

    const test = new CbtTest({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
    });
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Teacher/admin: list tests they created (or all, for admin/proprietor) ───
router.get('/tests', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.user.role === 'teacher') filter.createdBy = req.user.id;
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.includeArchived !== 'true') filter.isArchived = { $ne: true };

    const tests = await CbtTest.find(filter)
      .populate('subjectId')
      .populate('classId')
      .sort({ createdAt: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher/admin: edit a draft test (locked once published) ────────────────
router.patch('/tests/:id', requireAuth, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.status === 'published') {
      return res.status(400).json({ error: 'Cannot edit a published test. Unpublish it first.' });
    }
    if (req.user.role === 'teacher' && String(test.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You did not create this test' });
    }

    // Don't allow changing tenantId/createdBy through this route
    const { tenantId, createdBy, ...updates } = req.body;
    Object.assign(test, updates);
    await test.save();
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Teacher/admin: publish / unpublish ───────────────────────────────────────
router.patch('/tests/:id/publish', requireAuth, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (req.user.role === 'teacher' && String(test.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You did not create this test' });
    }
    test.status = test.status === 'published' ? 'draft' : 'published';
    await test.save();
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Proprietor/admin: archive a test — works even if published, so demo/old
// data can be cleaned up from view without touching its attempts or scores ──
router.patch('/tests/:id/archive', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isArchived: true },
      { new: true }
    );
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Proprietor/admin: unarchive a test ───────────────────────────────────────
router.patch('/tests/:id/unarchive', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isArchived: false },
      { new: true }
    );
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Teacher/admin: delete a draft test (never delete once published — attempts may exist) ───
router.delete('/tests/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.status === 'published') {
      return res.status(400).json({ error: 'Cannot delete a published test' });
    }
    await test.deleteOne();
    res.json({ message: 'Test deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Proprietor/admin: permanently delete an archived test (published or not) —
// removes the test and its attempts, but never touches Score records: any
// CA1/CA2 value this test already synced there stays exactly as it is ───────
router.delete('/tests/:id/permanent', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (!test.isArchived) {
      return res.status(400).json({ error: 'Archive this test before permanently deleting it' });
    }

    await CbtAttempt.deleteMany({ tenantId: req.user.tenantId, testId: test._id });
    await test.deleteOne();

    res.json({ message: 'Test and its attempts permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher/admin: results for a test ────────────────────────────────────────
router.get('/tests/:id/results', requireAuth, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });

    const attempts = await CbtAttempt.find({ tenantId: req.user.tenantId, testId: test._id })
      .populate('studentId')
      .sort({ score: -1 });

    res.json({ test, attempts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student: tests available to them (published, matching their class, no attempt yet) ───
router.get('/tests/available', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const tests = await CbtTest.find({
      tenantId: req.user.tenantId,
      classId: req.user.classId,
      status: 'published',
      isArchived: { $ne: true },
    }).populate('subjectId').sort({ createdAt: -1 });

    const attempts = await CbtAttempt.find({ tenantId: req.user.tenantId, studentId: req.user.id });
    const attemptedTestIds = new Set(attempts.map((a) => String(a.testId)));

    const available = tests
      .filter((t) => !attemptedTestIds.has(String(t._id)))
      .map(stripAnswerKey);

    res.json(available);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student: start an attempt ────────────────────────────────────────────────
router.post('/tests/:id/start', requireAuth, requireRole('student'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId, status: 'published', isArchived: { $ne: true } });
    if (!test) return res.status(404).json({ error: 'Test not found or not available' });
    if (String(test.classId) !== String(req.user.classId)) {
      return res.status(403).json({ error: 'This test is not for your class' });
    }

    const existing = await CbtAttempt.findOne({ tenantId: req.user.tenantId, testId: test._id, studentId: req.user.id });
    if (existing) {
      // Resuming an in-progress attempt is fine; a submitted one is not
      if (existing.status === 'submitted') {
        return res.status(400).json({ error: 'You have already submitted this test' });
      }
      return res.json({ attempt: existing, test: stripAnswerKey(test) });
    }

    const attempt = new CbtAttempt({
      tenantId: req.user.tenantId,
      testId: test._id,
      studentId: req.user.id,
      answers: new Array(test.questions.length).fill(-1),
      startedAt: new Date(), // server-stamped — this plus durationMinutes is the real deadline
    });
    await attempt.save();

    res.status(201).json({ attempt, test: stripAnswerKey(test) });
  } catch (err) {
    // Unique index race: two near-simultaneous starts from the same student
    if (err.code === 11000) {
      const existing = await CbtAttempt.findOne({ tenantId: req.user.tenantId, testId: req.params.id, studentId: req.user.id });
      return res.status(200).json({ attempt: existing });
    }
    res.status(400).json({ error: err.message });
  }
});

// ── Student: submit an attempt (auto-marked, synced to Score) ──────────────
router.post('/attempts/:id/submit', requireAuth, requireRole('student'), validateMongoId, validateCbtSubmit, async (req, res) => {
  try {
    const attempt = await CbtAttempt.findOne({ _id: req.params.id, tenantId: req.user.tenantId, studentId: req.user.id });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.status === 'submitted') {
      return res.status(400).json({ error: 'This attempt has already been submitted' });
    }

    const test = await CbtTest.findOne({ _id: attempt.testId, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Server-side deadline check — never trust that the client submitted on time
    const deadline = new Date(attempt.startedAt.getTime() + test.durationMinutes * 60 * 1000);
    const isLate = new Date() > deadline;

    const { answers } = req.body;
    const rawScore = test.questions.reduce((sum, q, i) => {
      return sum + (answers[i] === q.correctIndex ? q.marks : 0);
    }, 0);
    const maxScore = test.questions.reduce((sum, q) => sum + q.marks, 0);

    attempt.answers = answers;
    attempt.score = rawScore;
    attempt.maxScore = maxScore;
    attempt.submittedAt = new Date();
    attempt.autoSubmitted = isLate;
    attempt.status = 'submitted';
    await attempt.save();

    // Scale the raw score to the school's configured CA max and sync into Score.
    // Only ever touches test.caSlot ('ca1' or 'ca2') — never the other CA field or exam.
    const school = await School.findOne({ tenantId: req.user.tenantId });
    const caMax = school ? school[`${test.caSlot}Max`] : 20;
    const scaled = maxScore > 0 ? Math.round((rawScore / maxScore) * caMax * 100) / 100 : 0;

    const updatedScore = await Score.findOneAndUpdate(
      {
        tenantId: req.user.tenantId,
        studentId: req.user.id,
        subjectId: test.subjectId,
        term: test.term,
        session: test.session,
      },
      { $set: { [test.caSlot]: scaled }, $setOnInsert: { tenantId: req.user.tenantId } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ attempt, caSynced: { field: test.caSlot, value: scaled, scoreId: updatedScore._id } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Student: their own attempt history ───────────────────────────────────────
router.get('/attempts/mine', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const attempts = await CbtAttempt.find({ tenantId: req.user.tenantId, studentId: req.user.id })
      .populate({ path: 'testId', populate: { path: 'subjectId' } })
      .sort({ createdAt: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
