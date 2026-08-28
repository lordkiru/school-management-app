# CBT (Computer-Based Test) Module Plan

> **Status:** Full scaffold complete — student auth, test builder, timed test-taking, auto-marking,
> CA sync, teacher results view, student history, PIN-reset UI all built. Only the optional
> tab-switch integrity flag remains unbuilt. Not yet run through a real `npm run build` or a
> browser — see "What to verify before shipping" below.
> **Priority:** High (new revenue/retention feature — auto-marked CA scores)
> **Effort:** Medium — 1 new auth flow (students), 2 new models, ~6 backend routes, ~4 frontend components

---

## Problem

Teachers currently enter CA1/CA2/exam scores manually into `Score` via `AddScore.jsx`. There's
no way to run a multiple-choice test in-app, have it auto-marked, and have the result flow into
a student's CA score without manual re-typing.

Also: **students have no login accounts today.** Only `User` (staff) and `Parent` can
authenticate. Students only exist as records owned by staff/parents.

## Goal

Teachers build a multiple-choice test tied to a subject/class/term/session. Students log in,
take the test, it's auto-marked, and the score is written straight into `Score.ca1` or
`Score.ca2` (teacher's choice per test) — feeding directly into the existing report card /
grading pipeline with no changes to `computeGrade` or the report-card route.

---

## Part 1 — Student Login (prerequisite)

Extend `Student` rather than creating a parallel identity system — it's already tenant-scoped
and has `admissionNumber` as a natural unique login handle.

**`Student.js` additions:**
```js
password: { type: String, default: null },       // bcrypt hash, same pattern as User/Parent
mustChangePassword: { type: Boolean, default: true },
lastLoginAt: { type: Date, default: null },
```
Password is nullable because most students won't have one until provisioned — CBT access is
opt-in per school, not a hard requirement for the rest of the app.

**Provisioning (`POST /students/:id/generate-pin`, admin/proprietor/teacher):**
Generates a random 4-digit PIN, hashes it, saves it, and returns the **plaintext PIN once** in
the response so staff can print/hand out login slips. A bulk variant
(`POST /students/generate-pins?classId=`) does this for a whole class at once — mirrors how
`generate-reset` already works for staff in `auth.js`.

**Login (`POST /auth/student-login`):**
Same shape as the existing parent login (`parents.js` `/login`) — needs
`admissionNumber + pin + tenantId` since there's no subdomain-based tenant resolution yet.
Issues a JWT: `{ id, role: 'student', tenantId, classId }`. `requireAuth` needs no changes since
it just decodes whatever shape the JWT is; `requireRole('student')` gates new routes the same
way it already gates `'teacher'`, `'parent'`, etc.

**Frontend:** new `StudentLogin.jsx` (sibling to `ParentLogin.jsx`), stores token under a
distinct key (e.g. `studentToken`) so a student and a parent/staff member can't clobber each
other's session on a shared device.

---

## Part 2 — Data Models

**`CbtTest`** (teacher-authored, embedded questions — no need to query questions separately)
```js
{
  tenantId, title, subjectId, classId, term, session,
  durationMinutes,
  caSlot: { type: String, enum: ['ca1', 'ca2'] },   // which CA field this test fills
  questions: [{
    text, options: [String], correctIndex: Number, marks: { type: Number, default: 1 },
  }],
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdBy,  // teacherId
}
```

**`CbtAttempt`** (one per student per test — enforced, not just assumed)
```js
{
  tenantId, testId, studentId,
  answers: [Number],           // index per question, -1/null = unanswered
  score, maxScore,
  startedAt, submittedAt,
  autoSubmitted: Boolean,       // true if the deadline hit before the student submitted
  status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
}
```
Unique index: `{ tenantId, testId, studentId }` — same enforcement pattern as the existing
unique index on `Score` (`tenantId, studentId, subjectId, term, session`).

---

## Part 3 — Backend Routes

| Route | Role | Notes |
|---|---|---|
| `POST /cbt/tests` | teacher/admin/proprietor | Teacher restricted to subjects where `Subject.teacherId === req.user.id` unless admin |
| `PATCH /cbt/tests/:id` | teacher/admin/proprietor | Only while `status: 'draft'` |
| `PATCH /cbt/tests/:id/publish` | teacher/admin/proprietor | Locks questions from further edits |
| `GET /cbt/tests/available` | student | Published tests for `req.user.classId` with no existing attempt. **Strips `correctIndex`.** |
| `POST /cbt/tests/:id/start` | student | Creates `CbtAttempt`, stamps `startedAt` server-side (never trust a client timer) |
| `POST /cbt/attempts/:id/submit` | student | Marks, scores, sets `submittedAt`; rejects if already submitted or past deadline |
| `GET /cbt/tests/:id/results` | teacher/admin/proprietor | Per-student scores + CA-sync status |

## Part 4 — Auto-marking → CA sync

On submit:
```js
const scaled = (rawScore / totalPossible) * school[test.caSlot + 'Max']; // ca1Max or ca2Max
await Score.findOneAndUpdate(
  { tenantId, studentId, subjectId: test.subjectId, term: test.term, session: test.session },
  { $set: { [test.caSlot]: scaled }, $setOnInsert: { tenantId } },
  { upsert: true, new: true, runValidators: true }
);
```
Only touches the one CA field — never clobbers the other CA slot or `exam`. Feeds straight into
the existing `computeGrade` / report-card pipeline unchanged.

## Part 5 — Frontend

- `StudentLogin.jsx`, `StudentDashboard.jsx` — list of available/completed tests
- `CbtTestTaking.jsx` — fetches test with no answer key, server-time-driven countdown, auto-
  submit on timeout, disabled resubmission
- `CbtBuilder.jsx` (teacher) — question editor, form patterns borrowed from `AddScore.jsx`
- `CbtResults.jsx` (teacher) — per-student scores, CA-sync confirmation

## Part 6 — Integrity (kept lightweight, not lockdown-browser-grade)

- Server-side deadline enforcement (`startedAt + durationMinutes`, never client-supplied)
- One attempt per student per test (unique index)
- Optional: log `visibilitychange`/blur events client-side, surface a "left screen N times" flag
  to the teacher on the results view — no full lockdown needed for a lightweight module

---

## Build Order

1. ✅ **Student model + student auth** — `Student.password`/`mustChangePassword`, `POST /auth/student-login`, `POST /students/:id/generate-pin`, `POST /students/generate-pins`, `GET /students/me`, `PATCH /students/me/change-pin`, `StudentLogin.jsx`, wired at `/cbt-login`
2. ✅ **`CbtTest` CRUD + teacher builder UI** — `models/CbtTest.js`, `models/CbtAttempt.js`, `routes/cbt.js` (create/list/edit/publish/delete/results), `CbtBuilder.jsx`, wired into the sidebar as "CBT Tests"
3. ✅ **Attempt start/submit + auto-marking** — `POST /cbt/tests/:id/start` (server-stamped `startedAt`), `POST /cbt/attempts/:id/submit` (marks against `correctIndex`, rejects late/duplicate submits), `CbtTestTaking.jsx` with a server-anchored countdown
4. ✅ **CA sync into `Score`** — submit route upserts `Score.ca1`/`Score.ca2` scaled to `School.ca1Max`/`ca2Max`, never touching the other CA field or `exam`
5. ✅ **Student dashboard polish** — `CbtHistory.jsx` (uses `GET /cbt/attempts/mine`), tab toggle between "Take a test" / "History" on `/cbt-login`
6. ✅ **Teacher results/PIN UX** — `CbtResults.jsx` (uses `GET /cbt/tests/:id/results`, publish/unpublish toggle), "CBT Login" card with generate/reset PIN button added to `StudentDetail.jsx`
7. ⬜ **Tab-switch integrity flag** — the one item from the original plan not yet built. Not started.

### What to verify before shipping
- Run `npm install && npm run build` in `client/` — this sandbox couldn't run a full Vite build (missing native rolldown binding, no network), so all JSX here was validated with `@babel/parser` (real syntax parsing, not just brace-counting) but never bundled or rendered in a browser. **This actually caught one real bug** — a bad `str_replace` on `StudentDetail.jsx` left duplicated/mismatched content that would have failed to build; it was fixed once the parser flagged it. Treat the parser check as "syntactically valid," not "definitely bug-free" — a real build + click-through in a browser is still needed before shipping.
- Seed a test school/class/subject/student in a dev DB and walk through: generate a PIN (via the new card on a student's profile page) → student logs in at `/cbt-login` → teacher builds+publishes a test at the "CBT Tests" sidebar page → student takes and submits it → confirm the score lands in `Score.ca1`/`ca2` and shows up on the report card → teacher checks the "Results" button on that test.
- Double check `.env` has `JWT_SECRET` set before testing student-login (same requirement as existing auth).


