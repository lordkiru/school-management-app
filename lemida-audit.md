# Lemida SchoolManager: Security and Architecture Audit

Repository: `lordkiru/school-management-app` (main)
Scope: full source review of `server/` and `client/`
Method: every database query site and every route middleware chain enumerated programmatically, then read individually

**Measured baseline**

| Metric | Value |
|---|---|
| API endpoints | 136 |
| Database query sites in routes | 237 |
| Query sites missing an explicit `tenantId` filter | 57 raw, ~4 material after review |
| Endpoints with a subscription gate | 4 of 136 |
| Automated tests | 0 |

---

## Correction to my earlier read

Before you uploaded the code I said tenant isolation looked like an unenforced convention. Having now read all 237 query sites, that was too harsh. Tenant scoping is applied with real discipline: filters are built as `{ tenantId: req.user.tenantId }` and extended, compound indexes are `{ tenantId, ... }` on every model, uniqueness is per tenant, and even the public payment endpoint carries an explicit cross tenant guard comparing `fee.studentId.tenantId` to `fee.tenantId`. Most of the 57 flagged sites are legitimate: super admin platform queries, pre authentication lookups, and filters built one line above the call.

The real problems are elsewhere, and they are more serious than a missing filter.

---

## P0: Any logged in parent or student can read the entire school

This is the finding that matters most.

Parent login issues a token with `role: 'parent'`. Student login issues `role: 'student'`. Nineteen endpoints are protected by `requireAuth` alone, with no `requireRole` and no inline check. A parent token passes all of them.

| Endpoint | What a parent token returns |
|---|---|
| `GET /students` | Every student in the school |
| `GET /students/:id` | Any student's profile, all scores, all fee records |
| `GET /scores` | Every score in the school |
| `GET /scores/report-card` | Full report cards for any class |
| `GET /remarks/student/:studentId` | Any student's teacher and principal remarks |
| `GET /classes`, `/subjects`, `/sessions`, `/timetable`, `/school` | Full configuration |

Reproduce in two minutes: log into the parent portal, copy the token from localStorage, then `curl -H "Authorization: Bearer <token>" <api>/students`.

You already know how to fix this, because you did it correctly once. `GET /attendance/parent/child/:studentId` checks the parent role, loads the Parent document, and verifies the requested `studentId` is in `parent.children` before returning anything. That exact pattern is missing everywhere else.

**Fix:** add `requireRole('proprietor','admin','bursar','teacher')` to every staff facing GET in the table above, and give parents and students their own narrow endpoints that resolve the child list server side from the token. Never accept a `studentId` from a parent without verifying ownership.

## P0: Unauthenticated endpoints expose student records by enumeration

```
GET /students/public/results/:admissionNumber?tenantId=...
GET /fees/public/lookup/:admissionNumber?tenantId=...
```

No authentication. The only inputs are an admission number and a `tenantId` that you publish in the parent portal link. Admission numbers are sequential by design. So anyone holding a portal link can walk `001, 002, 003...` and harvest every student's name, class, full score breakdown, and outstanding fee balance.

Rate limiting is 100 requests per 15 minutes per IP, which slows enumeration to roughly 9,600 records per day per IP, and not at all across a handful of IPs.

This is a data protection problem involving minors, not a hardening nicety. In Nigeria it engages the NDPA 2023; if you ever sell to a school with UK or EU parents it engages UK GDPR.

**Fix:** require a second factor the school controls and an attacker cannot guess. Date of birth plus admission number is the minimum. Better: issue a per student opaque result token that the school prints on the fee slip, and drop admission number lookup entirely.

## P0: The rate limiter is almost certainly misconfigured in production

`server/index.js` calls `app.use(apiLimiter)` but never calls `app.set('trust proxy', ...)`. Behind Vercel, Render, Railway, or nginx, `req.ip` is then the proxy's address, identical for every user on the platform.

Consequence: the 100 requests per 15 minutes ceiling is shared by your entire user base, not applied per user. One school taking attendance can lock out every other school. express-rate-limit v7 also raises a validation error when it sees `X-Forwarded-For` with `trust proxy` disabled.

The same omission undermines the HTTPS redirect, which reads `x-forwarded-proto`.

**Fix:** `app.set('trust proxy', 1)` before the limiter, then re-test.

## P1: The Paystack webhook can drop real payments

Three defects in one 46 line file:

1. **Rate limited.** The global `apiLimiter` sits above the webhook route, so Paystack's servers share the same 100 request bucket. Under the misconfiguration above, a burst of payments plus normal traffic returns 429 to Paystack and the charge is never recorded.
2. **Signature computed over re-serialized JSON.** You HMAC `JSON.stringify(req.body)` after Express has parsed it. Paystack signs the raw bytes. Any difference in number formatting or unicode escaping between their serializer and yours produces a mismatch and a silently rejected valid payment. Capture the raw buffer with `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })` and HMAC `req.rawBody`.
3. **Non constant time comparison.** Use `crypto.timingSafeEqual` on equal length buffers.

The idempotency check on payment reference is good and should stay.

Money that silently fails to record is the failure mode a school will notice, distrust, and churn over.

## P1: The subscription paywall is 4 endpoints wide

`requireActiveSubscription` is applied to 4 of 136 endpoints: create student, create score, create staff, create CBT test. An expired tenant can still mark attendance, run report cards, send WhatsApp broadcasts, import spreadsheets, manage fees, and read everything.

**Fix:** apply it globally in `index.js` immediately after auth, with an explicit allowlist for `/auth`, `/subscriptions`, `/paystack/webhook`, `/superadmin`, and `/tenants/register`. An allowlist fails closed; per route opt in fails open, which is exactly what happened.

## P1: `xlsx@0.18.5` has unfixed high severity advisories

Prototype pollution (CVE-2023-30533) and ReDoS (CVE-2024-22363) affect this version. There is no fixed release on the public npm registry; SheetJS moved distribution to their own CDN. Your import routes feed admin uploaded workbooks straight into `XLSX.read`, so the parser is reachable by any admin account.

**Fix:** install from the SheetJS CDN at 0.20.2 or later, or switch to `exceljs`.

## P2: Multi tenant login has an unsafe fallback that is always active today

`POST /auth/login` resolves the tenant from the subdomain when one is present, and otherwise falls back to a global `User.findOne({ email })`. Email is unique per tenant, not globally, so the fallback returns an arbitrary match when two schools share a staff email.

The fallback is not a rare edge case: `Login.jsx` treats `vercel.app` as a hosting domain and sends an empty subdomain, so **every production login today takes the unsafe path**. It works only because no two tenants have yet shared an email.

**Fix:** require an explicit school selector on the login form until subdomains are live, the same way the parent and student logins already require `tenantId`.

## P2: Smaller items

- **`routes/test.js` is mounted in production** with three unauthenticated endpoints, one of which throws deliberately to exercise Sentry. Delete it or gate it behind `NODE_ENV !== 'production'`.
- **Auth state in localStorage.** Any XSS yields a full account takeover with a 24 hour window. httpOnly cookies plus CSRF protection is the durable fix.
- **No file size limit on the logo upload.** `uploadConfig.js` creates `multer({ storage })` with no `limits`, so an admin can push arbitrarily large files to your Cloudinary account.
- **`client/.gitignore` does not list `.env`.** The root `.gitignore` catches `*.env` so you are covered today, but the client rule should be explicit.
- **1.8 MB PNG committed** at `server/logo/my-school.png`.
- **No `trust proxy`, no tests, no CI.** `npm test` in the server exits with an error by design.
- **Client routing is `window.location.pathname` string equality.** It works for six public paths and will not survive the seventh.

---

## What is genuinely well built

Worth stating plainly, because it shapes what to do next.

- Helmet, CORS allowlist, express-validator on mutating routes, bcrypt on all three credential types, HTTPS redirect, startup environment validation that hard exits, production error sanitization, Sentry.
- Tiered rate limits: 5 per 15 min on auth with `skipSuccessfulRequests`, 10 per hour on payments.
- Compound `{ tenantId, ... }` indexes on every collection, and per tenant uniqueness on admission number and email. This is the part most builds get wrong and you got right.
- No secrets committed anywhere. SMS and WhatsApp credentials are passed as arguments from per tenant configuration rather than read from global environment variables, which is the correct design for multi tenant messaging.
- Offline attendance with an IndexedDB queue and automatic sync. This is the strongest product decision in the codebase and the one a Nigerian proprietor will actually feel.
- Webhook idempotency by payment reference.
- Audit logging with full document snapshots before deletion.

---

## Recommended order of work

**This week, before another school is onboarded**

1. Add role guards to the 19 unprotected GET endpoints. Half a day.
2. Add `app.set('trust proxy', 1)`. Five minutes, largest operational payoff in the list.
3. Fix the webhook: exempt it from the limiter, HMAC the raw body, use `timingSafeEqual`. Two hours.
4. Delete `routes/test.js`. Five minutes.

**Next two weeks**

5. Put the public results and fee lookup endpoints behind a second factor.
6. Move the subscription gate to a global allowlist.
7. Replace `xlsx`.
8. Require explicit school selection at login until subdomains ship.

**Before you scale past roughly ten schools**

9. Write the cross tenant test suite: authenticate as Tenant A, hit every `/:id` endpoint with Tenant B object ids, assert 404 on all of them. This is the regression net that lets you move fast later, and it is worth more than any further manual review.
10. Add a Mongoose plugin injecting `tenantId` into every query from request scoped context, so isolation is structural rather than remembered. Your current discipline is good; the plugin is what keeps it good on the day you hire a second developer.
11. Move tokens to httpOnly cookies.

---

## Business read

The feature depth is real and the market targeting is specific: fees, offline attendance, CBT, and WhatsApp are the four things Nigerian private school proprietors pay for, and the code defaults (NGN, kobo, Africa/Lagos, September year start, Paystack, Termii) show you built for that buyer rather than a generic template.

The gap is not features. It is that a parent account can read the whole school and an unauthenticated visitor can enumerate student records. Those two findings are the difference between a demo and something you can put in front of a school that asks about data protection. They are also both fixable in under a week.

Fix the P0s first. They cost days. Everything else can follow the roadmap.
