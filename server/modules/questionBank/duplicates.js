// Possible-duplicate detection for question imports. Pure functions, no database.
//
// Two questions are "possible duplicates" when, after normalising the question text,
//   - the text is identical, OR
//   - the wording is very similar (Dice similarity of character trigrams >= 0.9) AND the numbers in the
//     question are the same (so "...120 km in 2 hours" and "...150 km in 3 hours" are NOT duplicates).
// Only the first match matters to the person reviewing, so each incoming question reports its single best match.

const SIMILARITY_THRESHOLD = 0.9;

// Lower-case, strip prose punctuation, collapse spaces. Symbols that change a maths question's meaning are
// kept (+ - * / = < > ^ % and brackets, a minus sign in front of a number, the decimal point inside a number),
// otherwise "6 + 3" and "6 - 3", "x = -3" and "x = 3", or "3.5" and "35" would look identical.
function normaliseText(input) {
  let s = String(input == null ? '' : input).normalize('NFKC').toLowerCase();
  s = s.replace(/—|-{2,}/g, ' '); // an em dash or a run of hyphens is a prose dash, not a minus
  s = s.replace(/[−–]/g, '-'); // proper minus sign and en dash (often used as a minus)
  s = s.replace(/×/g, '*').replace(/÷/g, '/'); // multiplication and division signs
  s = s.replace(/(?<=\d),(?=\d{3}(?!\d))/g, ''); // 1,000 -> 1000
  s = s.replace(/[^\p{L}\p{N}\s+\-*/=<>^%.()]/gu, ' '); // everything else is prose punctuation
  s = s.replace(/\.(?!\d)/g, ' '); // a full stop is punctuation unless a digit follows (3.5, .5)
  s = s.replace(/(?<=\p{L})-(?=\p{L})/gu, ' '); // well-known -> well known
  s = s.replace(/(^|[\s+*/=<>^(])-(?=\d)/g, '$1\u0001'); // remember a minus that belongs to a number
  s = s.replace(/-/g, ' - ');
  s = s.replace(/\u0001/g, '-');
  s = s.replace(/[+*/=<>^%()]/g, (m) => ` ${m} `);
  return s.replace(/\s+/g, ' ').trim();
}

// Numbers in order of appearance, with a sign when they have one: "120 km in 2 hours" -> "120,2".
const numberSignature = (normalised) => (normalised.match(/-?\d+(?:\.\d+)?/g) || []).join(',');

function trigramsOf(normalised) {
  const padded = ` ${normalised} `;
  const grams = new Set();
  for (let i = 0; i + 3 <= padded.length; i++) grams.add(padded.slice(i, i + 3));
  return [...grams];
}

// Dice similarity of two raw texts, 0..1 (exposed for tests and tuning).
function textSimilarity(textA, textB) {
  const a = trigramsOf(normaliseText(textA));
  const b = new Set(trigramsOf(normaliseText(textB)));
  if (a.length === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared += 1;
  return (2 * shared) / (a.length + b.size);
}

// Number of values two ascending integer arrays have in common, or -1 as soon as it is certain the count
// cannot reach `needed`. Almost every candidate is a near miss, and those give up after a few dozen steps.
function overlapAtLeast(a, b, needed) {
  let i = 0;
  let j = 0;
  let n = 0;
  while (i < a.length && j < b.length) {
    if (n + Math.min(a.length - i, b.length - j) < needed) return -1;
    if (a[i] === b[j]) { n += 1; i += 1; j += 1; } else if (a[i] < b[j]) i += 1; else j += 1;
  }
  return n >= needed ? n : -1;
}

// Prefix filtering: if two sets of sizes a and b have Dice >= t, they share at least ceil(t*a/(2-t)) elements,
// so (with every set ordered rarest-element-first) their first a - ceil(t*a/(2-t)) + 1 elements must overlap.
// Indexing and probing only those prefixes finds every similar pair without comparing every pair.
const prefixLength = (n, t) => Math.max(1, Math.min(n, n - Math.ceil((t * n) / (2 - t) - 1e-9) + 1));

// incoming: [{ externalId, text }] in file order. existing: [{ externalId, text, status }] already in the
// bank (same subject; the caller leaves out any bank question the file is about to overwrite).
// Returns one entry per incoming question that has a possible duplicate, in file order:
//   { externalId, matchesExternalId, similarity, reason, text, matchesText, matchesIn: 'bank' | 'file', matchesStatus }
function findPossibleDuplicates({ incoming, existing = [], threshold = SIMILARITY_THRESHOLD }) {
  // Every distinct trigram gets an integer id; a question is the set of its trigram ids.
  const idOf = new Map();
  const gramText = [];
  const gramCount = [];
  const docs = [];
  const prepare = (item, source, order) => {
    const norm = normaliseText(item.text);
    const ids = trigramsOf(norm).map((g) => {
      let id = idOf.get(g);
      if (id === undefined) {
        id = gramText.length;
        idOf.set(g, id);
        gramText.push(g);
        gramCount.push(0);
      }
      gramCount[id] += 1;
      return id;
    });
    const doc = { ...item, source, order, norm, nums: numberSignature(norm), ids };
    docs.push(doc);
    return doc;
  };
  existing.forEach((e) => prepare(e, 'bank', -1));
  const incomingDocs = incoming.map((q, i) => prepare(q, 'file', i));

  // Rank the trigrams rarest first (one order for everybody, which the prefix filter needs). Each question
  // becomes an ascending array of ranks, so "its first few entries" are its rarest trigrams.
  const rankOf = new Int32Array(gramText.length);
  Array.from(gramText.keys())
    .sort((a, b) => gramCount[a] - gramCount[b] || (gramText[a] < gramText[b] ? -1 : 1))
    .forEach((id, rank) => { rankOf[id] = rank; });

  // Questions can only match if their numbers are identical, so each distinct number signature gets its own
  // index (trigram rank -> questions with it in their prefix). Questions with other numbers are never probed.
  const indexes = new Map();
  const byNorm = new Map(); // normalised text -> questions with exactly that text
  docs.forEach((d) => {
    d.grams = Int32Array.from(d.ids, (id) => rankOf[id]).sort();
    d.ids = null;
    d.prefix = prefixLength(d.grams.length, threshold);
    if (!indexes.has(d.nums)) indexes.set(d.nums, new Map());
    const index = indexes.get(d.nums);
    for (let k = 0; k < d.prefix && k < d.grams.length; k++) {
      const g = d.grams[k];
      if (!index.has(g)) index.set(g, []);
      index.get(g).push(d);
    }
    if (d.norm) {
      if (!byNorm.has(d.norm)) byNorm.set(d.norm, []);
      byNorm.get(d.norm).push(d);
    }
  });

  // a question is only compared with the bank and with questions EARLIER in the file, so a pair is reported once
  const usable = (d, c) => c !== d && c.externalId !== d.externalId && (c.source === 'bank' || c.order < d.order);
  const minRatio = threshold / (2 - threshold);

  const results = [];
  for (const d of incomingDocs) {
    let best = null;
    const consider = (c, similarity, reason) => {
      if (!best || similarity > best.similarity) best = { c, similarity, reason };
    };

    for (const c of byNorm.get(d.norm) || []) if (usable(d, c)) consider(c, 1, 'identical text');

    if (!best && d.grams.length > 0) {
      const seen = new Set();
      const index = indexes.get(d.nums);
      for (let k = 0; k < d.prefix && k < d.grams.length; k++) {
        for (const c of index.get(d.grams[k]) || []) {
          if (seen.has(c)) continue;
          seen.add(c);
          if (!usable(d, c)) continue;
          const lo = Math.min(d.grams.length, c.grams.length);
          const hi = Math.max(d.grams.length, c.grams.length);
          if (lo < hi * minRatio - 1e-9) continue; // sizes too different to reach the threshold
          const shared = overlapAtLeast(d.grams, c.grams, Math.ceil((threshold * (d.grams.length + c.grams.length)) / 2 - 1e-9));
          if (shared < 0) continue;
          const similarity = (2 * shared) / (d.grams.length + c.grams.length);
          if (similarity >= threshold) consider(c, similarity, 'very similar wording and the same numbers');
        }
      }
    }

    if (best) {
      results.push({
        externalId: d.externalId,
        matchesExternalId: best.c.externalId,
        similarity: Math.round(best.similarity * 100) / 100,
        reason: best.reason,
        text: d.text,
        matchesText: best.c.text,
        matchesIn: best.c.source,
        matchesStatus: best.c.source === 'bank' ? best.c.status : undefined,
      });
    }
  }
  return results;
}

module.exports = { SIMILARITY_THRESHOLD, normaliseText, numberSignature, textSimilarity, findPossibleDuplicates };
