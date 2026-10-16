const BankQuestion = require('./models/BankQuestion');
const { validateQuestionFields, EXAMS, LETTERS } = require('./validation');

const MAX_QUESTIONS_PER_FILE = 10000;
const FILE_ERROR_ID = '(file)';
const REAPPROVAL_NOTE = 'Content changed by a re-import; needs re-approval';

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

// Which exams a file says its questions are for: any of WAEC / NECO named in the file-level "exam"
// text, otherwise "not given" (undefined). Defaults are applied later, only when a question is new.
function examsFromFile(examText) {
  if (typeof examText !== 'string') return undefined;
  const found = EXAMS.filter((e) => new RegExp(`\\b${e}\\b`, 'i').test(examText));
  return found.length ? found : undefined;
}

// Turns one entry of "objective" into a candidate question plus the problems found with it.
//   { id, section, topic, difficulty, question, options: {A:..}, answer: "A", explanation, pool?, exams? }
function mapQuestion(raw, file) {
  const messages = [];
  if (!raw || typeof raw !== 'object') return { candidate: null, messages: ['question is not an object'] };

  const externalId = str(raw.id);

  // options: { A: "...", B: "..." } -> array in letter order, remembering which letter is where
  let options;
  let letters = [];
  if (raw.options && typeof raw.options === 'object' && !Array.isArray(raw.options)) {
    const entries = Object.entries(raw.options).map(([key, value]) => [str(key).toUpperCase(), value]);
    const badKey = entries.find(([key]) => !LETTERS.includes(key));
    if (badKey) messages.push(`option "${badKey[0]}" is not a letter from A to F`);
    const seen = new Set();
    entries.forEach(([key]) => {
      if (seen.has(key)) messages.push(`option ${key} appears twice`);
      seen.add(key);
    });
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    letters = entries.map(([key]) => key);
    options = entries.map(([, value]) => (typeof value === 'string' ? value.trim() : ''));
  } else {
    messages.push('options must be an object like { "A": "...", "B": "..." }');
  }

  // answer: "A" -> index of that option
  let correctIndex;
  const answer = str(raw.answer).toUpperCase();
  if (!answer) {
    messages.push('answer is required (a letter such as "A")');
  } else if (options) {
    correctIndex = letters.indexOf(answer);
    if (correctIndex === -1) {
      correctIndex = undefined;
      messages.push(`answer "${answer}" is not one of the options (${letters.join(', ') || 'none'})`);
    }
  }

  let exams = file.exams;
  if (raw.exams !== undefined) {
    exams = Array.isArray(raw.exams) ? raw.exams.map((e) => str(e).toUpperCase()) : [];
  }

  const candidate = {
    externalId,
    exams,
    subject: str(raw.subject) || file.subject,
    section: raw.section === undefined ? undefined : str(raw.section),
    topic: str(raw.topic),
    difficulty: raw.difficulty === undefined || raw.difficulty === '' ? undefined : str(raw.difficulty).toLowerCase(),
    text: str(raw.question),
    options,
    correctIndex,
    explanation: str(raw.explanation),
    pool: raw.pool === undefined || raw.pool === '' ? undefined : str(raw.pool).toLowerCase(),
  };

  const problems = validateQuestionFields(candidate);
  // the answer problem is already described (with the letters) above - don't say it twice
  const answerAlreadyReported = messages.some((m) => m.startsWith('answer'));
  messages.push(...problems.filter((m) => !(answerAlreadyReported && m.startsWith('the correct answer'))));

  return { candidate, messages };
}

// Reads a whole import file into valid questions and per-question errors. No database involved.
function parseImportFile(payload) {
  const result = { subject: '', batch: '', valid: [], errors: [], theorySkipped: 0, total: 0 };
  const fileError = (message) => {
    result.errors.push({ externalId: FILE_ERROR_ID, messages: [message] });
    return result;
  };

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fileError('The file must be a JSON object with "subject" and "objective".');
  }
  result.subject = str(payload.subject);
  result.batch = str(payload.batch);
  if (!result.subject) return fileError('The file needs a "subject", e.g. "General Mathematics".');
  if (!Array.isArray(payload.objective)) return fileError('The file needs an "objective" list of questions.');
  if (payload.objective.length > MAX_QUESTIONS_PER_FILE) {
    return fileError(`Too many questions in one file (${payload.objective.length}). Split it into files of ${MAX_QUESTIONS_PER_FILE} or fewer.`);
  }
  if (Array.isArray(payload.theory)) result.theorySkipped = payload.theory.length;

  const file = { subject: result.subject, exams: examsFromFile(payload.exam) };
  result.total = payload.objective.length;

  const mapped = payload.objective.map((raw, i) => ({ index: i, ...mapQuestion(raw, file) }));

  // the same id twice in one file is ambiguous: flag every copy so the author picks the right one
  const idCounts = new Map();
  mapped.forEach(({ candidate }) => {
    if (candidate && candidate.externalId) idCounts.set(candidate.externalId, (idCounts.get(candidate.externalId) || 0) + 1);
  });

  mapped.forEach(({ index, candidate, messages }) => {
    const all = [...messages];
    if (candidate && idCounts.get(candidate.externalId) > 1) all.push(`id "${candidate.externalId}" appears ${idCounts.get(candidate.externalId)} times in this file`);
    if (all.length > 0) {
      result.errors.push({ externalId: (candidate && candidate.externalId) || `(question ${index + 1} in the file)`, messages: all });
    } else {
      result.valid.push(candidate);
    }
  });

  return result;
}

const sameArray = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

// Has anything a student or reviewer would notice changed? Fields the file leaves out (exams,
// difficulty, pool, section) are "keep what is there", so they never count as a change.
function contentChanged(existing, q) {
  if (existing.subject !== q.subject || existing.topic !== q.topic) return true;
  if (existing.text !== q.text || existing.explanation !== q.explanation) return true;
  if (existing.correctIndex !== q.correctIndex || !sameArray(existing.options, q.options)) return true;
  if (q.section !== undefined && (existing.section || '') !== q.section) return true;
  if (q.difficulty !== undefined && existing.difficulty !== q.difficulty) return true;
  if (q.pool !== undefined && existing.pool !== q.pool) return true;
  if (q.exams !== undefined && !sameSet(existing.exams || [], q.exams)) return true;
  return false;
}

// Decides what an import would do, given the questions already in the bank. No writes.
function planImport(parsed, existingByExternalId) {
  const toCreate = [];
  const toUpdate = [];
  const reapprovalNeeded = [];
  let unchanged = 0;

  for (const q of parsed.valid) {
    const existing = existingByExternalId.get(q.externalId);
    if (!existing) {
      toCreate.push(q);
    } else if (!contentChanged(existing, q)) {
      unchanged += 1;
    } else {
      const resetsApproval = existing.status === 'approved';
      toUpdate.push({ question: q, existing, resetsApproval });
      if (resetsApproval) reapprovalNeeded.push(q.externalId);
    }
  }
  return { toCreate, toUpdate, unchanged, reapprovalNeeded };
}

function buildReport(parsed, plan, dryRun) {
  return {
    dryRun,
    subject: parsed.subject,
    batch: parsed.batch,
    total: parsed.total,
    toCreate: plan.toCreate.length,
    toUpdate: plan.toUpdate.length,
    unchanged: plan.unchanged,
    reapprovalNeeded: plan.reapprovalNeeded,
    errors: parsed.errors,
    theorySkipped: parsed.theorySkipped,
  };
}

function updateFields(q, batch, resetsApproval) {
  const set = {
    subject: q.subject,
    topic: q.topic,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    batch,
  };
  if (q.section !== undefined) set.section = q.section;
  if (q.difficulty !== undefined) set.difficulty = q.difficulty;
  if (q.pool !== undefined) set.pool = q.pool;
  if (q.exams !== undefined) set.exams = q.exams;
  if (resetsApproval) {
    set.status = 'draft';
    set.reviewNotes = REAPPROVAL_NOTE;
  }
  return set;
}

// The one importer used by both the API and the CLI.
//   payload: the parsed JSON file. dryRun: true reports without saving. actor: who is importing.
// Valid questions are imported; invalid ones are skipped and listed in `errors`, so one typo never
// blocks a whole file, and fixing the file and importing again only touches what changed.
async function importQuestionBank({ payload, dryRun = true, actor = 'unknown' }) {
  const parsed = parseImportFile(payload);

  const ids = parsed.valid.map((q) => q.externalId);
  const existingDocs = ids.length ? await BankQuestion.find({ externalId: { $in: ids } }).lean() : [];
  const plan = planImport(parsed, new Map(existingDocs.map((d) => [d.externalId, d])));

  if (!dryRun && (plan.toCreate.length || plan.toUpdate.length)) {
    const ops = [
      ...plan.toCreate.map((q) => ({
        insertOne: {
          document: {
            externalId: q.externalId,
            exams: q.exams || [...EXAMS],
            subject: q.subject,
            section: q.section,
            topic: q.topic,
            difficulty: q.difficulty || 'medium',
            text: q.text,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            pool: q.pool || 'public',
            status: 'draft',
            batch: parsed.batch,
            createdBy: String(actor),
          },
        },
      })),
      ...plan.toUpdate.map(({ question, existing, resetsApproval }) => ({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: updateFields(question, parsed.batch, resetsApproval) },
        },
      })),
    ];
    await BankQuestion.bulkWrite(ops, { ordered: false });
  }

  return buildReport(parsed, plan, dryRun);
}

module.exports = {
  importQuestionBank,
  parseImportFile,
  planImport,
  contentChanged,
  MAX_QUESTIONS_PER_FILE,
};
