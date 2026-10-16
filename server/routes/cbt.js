const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const checkSubscriptionAccess = require('../middleware/checkSubscriptionAccess');
const CbtTest = require('../models/CbtTest');
const CbtAttempt = require('../models/CbtAttempt');
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const School = require('../models/School');
const { validateCbtTest, validateBankPick, validateCbtSubmit, validateMongoId } = require('../middleware/validators');
const { bankPickLimiter } = require('../middleware/rateLimiter');
const { listApprovedSubjects, pickApprovedQuestions } = require('../modules/questionBank');

// CBT is a plan feature, not just an active/inactive gate. Two levels (see utils/cbtAccess.js):
//   full CBT      - the plan includes it, or the school is trialing (trialing always passes, per
//                   checkSubscriptionAccess): CA tests, mock exams and practice tests
//   mock/practice - full CBT, or a plan without CBT that has an active CBT add-on: mock exams and
//                   practice tests only. The add-on must never let a school make or publish a CA test.
const canUseFullCbt = (req) => !!(req.planAccess.unlimited || (req.planAccess.limits && req.planAccess.limits.features.cbt));
const canUseMockPractice = (req) => canUseFullCbt(req) || !!req.planAccess.cbtAddonActive;
const isMockOrPractice = (testType) => testType === 'mock' || testType === 'practice';

function denyNoCbt(req, res) {
  res.status(403).json({
    error: `Computer-based testing is not available on your current plan (${req.planAccess.plan}). Upgrade to access CBT.`,
    code: 'CBT_NOT_AVAILABLE',
  });
  return false;
}

// Is this kind of test allowed for the school? Sends the 403 itself and returns false when not.
// A missing testType is a CA test.
function assertTestTypeAvailable(req, res, testType) {
  if (isMockOrPractice(testType)) return canUseMockPractice(req) || denyNoCbt(req, res);
  if (canUseFullCbt(req)) return true;
  if (canUseMockPractice(req)) {
    res.status(403).json({
      error: 'CA tests need the Growth plan. Mock exams and practice tests are available on your CBT add-on.',
      code: 'CBT_CA_NOT_AVAILABLE',
    });
    return false;
  }
  return denyNoCbt(req, res);
}

// Restrict a teacher to subjects they're actually assigned to. Admins/proprietors bypass this.
async function assertCanManageSubject(req, subjectId) {
  if (req.user.role !== 'teacher') return true;
  const subject = await Subject.findOne({ _id: subjectId, tenantId: req.user.tenantId });
  return !!subject && String(subject.teacherId) === String(req.user.id);
}

// Reorder a test's questions to match a saved questionOrder (an attempt's shuffled
// question _ids), falling back to the test's own order when there's nothing to reorder by.
function orderQuestions(questions, questionOrder) {
  if (!questionOrder || questionOrder.length === 0) return questions;
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  return questionOrder.map((id) => byId.get(String(id))).filter(Boolean);
}

// Fisher-Yates shuffle — returns a new array, doesn't mutate the input.
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// What a student may see of a question while taking a test. An allowlist, not a list of things to hide:
// the answer key (correctIndex), the explanation and the question bank link must never reach a student
// before they submit, and a field added to the question schema later (as explanation once was) stays
// private until someone decides to add it here.
const STUDENT_QUESTION_FIELDS = ['_id', 'text', 'options', 'marks'];
const forStudent = (q) => Object.fromEntries(STUDENT_QUESTION_FIELDS.filter((k) => q[k] !== undefined).map((k) => [k, q[k]]));

// Prepare a test for a student: questions reduced to the allowlist above.
// questionOrder (an attempt's shuffled order, if any) determines the order questions are sent in.
function stripAnswerKey(test, questionOrder) {
  const obj = test.toObject ? test.toObject() : test;
  const questions = orderQuestions(obj.questions, questionOrder);
  return {
    ...obj,
    questions: questions.map(forStudent),
  };
}

// ── Teacher/admin: create a test ─────────────────────────────────────────────
router.post('/tests', requireAuth, requireActiveSubscription, checkSubscriptionAccess, requireRole('proprietor', 'admin', 'teacher'), validateCbtTest, async (req, res) => {
  try {
    if (!assertTestTypeAvailable(req, res, req.body.testType || 'ca')) return;

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

    // No testType means a CA test, exactly as before. Mock and practice tests never feed a CA
    // slot, so any caSlot sent with one is dropped rather than saved.
    const { caSlot, testType, ...fields } = req.body;
    const type = testType || 'ca';

    const test = new CbtTest({
      ...fields,
      testType: type,
      ...(type === 'ca' ? { caSlot } : {}),
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
    });
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Teacher/admin: approved subjects and topics in the Lemida question bank (mock/practice access only) ──
router.get('/bank/subjects', requireAuth, requireActiveSubscription, checkSubscriptionAccess, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    if (!canUseMockPractice(req)) return denyNoCbt(req, res);
    res.json(await listApprovedSubjects());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher/admin: pull random approved questions from the bank into a mock/practice test ──
// Questions kept for school mocks ('reserved') are used first, topped up from the public pool. The
// teacher gets the questions back and they are copied into the test when it is saved.
router.post('/bank/pick', requireAuth, bankPickLimiter, requireActiveSubscription, checkSubscriptionAccess, requireRole('proprietor', 'admin', 'teacher'), validateBankPick, async (req, res) => {
  try {
    if (!canUseMockPractice(req)) return denyNoCbt(req, res);

    const { subject, topics, count, difficulty } = req.body;
    const questions = await pickApprovedQuestions({ subject, topics, count, difficulty: difficulty || 'mixed', preferPool: 'reserved' });
    res.json({ questions, requested: count, returned: questions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (test.testType === 'mock' || test.testType === 'practice') test.caSlot = undefined;
    await test.save();
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Teacher/admin: publish / unpublish ───────────────────────────────────────
router.patch('/tests/:id/publish', requireAuth, requireActiveSubscription, checkSubscriptionAccess, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Only gate the draft->published transition — always allow unpublishing,
    // even if the tenant's plan no longer includes CBT (e.g. after a downgrade).
    // The rule that applies depends on the kind of test being published.
    if (test.status !== 'published' && !assertTestTypeAvailable(req, res, test.testType)) return;

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
      .map((t) => stripAnswerKey(t)); // arrow wrapper: a bare .map(stripAnswerKey) would pass the array index as questionOrder

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
      return res.json({ attempt: existing, test: stripAnswerKey(test, existing.questionOrder) });
    }

    // Generate this student's own question order once, at start — it then stays fixed
    // for the lifetime of the attempt (including on resume, via existing.questionOrder above).
    const questionOrder = test.shuffleQuestions ? shuffle(test.questions.map((q) => q._id)) : [];

    const attempt = new CbtAttempt({
      tenantId: req.user.tenantId,
      testId: test._id,
      studentId: req.user.id,
      answers: new Array(test.questions.length).fill(-1),
      questionOrder,
      startedAt: new Date(), // server-stamped — this plus durationMinutes is the real deadline
    });
    await attempt.save();

    res.status(201).json({ attempt, test: stripAnswerKey(test, questionOrder) });
  } catch (err) {
    // Unique index race: two near-simultaneous starts from the same student
    if (err.code === 11000) {
      const existing = await CbtAttempt.findOne({ tenantId: req.user.tenantId, testId: req.params.id, studentId: req.user.id });
      const test = await CbtTest.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
      return res.status(200).json({ attempt: existing, test: stripAnswerKey(test, existing.questionOrder) });
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
    // Grade against the same order the student was shown (attempt.questionOrder when shuffled).
    const orderedQuestions = orderQuestions(test.questions, attempt.questionOrder);
    const rawScore = orderedQuestions.reduce((sum, q, i) => {
      return sum + (answers[i] === q.correctIndex ? q.marks : 0);
    }, 0);
    const maxScore = orderedQuestions.reduce((sum, q) => sum + q.marks, 0);

    attempt.answers = answers;
    attempt.score = rawScore;
    attempt.maxScore = maxScore;
    attempt.submittedAt = new Date();
    attempt.autoSubmitted = isLate;
    attempt.status = 'submitted';
    await attempt.save();

    // Mock exams and practice tests are never counted in CA or the report card: return before
    // anything below can read or write Score.
    if (test.testType === 'mock' || test.testType === 'practice') {
      return res.json({ attempt, caSynced: null });
    }

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
// Returns only what the history screen shows. It must never carry question content: a student with an
// attempt in progress could otherwise read the answer key from here while the timer is running. So the
// tests are loaded with a projection that only counts the questions, and the response is built by hand.
router.get('/attempts/mine', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const attempts = await CbtAttempt.find({ tenantId: req.user.tenantId, studentId: req.user.id })
      .select('testId status score maxScore startedAt submittedAt autoSubmitted')
      .sort({ createdAt: -1 })
      .lean();

    const uniqueTestIds = [...new Map(attempts.map((a) => [String(a.testId), a.testId])).values()];
    const tests = uniqueTestIds.length === 0
      ? []
      : await CbtTest.aggregate([
          { $match: { _id: { $in: uniqueTestIds }, tenantId: req.user.tenantId } },
          {
            $project: {
              title: 1, testType: 1, term: 1, session: 1, durationMinutes: 1, subjectId: 1,
              questionCount: { $size: { $ifNull: ['$questions', []] } },
            },
          },
        ]);
    const testById = new Map(tests.map((t) => [String(t._id), t]));

    const subjectIds = [...new Map(tests.filter((t) => t.subjectId).map((t) => [String(t.subjectId), t.subjectId])).values()];
    const subjects = subjectIds.length === 0
      ? []
      : await Subject.find({ _id: { $in: subjectIds }, tenantId: req.user.tenantId }).select('name').lean();
    const subjectById = new Map(subjects.map((s) => [String(s._id), s]));

    res.json(attempts.map((a) => {
      const t = testById.get(String(a.testId));
      const subject = t && subjectById.get(String(t.subjectId));
      return {
        _id: a._id,
        status: a.status,
        score: a.score,
        maxScore: a.maxScore,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        autoSubmitted: a.autoSubmitted,
        // same key the history screen already reads (attempt.testId.title ...)
        testId: t
          ? {
              _id: t._id,
              title: t.title,
              testType: t.testType || 'ca', // tests saved before test types existed are CA tests
              term: t.term,
              session: t.session,
              durationMinutes: t.durationMinutes,
              questionCount: t.questionCount,
              subjectId: subject ? { _id: subject._id, name: subject.name } : null,
            }
          : null,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student: review a finished mock exam or practice test (their answers, the right answers and the
// explanations). Only once the attempt is submitted, and only for mock/practice tests: CA tests count on
// the report card and never get a review. Someone else's attempt looks the same as one that doesn't exist.
router.get('/attempts/:id/review', requireAuth, requireRole('student'), validateMongoId, async (req, res) => {
  try {
    const attempt = await CbtAttempt.findOne({ _id: req.params.id, tenantId: req.user.tenantId, studentId: req.user.id }).lean();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    if (attempt.status !== 'submitted') {
      return res.status(403).json({ error: 'You can review a test after you have submitted it.', code: 'REVIEW_NOT_AVAILABLE' });
    }

    const test = await CbtTest.findOne({ _id: attempt.testId, tenantId: req.user.tenantId });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (!isMockOrPractice(test.testType)) {
      return res.status(403).json({ error: 'Answers are not shown for tests that count towards your CA.', code: 'REVIEW_NOT_AVAILABLE' });
    }

    // in the order this student saw the questions (attempt.questionOrder when the test was shuffled)
    const questions = orderQuestions(test.questions, attempt.questionOrder).map((q, i) => {
      const given = attempt.answers[i];
      const answered = Number.isInteger(given) && given >= 0 && given < q.options.length;
      return {
        _id: q._id,
        text: q.text,
        options: q.options,
        marks: q.marks,
        topic: q.topic || null,
        yourAnswerIndex: answered ? given : null,
        correctIndex: q.correctIndex,
        correct: answered && given === q.correctIndex,
        explanation: q.explanation || null,
      };
    });

    res.json({
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        submittedAt: attempt.submittedAt,
        autoSubmitted: attempt.autoSubmitted,
      },
      test: { _id: test._id, title: test.title, testType: test.testType, term: test.term, session: test.session },
      questions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tally one answered question into a topic map. Topics are grouped ignoring case ("Bearings" and
// "bearings" are the same topic); label is the spelling to show for the group.
function tallyTopic(map, label, isCorrect) {
  const key = label.toLowerCase();
  const entry = map.get(key) || { topic: label, correct: 0, total: 0 };
  entry.total += 1;
  if (isCorrect) entry.correct += 1;
  map.set(key, entry);
}

const percentOf = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : 0);

// ── Teacher/admin: mock & practice results for one subject. Read-only: this route never reads or
// writes Score — mock/practice results exist only here, never in CA or the report card. ──────────
router.get('/mock-results', requireAuth, requireActiveSubscription, checkSubscriptionAccess, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    // Past results stay visible after the add-on ends: a school with no current access but with
    // mock/practice tests on record gets them back read-only. No access and none on record = no CBT.
    let readOnly = false;
    if (!canUseMockPractice(req)) {
      const hasPastMocks = await CbtTest.exists({ tenantId: req.user.tenantId, testType: { $in: ['mock', 'practice'] } });
      if (!hasPastMocks) return denyNoCbt(req, res);
      readOnly = true;
    }

    const { subjectId, session, term, testType } = req.query;

    if (typeof subjectId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(subjectId)) {
      return res.status(400).json({ error: 'A valid subjectId is required' });
    }
    if (typeof session !== 'string' || !session.trim()) {
      return res.status(400).json({ error: 'session is required' });
    }
    if (term && !['First Term', 'Second Term', 'Third Term'].includes(term)) {
      return res.status(400).json({ error: 'Invalid term' });
    }
    if (testType && !['mock', 'practice'].includes(testType)) {
      return res.status(400).json({ error: 'testType must be mock or practice' });
    }

    const subject = await Subject.findOne({ _id: subjectId, tenantId: req.user.tenantId });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    if (!(await assertCanManageSubject(req, subjectId))) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject' });
    }

    const testFilter = {
      tenantId: req.user.tenantId,
      subjectId: subject._id,
      classId: subject.classId,
      session: session.trim(),
      testType: testType || { $in: ['mock', 'practice'] },
      isArchived: { $ne: true },
    };
    if (term) testFilter.term = term;

    const tests = await CbtTest.find(testFilter).sort({ createdAt: 1 });
    const testById = new Map(tests.map((t) => [String(t._id), t]));

    const attempts = tests.length === 0
      ? []
      : await CbtAttempt.find({
          tenantId: req.user.tenantId,
          testId: { $in: tests.map((t) => t._id) },
          status: 'submitted',
        }).populate('studentId', 'name admissionNumber');

    const byStudent = new Map();
    const classTopics = new Map();

    // One spelling per topic, taken from the tests' own question order (oldest test first) so the
    // label never depends on which student's attempt happens to be read first.
    const topicLabels = new Map();
    for (const t of tests) {
      for (const q of t.questions) {
        if (q.topic && !topicLabels.has(q.topic.toLowerCase())) topicLabels.set(q.topic.toLowerCase(), q.topic);
      }
    }

    for (const attempt of attempts) {
      const student = attempt.studentId;
      const test = testById.get(String(attempt.testId));
      if (!student || !test) continue;

      const key = String(student._id);
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          studentId: student._id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          scores: {},
          topics: new Map(),
        });
      }
      const entry = byStudent.get(key);
      entry.scores[String(test._id)] = percentOf(attempt.score, attempt.maxScore);

      // Grade topics against the order this student actually saw, same as submit does
      orderQuestions(test.questions, attempt.questionOrder).forEach((q, i) => {
        if (!q.topic) return;
        const isCorrect = attempt.answers[i] === q.correctIndex;
        const label = topicLabels.get(q.topic.toLowerCase());
        tallyTopic(entry.topics, label, isCorrect);
        tallyTopic(classTopics, label, isCorrect);
      });
    }

    const byWeakest = (a, b) => a.pct - b.pct || a.topic.localeCompare(b.topic);

    const students = [...byStudent.values()]
      .map(({ topics, ...s }) => {
        const ranked = [...topics.values()]
          .map((t) => ({ topic: t.topic, pct: percentOf(t.correct, t.total) }))
          .sort(byWeakest);
        // null when every topic was fully right (or there are no topics at all)
        const weakest = ranked[0] && ranked[0].pct < 100 ? ranked[0].topic : null;
        return { ...s, weakestTopic: weakest };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const topics = [...classTopics.values()]
      .map((t) => ({ ...t, pct: percentOf(t.correct, t.total) }))
      .sort(byWeakest);

    res.json({
      readOnly,
      subject: { _id: subject._id, name: subject.name },
      tests: tests.map((t) => ({
        _id: t._id,
        title: t.title,
        testType: t.testType,
        term: t.term,
        createdAt: t.createdAt,
        questionCount: t.questions.length,
      })),
      students,
      topics,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
