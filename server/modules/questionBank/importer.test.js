// Run with:  npm run test:bank   (no database needed - these cover the pure import logic)
// Every question here is clearly FAKE sample data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseImportFile, planImport, contentChanged } = require('./importer');

const sample = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-sample-questions.json'), 'utf8'));
const fakeQuestion = (over = {}) => ({
  id: 'FAKE-T', topic: 'Fake topic', difficulty: 'easy', question: 'FAKE SAMPLE?',
  options: { A: 'a', B: 'b', C: 'c' }, answer: 'B', explanation: 'FAKE SAMPLE.', ...over,
});
const fileOf = (objective, over = {}) => ({ subject: 'FAKE Subject', batch: 'fake', objective, ...over });

test('a valid question is mapped: id, letters to an option list, answer letter to an index', () => {
  const parsed = parseImportFile(fileOf([fakeQuestion()]));
  assert.equal(parsed.errors.length, 0);
  const [q] = parsed.valid;
  assert.equal(q.externalId, 'FAKE-T');
  assert.deepEqual(q.options, ['a', 'b', 'c']);
  assert.equal(q.correctIndex, 1);
  assert.equal(q.subject, 'FAKE Subject');
  assert.equal(q.exams, undefined); // not given: defaults apply only when a question is new
});

test('the fake sample file: 1 valid question, 3 with problems, 2 theory questions skipped', () => {
  const parsed = parseImportFile(sample());
  assert.equal(parsed.valid.length, 1);
  assert.equal(parsed.theorySkipped, 2);
  const errors = Object.fromEntries(parsed.errors.map((e) => [e.externalId, e.messages.join(' | ')]));
  assert.match(errors['FAKE-002'], /options A and B are the same/);
  assert.match(errors['FAKE-003'], /answer "E" is not one of the options \(A, B, C\)/);
  assert.match(errors['FAKE-004'], /explanation is required/);
});

test('every problem with one question is reported together', () => {
  const parsed = parseImportFile(fileOf([fakeQuestion({ options: { A: 'x' }, exams: ['SAT'], difficulty: 'impossible', pool: 'secret', explanation: '' })]));
  assert.ok(parsed.errors[0].messages.length >= 5, parsed.errors[0].messages.join(' | '));
});

test('the same id twice in a file flags every copy', () => {
  const parsed = parseImportFile(fileOf([fakeQuestion(), fakeQuestion({ question: 'FAKE other?' }), fakeQuestion({ id: 'FAKE-U' })]));
  assert.equal(parsed.errors.filter((e) => e.externalId === 'FAKE-T').length, 2);
  assert.equal(parsed.valid.length, 1);
});

test('a file without a subject, or without an objective list, is one clear file error', () => {
  assert.equal(parseImportFile({ objective: [fakeQuestion()] }).errors.length, 1);
  assert.equal(parseImportFile({ subject: 'X', objective: 'nope' }).errors.length, 1);
  assert.equal(parseImportFile(null).errors.length, 1);
});

test('exams come from the question, else from the file-level "exam" text, else stay unset', () => {
  assert.deepEqual(parseImportFile(fileOf([fakeQuestion({ exams: ['neco'] })])).valid[0].exams, ['NECO']);
  assert.deepEqual(parseImportFile(fileOf([fakeQuestion()], { exam: 'WAEC only' })).valid[0].exams, ['WAEC']);
  assert.equal(parseImportFile(fileOf([fakeQuestion()], { exam: 'something else' })).valid[0].exams, undefined);
});

const stored = (over = {}) => ({
  _id: 1, externalId: 'FAKE-T', subject: 'FAKE Subject', topic: 'Fake topic', difficulty: 'easy', text: 'FAKE SAMPLE?',
  options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'FAKE SAMPLE.', status: 'draft', pool: 'public', exams: ['WAEC', 'NECO'], ...over,
});

test('re-import planning: new / unchanged / changed, and approved + changed needs re-approval', () => {
  const same = parseImportFile(fileOf([fakeQuestion()]));
  let plan = planImport(same, new Map());
  assert.equal(plan.toCreate.length, 1);

  plan = planImport(same, new Map([['FAKE-T', stored()]]));
  assert.deepEqual([plan.toCreate.length, plan.toUpdate.length, plan.unchanged], [0, 0, 1]);

  const changed = parseImportFile(fileOf([fakeQuestion({ question: 'FAKE CHANGED?' })]));
  plan = planImport(changed, new Map([['FAKE-T', stored({ status: 'approved' })]]));
  assert.equal(plan.toUpdate.length, 1);
  assert.deepEqual(plan.reapprovalNeeded, ['FAKE-T']);

  plan = planImport(changed, new Map([['FAKE-T', stored({ status: 'draft' })]]));
  assert.deepEqual([plan.toUpdate.length, plan.reapprovalNeeded.length], [1, 0]);
});

test('fields the file leaves out never count as a change; fields it states do', () => {
  const parsed = parseImportFile(fileOf([fakeQuestion({ difficulty: undefined })]));
  const edited = stored({ pool: 'reserved', exams: ['WAEC'], difficulty: 'hard' });
  assert.equal(contentChanged(edited, parsed.valid[0]), false);
  const explicit = parseImportFile(fileOf([fakeQuestion({ pool: 'public', difficulty: undefined })]));
  assert.equal(contentChanged(edited, explicit.valid[0]), true);
});
