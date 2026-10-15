const BankQuestion = require('./models/BankQuestion');
const { validateQuestionFields } = require('./validation');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Admin (Content Studio) ────────────────────────────────────────────────────

async function listQuestions({ subject, topic, status, pool, exam, search, page = 1, limit = 25 }) {
  const filter = {};
  if (subject) filter.subject = subject;
  if (topic) filter.topic = topic;
  if (status) filter.status = status;
  if (pool) filter.pool = pool;
  if (exam) filter.exams = exam;
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ text: re }, { externalId: re }, { explanation: re }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const [questions, total] = await Promise.all([
    BankQuestion.find(filter).sort({ subject: 1, topic: 1, externalId: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    BankQuestion.countDocuments(filter),
  ]);

  return { questions, total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) };
}

// Counts by subject -> topic -> status, plus totals by pool and by status.
async function getStats() {
  const [rows, poolRows] = await Promise.all([
    BankQuestion.aggregate([{ $group: { _id: { subject: '$subject', topic: '$topic', status: '$status' }, count: { $sum: 1 } } }]),
    BankQuestion.aggregate([{ $group: { _id: { pool: '$pool', status: '$status' }, count: { $sum: 1 } } }]),
  ]);

  const blank = () => ({ draft: 0, approved: 0, rejected: 0, total: 0 });
  const subjects = new Map();
  const totals = blank();

  for (const { _id, count } of rows) {
    if (!subjects.has(_id.subject)) subjects.set(_id.subject, { subject: _id.subject, ...blank(), topics: new Map() });
    const s = subjects.get(_id.subject);
    if (!s.topics.has(_id.topic)) s.topics.set(_id.topic, { topic: _id.topic, ...blank() });
    const t = s.topics.get(_id.topic);
    for (const bucket of [s, t, totals]) {
      bucket[_id.status] += count;
      bucket.total += count;
    }
  }

  const byPool = { public: { ...blank() }, reserved: { ...blank() } };
  for (const { _id, count } of poolRows) {
    byPool[_id.pool][_id.status] += count;
    byPool[_id.pool].total += count;
  }

  return {
    totals,
    byPool,
    subjects: [...subjects.values()]
      .map((s) => ({ ...s, topics: [...s.topics.values()].sort((a, b) => a.topic.localeCompare(b.topic)) }))
      .sort((a, b) => a.subject.localeCompare(b.subject)),
  };
}

const EDITABLE = ['text', 'options', 'correctIndex', 'explanation', 'topic', 'difficulty', 'pool', 'exams'];
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Edits one question. Changing an approved question sends it back to draft: a reviewer approved the
// old wording, not the new one. Returns { question } or { error, details } (never throws for bad input).
async function editQuestion(id, changes) {
  const doc = await BankQuestion.findById(id);
  if (!doc) return { notFound: true };

  const candidate = {
    externalId: doc.externalId,
    subject: doc.subject,
    exams: doc.exams,
    topic: doc.topic,
    difficulty: doc.difficulty,
    pool: doc.pool,
    text: doc.text,
    options: doc.options,
    correctIndex: doc.correctIndex,
    explanation: doc.explanation,
  };
  let changed = false;
  for (const field of EDITABLE) {
    if (changes[field] === undefined) continue;
    const next = typeof changes[field] === 'string' ? changes[field].trim() : changes[field];
    if (!sameValue(candidate[field], next)) changed = true;
    candidate[field] = next;
  }

  const problems = validateQuestionFields(candidate);
  if (problems.length) return { invalid: problems };
  if (!changed) return { question: doc.toObject() };

  for (const field of EDITABLE) doc[field] = candidate[field];
  if (doc.status === 'approved') doc.status = 'draft';
  await doc.save();
  return { question: doc.toObject() };
}

async function reviewQuestions({ ids, status, notes, reviewer }) {
  const result = await BankQuestion.updateMany(
    { _id: { $in: ids } },
    { $set: { status, reviewedBy: String(reviewer), reviewedAt: new Date(), reviewNotes: notes || '' } }
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

// ── For SchoolManager (plain functions, no HTTP) ──────────────────────────────

// Subjects that have approved questions, with their topics and how many approved questions each has.
async function listApprovedSubjects() {
  const rows = await BankQuestion.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: { subject: '$subject', topic: '$topic' }, count: { $sum: 1 } } },
  ]);
  const subjects = new Map();
  for (const { _id, count } of rows) {
    if (!subjects.has(_id.subject)) subjects.set(_id.subject, { subject: _id.subject, total: 0, topics: [] });
    const s = subjects.get(_id.subject);
    s.total += count;
    s.topics.push({ topic: _id.topic, count });
  }
  return [...subjects.values()]
    .map((s) => ({ ...s, topics: s.topics.sort((a, b) => a.topic.localeCompare(b.topic)) }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

const PICK_FIELDS = { subject: 1, topic: 1, difficulty: 1, text: 1, options: 1, correctIndex: 1, explanation: 1 };

// Random approved questions for a school mock. Never returns draft or rejected questions.
// Prefers the `preferPool` ('reserved' by default, the ones kept for school mocks) and tops up from the
// rest. Returns up to `count` (fewer if the bank doesn't have that many).
async function pickApprovedQuestions({ subject, topics, count, difficulty, preferPool = 'reserved' }) {
  const wanted = Math.max(0, Math.min(500, Math.floor(Number(count)) || 0));
  if (!subject || wanted === 0) return [];

  const filter = { status: 'approved', subject };
  if (Array.isArray(topics) && topics.length > 0) filter.topic = { $in: topics };
  if (difficulty && difficulty !== 'mixed') filter.difficulty = difficulty;

  // choose from ids only, then load just the chosen questions
  const candidates = await BankQuestion.find(filter, { _id: 1, pool: 1 }).lean();
  const preferred = shuffle(candidates.filter((c) => c.pool === preferPool));
  const rest = shuffle(candidates.filter((c) => c.pool !== preferPool));
  const chosen = [...preferred, ...rest].slice(0, wanted).map((c) => c._id);
  if (chosen.length === 0) return [];

  const docs = await BankQuestion.find({ _id: { $in: chosen } }, PICK_FIELDS).lean();
  return shuffle(docs).map((d) => ({
    bankQuestionId: d._id,
    subject: d.subject,
    topic: d.topic,
    difficulty: d.difficulty,
    text: d.text,
    options: d.options,
    correctIndex: d.correctIndex,
    explanation: d.explanation,
  }));
}

module.exports = {
  listQuestions,
  getStats,
  editQuestion,
  reviewQuestions,
  listApprovedSubjects,
  pickApprovedQuestions,
};
