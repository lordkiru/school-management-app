// Plain, database-free checks for a bank question, so the importer, the edit route and the tests all
// judge a question the same way. Every problem is collected (not just the first) so the person
// fixing a file sees everything wrong with a question in one go.
const EXAMS = ['WAEC', 'NECO'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const POOLS = ['public', 'reserved'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const isText = (value) => typeof value === 'string' && value.trim().length > 0;

// `q` is a candidate question: externalId, subject, topic, text, options[], correctIndex,
// explanation are required. exams, difficulty and pool may be undefined ("not given": defaults
// apply on create, existing values are kept on update), but if given they must be valid.
function validateQuestionFields(q) {
  const messages = [];

  if (!isText(q.externalId)) messages.push('id is required');
  else if (q.externalId.trim().length > 60) messages.push('id is too long (60 characters at most)');

  if (!isText(q.subject)) messages.push('subject is required');
  if (!isText(q.topic)) messages.push('topic is required');
  if (!isText(q.text)) messages.push('question text is required');
  if (!isText(q.explanation)) messages.push('explanation is required');

  if (q.exams !== undefined) {
    if (!Array.isArray(q.exams) || q.exams.length === 0) {
      messages.push(`exams must include at least one of ${EXAMS.join(', ')}`);
    } else if (q.exams.some((e) => !EXAMS.includes(e))) {
      messages.push(`exams can only be ${EXAMS.join(' or ')}`);
    }
  }
  if (q.difficulty !== undefined && !DIFFICULTIES.includes(q.difficulty)) {
    messages.push(`difficulty must be ${DIFFICULTIES.join(', ')}`);
  }
  if (q.pool !== undefined && !POOLS.includes(q.pool)) {
    messages.push(`pool must be ${POOLS.join(' or ')}`);
  }

  if (!Array.isArray(q.options)) {
    messages.push('options are required');
  } else {
    if (q.options.length < 2 || q.options.length > 6) {
      messages.push(`needs 2 to 6 options (has ${q.options.length})`);
    }
    const cleaned = q.options.map((o) => (typeof o === 'string' ? o.trim() : ''));
    cleaned.forEach((o, i) => {
      if (!o) messages.push(`option ${LETTERS[i] || i + 1} is empty`);
    });
    const firstSeen = new Map();
    cleaned.forEach((o, i) => {
      if (!o) return;
      const key = o.toLowerCase();
      if (firstSeen.has(key)) {
        messages.push(`options ${LETTERS[firstSeen.get(key)]} and ${LETTERS[i]} are the same ("${o}")`);
      } else {
        firstSeen.set(key, i);
      }
    });
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      messages.push('the correct answer must be one of the options');
    }
  }

  return messages;
}

module.exports = { validateQuestionFields, EXAMS, DIFFICULTIES, POOLS, LETTERS };
