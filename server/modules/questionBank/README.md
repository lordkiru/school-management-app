# Lemida Question Bank (server module)

A shared bank of exam questions that belongs to **Lemida, not to any school** (no `tenantId`). The separate
student Exam Prep app will read it through the API later; SchoolManager uses it to fill mock and practice tests.

## Rules for this folder

- Nothing here imports SchoolManager domain code (Tenant, Student, Class, Subject, Score, fees, plans...).
  SchoolManager may call this module's functions; this module never calls SchoolManager.
- Shared infrastructure is passed in: `createQuestionBankRouter({ requireAuth, requireRole })`, mounted at `/bank`.
- Every permission check goes through `canManageBank(user)` in `permissions.js`. Today only `super_admin` passes;
  a future `content_reviewer` role is a one-line change there.
- Never commit question content. Test fixtures use clearly fake samples (`fixtures/`).

## API (all need a token and `canManageBank`)

| Route | Purpose |
| --- | --- |
| `POST /bank/import?dryRun=true\|false` | Import a question file (JSON body, 5 MB max). Anything other than an explicit `dryRun=false` is a dry run. |
| `GET /bank/questions` | List with filters `subject topic status pool exam search page limit`. |
| `GET /bank/stats` | Counts by subject → topic → status, plus totals by pool. |
| `PATCH /bank/questions/:id` | Edit text, options, correctIndex, explanation, topic, difficulty, pool, exams. Editing an approved question sends it back to draft. |
| `POST /bank/review` | `{ ids[], status: 'approved' \| 'rejected', notes? }` |

## Functions for SchoolManager (no HTTP)

- `listApprovedSubjects()` – approved subjects with topics and counts.
- `pickApprovedQuestions({ subject, topics, count, difficulty, preferPool })` – random **approved** questions only,
  `reserved` first then topped up from `public`.

## Import file format

```json
{
  "exam": "WAEC/NECO", "subject": "General Mathematics", "batch": "pilot-001",
  "objective": [
    { "id": "EX-001", "section": "Number", "topic": "Fractions", "difficulty": "easy",
      "question": "...", "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "A", "explanation": "..." }
  ],
  "theory": []
}
```

- `id` becomes `externalId` (unique). Options go in letter order and `answer` is the correct letter.
- `subject` and `batch` apply to every question. `exams` defaults to WAEC and NECO; a question can set `exams`
  and `pool` (`public` by default, or `reserved`).
- `theory` is skipped for now and counted in the report.
- Every problem with a question is reported (not just the first). Valid questions are imported as **draft**;
  questions with problems are skipped.
- **Possible duplicates** (warnings, never errors): on every import, dry run or real, each question is compared with
  the other questions of the same subject in the bank (a different id, and not one this file is about to overwrite)
  and with the earlier questions in the same file. It is flagged when the normalised text is identical, or when the
  wording is very similar (Dice similarity of trigrams of at least 0.9) **and the numbers in the question are the
  same**. Normalising lower-cases, collapses spaces and strips prose punctuation, but keeps maths symbols (+ - * / =
  < > ^ %, brackets, a minus sign, a decimal point), so `6 + 3` and `6 - 3` or `x = -3` and `x = 3` are different.
  The report gets `possibleDuplicates: [{ externalId, matchesExternalId, similarity, reason, text, matchesText,
  matchesIn: 'bank' | 'file', matchesStatus }]`, one entry per question (its best match). They never block an import.
- An id belongs to one subject for good: reusing an id the bank already holds under a **different** subject is an
  error (the question is left out), so an import can never move a question between subjects.
- Re-importing: an unchanged question is skipped; a changed draft or rejected question is updated; a changed
  **approved** question is updated and goes back to draft (listed as needing re-approval). Fields a file leaves
  out (`exams`, `difficulty`, `pool`, `section`) keep their current value.

## CLI

```bash
node scripts/importQuestionBank.js path/to/file.json --dry-run   # report only
node scripts/importQuestionBank.js path/to/file.json             # import
```

The file can be anywhere on your computer. It uses `MONGO_URI` from `server/.env`.

## Tests

`npm run test:bank` runs the importer's unit tests (no database needed).
