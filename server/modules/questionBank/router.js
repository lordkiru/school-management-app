const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { requireBankManager } = require('./permissions');
const { importQuestionBank } = require('./importer');
const { listQuestions, getStats, editQuestion, reviewQuestions } = require('./service');
const { EXAMS, DIFFICULTIES, POOLS } = require('./validation');
const { STATUSES } = require('./models/BankQuestion');

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_IDS = 500;

// Same error shape as the rest of the server's validators, kept local so this module doesn't depend on
// SchoolManager's validators file (which also holds school-specific rules).
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  next();
}

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const optionalText = (name) => query(name).optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 });

// `requireRole` is accepted so the module's signature stays stable, but permission is decided in one
// place (permissions.js -> canManageBank) so a reviewer role can be added later without touching routes.
function createQuestionBankRouter({ requireAuth, requireRole }) {
  const router = express.Router();
  router.use(requireAuth, requireBankManager);

  router.post(
    '/import',
    [
      query('dryRun').optional().isIn(['true', 'false']).withMessage('dryRun must be true or false'),
      body().isObject().withMessage('The body must be the JSON file contents'),
      handleValidationErrors,
    ],
    wrap(async (req, res) => {
      if (Number(req.headers['content-length'] || 0) > MAX_IMPORT_BYTES) {
        return res.status(413).json({ error: 'That file is larger than 5 MB. Split it into smaller files.' });
      }
      // anything other than an explicit dryRun=false is a dry run, so a typo can never write by accident
      const dryRun = req.query.dryRun !== 'false';
      const report = await importQuestionBank({ payload: req.body, dryRun, actor: req.user.email || req.user.id });
      res.json(report);
    })
  );

  router.get(
    '/questions',
    [
      optionalText('subject'),
      optionalText('topic'),
      optionalText('search'),
      query('status').optional({ values: 'falsy' }).isIn(STATUSES),
      query('pool').optional({ values: 'falsy' }).isIn(POOLS),
      query('exam').optional({ values: 'falsy' }).isIn(EXAMS),
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      handleValidationErrors,
    ],
    wrap(async (req, res) => {
      res.json(await listQuestions(req.query));
    })
  );

  router.get('/stats', wrap(async (req, res) => {
    res.json(await getStats());
  }));

  router.patch(
    '/questions/:id',
    [
      param('id').isMongoId().withMessage('Invalid question id'),
      body('text').optional().isString().trim().notEmpty().withMessage('text cannot be empty'),
      body('options').optional().isArray({ min: 2, max: 6 }).withMessage('options must be a list of 2 to 6 answers'),
      body('options.*').optional().isString().withMessage('each option must be text'),
      body('correctIndex').optional().isInt({ min: 0, max: 5 }).toInt(),
      body('explanation').optional().isString().trim().notEmpty().withMessage('explanation cannot be empty'),
      body('topic').optional().isString().trim().notEmpty().withMessage('topic cannot be empty'),
      body('difficulty').optional().isIn(DIFFICULTIES),
      body('pool').optional().isIn(POOLS),
      body('exams').optional().isArray({ min: 1 }).withMessage('exams needs at least one'),
      body('exams.*').optional().isIn(EXAMS),
      handleValidationErrors,
    ],
    wrap(async (req, res) => {
      const result = await editQuestion(req.params.id, req.body);
      if (result.notFound) return res.status(404).json({ error: 'Question not found' });
      if (result.invalid) return res.status(400).json({ error: result.invalid.join('; '), details: result.invalid });
      res.json(result.question);
    })
  );

  router.post(
    '/review',
    [
      body('ids').isArray({ min: 1, max: MAX_REVIEW_IDS }).withMessage(`ids must be a list of 1 to ${MAX_REVIEW_IDS} questions`),
      body('ids.*').isMongoId().withMessage('Invalid question id'),
      body('status').isIn(['approved', 'rejected']).withMessage('status must be approved or rejected'),
      body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }).withMessage('notes must be 1000 characters or fewer'),
      handleValidationErrors,
    ],
    wrap(async (req, res) => {
      const { ids, status, notes } = req.body;
      res.json(await reviewQuestions({ ids, status, notes, reviewer: req.user.email || req.user.id }));
    })
  );

  return router;
}

module.exports = { createQuestionBankRouter };
