// Run with:  npm run test:bank   (no database needed)
// Every question here is clearly FAKE sample data.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SIMILARITY_THRESHOLD, normaliseText, numberSignature, textSimilarity, findPossibleDuplicates,
} = require('./duplicates');

const BASE = 'FAKE SAMPLE: A train travels 120 km in 2 hours at a constant speed. Calculate its average speed in kilometres per hour for the whole journey.';
const q = (externalId, text) => ({ externalId, text });
const bank = (externalId, text, status = 'approved') => ({ externalId, text, status });
const flagged = (result, id) => result.find((r) => r.externalId === id);

test('normalising: case, spaces and prose punctuation do not matter', () => {
  assert.equal(normaliseText('  What IS   the value of x?! '), 'what is the value of x');
  assert.equal(normaliseText('A well-known "result", i.e. this;'), 'a well known result i e this');
  assert.equal(normaliseText('Find 1,000 divided by 4.'), 'find 1000 divided by 4');
});

test('normalising keeps the symbols that change a maths question', () => {
  assert.notEqual(normaliseText('What is 6 + 3?'), normaliseText('What is 6 - 3?'));
  assert.notEqual(normaliseText('Solve x = -3'), normaliseText('Solve x = 3'));
  assert.notEqual(normaliseText('Value 3.5'), normaliseText('Value 35'));
  assert.notEqual(normaliseText('Evaluate (3+4)×2'), normaliseText('Evaluate 3+(4×2)'));
  assert.equal(normaliseText('Find 1,000 ÷ 4'), normaliseText('find 1000 / 4'));
  assert.equal(numberSignature(normaliseText('A car goes 120 km in 2 hours')), '120,2');
  assert.equal(numberSignature(normaliseText('Solve x = -3.5')), '-3.5');
  assert.equal(numberSignature(normaliseText('5 - 3')), '5,3'); // a binary minus is not a sign
});

test('identical text (ignoring case, spacing and punctuation) is flagged', () => {
  const same = 'fake sample:   a TRAIN travels 120 km in 2 hours, at a constant speed -- calculate its average speed in kilometres per hour for the whole journey!';
  const result = findPossibleDuplicates({ incoming: [q('N-1', same)], existing: [bank('B-1', BASE)] });
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, 'N-1');
  assert.equal(result[0].matchesExternalId, 'B-1');
  assert.equal(result[0].similarity, 1);
  assert.equal(result[0].reason, 'identical text');
  assert.equal(result[0].matchesIn, 'bank');
  assert.equal(result[0].matchesStatus, 'approved');
  assert.equal(result[0].text, same);
  assert.equal(result[0].matchesText, BASE);
});

test('the same wording with DIFFERENT numbers is NOT a duplicate, even though the wording is almost identical', () => {
  const other = BASE.replace('120 km', '150 km').replace('2 hours', '3 hours');
  assert.ok(textSimilarity(BASE, other) >= SIMILARITY_THRESHOLD, `test needs very similar wording, got ${textSimilarity(BASE, other)}`);
  assert.deepEqual(findPossibleDuplicates({ incoming: [q('N-1', other)], existing: [bank('B-1', BASE)] }), []);
  // and a different sign or operator is a different question too
  assert.deepEqual(findPossibleDuplicates({ incoming: [q('N-2', 'FAKE: Solve the equation for x given that x = -3 in this simple case')], existing: [bank('B-2', 'FAKE: Solve the equation for x given that x = 3 in this simple case')] }), []);
});

test('near-identical wording with the SAME numbers is flagged', () => {
  const near = BASE.replace('constant', 'steady');
  const similarity = textSimilarity(BASE, near);
  assert.ok(similarity >= SIMILARITY_THRESHOLD && similarity < 1, `test needs near-identical wording, got ${similarity}`);
  const result = findPossibleDuplicates({ incoming: [q('N-1', near)], existing: [bank('B-1', BASE, 'draft')] });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, 'very similar wording and the same numbers');
  assert.equal(result[0].similarity, Math.round(similarity * 100) / 100);
  assert.equal(result[0].matchesStatus, 'draft');
});

test('clearly different questions are not flagged', () => {
  const result = findPossibleDuplicates({
    incoming: [q('N-1', 'FAKE SAMPLE: Name the process by which plants make food using sunlight.')],
    existing: [bank('B-1', BASE), bank('B-2', 'FAKE SAMPLE: Which organ pumps blood around the human body?')],
  });
  assert.deepEqual(result, []);
});

test('a duplicate INSIDE the uploaded file is flagged (the later one points at the earlier one)', () => {
  const result = findPossibleDuplicates({
    incoming: [q('F-1', BASE), q('F-2', 'FAKE SAMPLE: Name the process by which plants make food.'), q('F-3', BASE.toUpperCase())],
    existing: [],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, 'F-3');
  assert.equal(result[0].matchesExternalId, 'F-1');
  assert.equal(result[0].matchesIn, 'file');
  assert.equal(result[0].matchesStatus, undefined);
});

test('near-identical wording inside one file is flagged too', () => {
  const result = findPossibleDuplicates({ incoming: [q('F-1', BASE), q('F-2', BASE.replace('constant', 'steady'))], existing: [] });
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, 'F-2');
  assert.equal(result[0].matchesIn, 'file');
});

test('a question is never compared with itself or with the bank copy that has its own id', () => {
  const result = findPossibleDuplicates({ incoming: [q('SAME-ID', BASE)], existing: [bank('SAME-ID', BASE)] });
  assert.deepEqual(result, []);
});

test('each question reports only its single best match', () => {
  const result = findPossibleDuplicates({
    incoming: [q('N-1', BASE)],
    existing: [bank('B-1', BASE.replace('constant', 'steady')), bank('B-2', BASE), bank('B-3', BASE.replace('whole', 'entire'))],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].matchesExternalId, 'B-2'); // the identical one beats the similar ones
});

test('nothing to compare against', () => {
  assert.deepEqual(findPossibleDuplicates({ incoming: [], existing: [bank('B-1', BASE)] }), []);
  assert.deepEqual(findPossibleDuplicates({ incoming: [q('N-1', BASE)], existing: [] }), []);
  assert.deepEqual(findPossibleDuplicates({ incoming: [q('N-1', ''), q('N-2', '')], existing: [] }), []); // empty text is not a duplicate of anything
});

// ── the fast index must find exactly what comparing every pair finds ──
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
const WORDS = 'the a of in to is are find calculate area perimeter triangle circle radius speed time distance train car bus value simplify solve equation express fraction decimal percent profit loss interest ratio mean median mode angle sum product difference'.split(' ');

function randomText(rand, len) {
  const out = [];
  for (let i = 0; i < len; i++) {
    out.push(rand() < 0.12 ? String(Math.floor(rand() * 30)) : WORDS[Math.floor(rand() * WORDS.length)]);
  }
  return out.join(' ');
}
// a variant of a text: change one word, or one number, or nothing but case/punctuation
function variant(rand, text) {
  const parts = text.split(' ');
  const r = rand();
  const i = Math.floor(rand() * parts.length);
  if (r < 0.3) return text.toUpperCase() + '?';
  if (r < 0.6) parts[i] = WORDS[Math.floor(rand() * WORDS.length)];
  else if (r < 0.8) parts[i] = String(Math.floor(rand() * 30));
  else parts.splice(i, 0, WORDS[Math.floor(rand() * WORDS.length)]);
  return parts.join(' ');
}

function bruteForce(incoming, existing, threshold = SIMILARITY_THRESHOLD) {
  const out = new Map();
  const norms = new Map();
  const normOf = (text) => { if (!norms.has(text)) norms.set(text, normaliseText(text)); return norms.get(text); };
  incoming.forEach((d, j) => {
    const candidates = [...existing, ...incoming.slice(0, j)].filter((c) => c.externalId !== d.externalId);
    const nd = normOf(d.text);
    let best = 0;
    for (const c of candidates) {
      const nc = normOf(c.text);
      if (nd && nd === nc) { best = Math.max(best, 1); continue; }
      if (numberSignature(nd) !== numberSignature(nc)) continue;
      const sim = textSimilarity(d.text, c.text);
      if (sim >= threshold) best = Math.max(best, sim);
    }
    if (best > 0) out.set(d.externalId, Math.round(best * 100) / 100);
  });
  return out;
}

test('the fast index finds exactly the same duplicates as comparing every pair (random data)', () => {
  const rand = seeded(12345);
  const existing = [];
  for (let i = 0; i < 250; i++) existing.push(bank(`B-${i}`, randomText(rand, 6 + Math.floor(rand() * 12))));
  const incoming = [];
  for (let i = 0; i < 250; i++) {
    const r = rand();
    const source = r < 0.4 ? existing[Math.floor(rand() * existing.length)].text : r < 0.6 && incoming.length ? incoming[Math.floor(rand() * incoming.length)].text : randomText(rand, 6 + Math.floor(rand() * 12));
    incoming.push(q(`N-${i}`, r < 0.6 ? variant(rand, source) : source));
  }
  const fast = new Map(findPossibleDuplicates({ incoming, existing }).map((d) => [d.externalId, d.similarity]));
  const slow = bruteForce(incoming, existing);
  assert.ok(slow.size > 30, `the random data should contain plenty of duplicates (got ${slow.size})`);
  assert.deepEqual([...fast.keys()].sort(), [...slow.keys()].sort());
  for (const [id, similarity] of slow) assert.equal(fast.get(id), similarity, id);
});

test('fast enough for a few thousand questions in one subject', () => {
  const rand = seeded(987);
  const bigWords = Array.from({ length: 400 }, (_, i) => `w${i}x`);
  const text = () => Array.from({ length: 10 + Math.floor(rand() * 12) }, () => bigWords[Math.floor(rand() * bigWords.length)]).join(' ');
  const existing = Array.from({ length: 4000 }, (_, i) => bank(`B-${i}`, text()));
  const incoming = Array.from({ length: 2000 }, (_, i) => q(`N-${i}`, i % 10 === 0 ? existing[i].text : text()));
  const started = Date.now();
  const result = findPossibleDuplicates({ incoming, existing });
  const ms = Date.now() - started;
  console.log(`      (2000 questions against 4000 took ${ms} ms)`);
  assert.ok(result.length >= 200, `expected the planted duplicates to be found, got ${result.length}`);
  assert.ok(ms < 5000, `took ${ms} ms for 2000 questions against 4000`);
});
