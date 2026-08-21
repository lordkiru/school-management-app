# Comprehensive Project Audit Report
**School Management SaaS Application**

**Date:** August 19, 2026  
**Scope:** Full-stack review of server (Express/MongoDB) and client (React/Vite)

## Executive Summary
The project has a solid foundation but has **critical bugs** that will cause runtime failures, **security gaps** contradicting existing security documentation, and **architectural issues** needing attention before production.

### Overall Assessment: NOT PRODUCTION-READY
- Critical Issues Found: 10
- High Priority Issues: 14
- Medium Priority Issues: 12
- Low Priority Issues: 8

## CRITICAL ISSUES (10)

### 1. Rate Limiter Not Applied to Any Routes
**File:** `server/index.js` (line 62)
The global rate limiter is `app.use('/api/', apiLimiter)` but all routes are registered without `/api/` prefix. The general API rate limiter never executes.
**Fix:** Use `app.use(apiLimiter)` without path prefix.

### 2. Student Model Missing Fields Required by Validator and Frontend
**Files:** `server/models/Student.js`, `server/middleware/validators.js`, `client/src/components/AddStudent.jsx`
The validator requires `dateOfBirth` and `gender`, frontend sends them, but the Student model doesn't define them. Adding students will fail validation or silently drop data. ParentDashboard also displays `child.gender` which won't exist.

### 3. Tenant Model vs Routes Field Mismatch
**Files:** `server/models/Tenant.js`, `server/routes/tenants.js`, `server/routes/superadmin.js`, `server/scripts/createSuperAdmin.js`, `server/scripts/migrateTenantId.js`
- Model has `schoolName` but routes use `name`
- Model has `onboardedBy` but routes use `ownerId`
- Model status enum is `['active', 'suspended', 'deleted']` but routes use `'trial'` and `'cancelled'`
- Model requires `primaryContact` which routes never set

### 4. Subscription Model vs Routes Field Mismatch
**Files:** `server/models/Subscription.js`, `server/routes/subscriptions.js`, `server/routes/superadmin.js`, `server/scripts/createSuperAdmin.js`, `server/scripts/migrateTenantId.js`
- Model has `interval` but routes use `billingCycle`
- Model has `currentPeriodStart`/`currentPeriodEnd` but routes use `startDate`/`endDate`
- Model requires `amount` which routes never set
- Model status enum uses `'canceled'` but routes use `'cancelled'` and `'expired'`

### 5. `super_admin` Role Not in User Model Enum
**File:** `server/models/User.js`
The User model role enum is `['proprietor', 'admin', 'teacher', 'bursar', 'parent']` — no `super_admin`. Super admin routes check for `req.user.role === 'super_admin'` but this role can never be created.

### 6. Test Routes Exposed in Production
**File:** `server/routes/test.js`
Routes `/test/error`, `/test/message`, `/test/manual-error` are accessible without authentication in production.

### 7. XSS Protection Claimed But Not Implemented
**Files:** `SECURITY.md`, `server/package.json`, `server/index.js`
SECURITY.md claims xss-clean is used, but it is not in package.json and no sanitization middleware is used anywhere.

### 8. No Tests Configured
**File:** `server/package.json`
The test script just echoes an error and exits. Zero automated tests.

### 9. `createSuperAdmin.js` Script Will Fail
**File:** `server/scripts/createSuperAdmin.js`
Fails due to field mismatches (issues #3, #4, #5) and uses hardcoded default credentials.

### 10. `migrateTenantId.js` Script Will Fail
**File:** `server/scripts/migrateTenantId.js`
Same field mismatches — the migration script cannot run.

## HIGH PRIORITY ISSUES (14)

### 11. Missing Role Restrictions on Multiple Routes
- `POST /scores` — Any authenticated user can create scores
- `PATCH /school` — Any authenticated user can modify school settings
- `POST /school/logo` — Any authenticated user can upload a logo
- `POST /sessions` — Any authenticated user can create sessions
- `PATCH /sessions/:id/set-current` — Any authenticated user can change current session
- `DELETE /sessions/:id` — Any authenticated user can delete sessions

### 12. Public Endpoints Expose Sensitive Data
`GET /fees/public/lookup/:admissionNumber` and `POST /fees/public/:id/initiate-payment` expose fee data without authentication.

### 13. Paystack Webhook Missing Tenant Verification
Webhook verifies Paystack signature but does not verify fee belongs to the correct tenant.

### 14. No Input Validation on Many Routes
Classes, subjects, sessions, timetable, school, and fees bulk operations have no validation middleware.

### 15. N+1 Query Problem in Report Card Route
`GET /scores/report-card` performs a query per student in a loop.

### 16. No Pagination on List Endpoints
Students, classes, subjects, scores, fees, parents, staff all return all records.

### 17. JWT Token Expiration Too Long
7-day expiration is excessive. Recommend 24 hours with refresh tokens.

### 18. No Account Lockout Mechanism
Rate limiting doesn't prevent brute-force after window resets.

### 19. Sentry Traces Sample Rate Set to 100%
`tracesSampleRate: 1.0` will incur significant costs in production.

### 20. `attachTenant` Middleware Never Used
Exists but never imported or used in any route.

### 21. No Request Logging
No morgan or equivalent for debugging/security auditing.

### 22. CORS Allows Requests Without Origin
`if (!origin) return callback(null, true)` bypasses CORS whitelist.

### 23. Super Admin Dashboard Quick Actions Broken
Links to `/superadmin/tenants`, `/superadmin/subscriptions`, `/superadmin/users` don't exist in App.jsx.

### 24. Hardcoded Default Credentials in Scripts
Both createSuperAdmin.js and createTenant.js use hardcoded passwords.

## MEDIUM PRIORITY ISSUES (12)

### 25. Error Messages Leak Internal Details
Many routes return `err.message` directly to client.

### 26. No API Versioning
All routes at root level.

### 27. No Database Backup Strategy

### 28. No Helmet CSP Configuration

### 29. No File Size Limit on Uploads

### 30. No Rate Limiting on Public Fee Endpoints
Public fee lookup uses apiLimiter which is not applied (see Critical #1).

### 31. No Validation on Fee Payment Amount
Doesn't check if amount exceeds remaining balance.

### 32. No Tenant Check on Public Student Lookup
Public results lookup searches globally without tenant scoping.

### 33. No Data Sanitization on Search Queries
Regex from user input can cause ReDoS.

### 34. No Audit Logging for Most Operations
Only fee deletion is logged.

### 35. Client Uses alert()/confirm() Browser Dialogs

### 36. Client Uses window.location.href for Navigation

## LOW PRIORITY ISSUES (8)

### 37. No Frontend Error Boundary
### 38. No Loading States on Most Components
### 39. No Environment-Specific Configuration
### 40. No TypeScript
### 41. No Server-Side Linting/Formatting
### 42. No CI/CD Pipeline
### 43. README.md Is Essentially Empty
### 44. No Frontend Routing Library

## WHAT'S WORKING WELL (17 items)
1. JWT Authentication with bcrypt
2. Role-Based Access Control
3. Input Validation (where applied)
4. Security Headers (Helmet)
5. HTTPS Enforcement
6. CORS Whitelist
7. Error Sanitization
8. Sentry Integration
9. Paystack Webhook Signature Verification
10. Multi-Tenant Data Isolation
11. Database Indexes
12. Password Hashing
13. Rate Limiting on Auth
14. Audit Trail (fee deletion)
15. Cloudinary Integration
16. Dark Mode Support
17. Responsive Design

## RECOMMENDED ACTION PLAN

### Immediate (Critical)
1. Fix rate limiter registration
2. Add dateOfBirth/gender to Student model
3. Fix Tenant model field mismatches
4. Fix Subscription model field mismatches
5. Add super_admin to User model role enum
6. Gate test routes behind NODE_ENV check
7. Install xss-clean
8. Set up automated tests
9. Fix createSuperAdmin.js and migrateTenantId.js scripts
10. Remove hardcoded credentials from scripts

### High Priority (Week 1)
11-23. See details above.

### Medium Priority (Week 2)
24-36. See details above.

### Low Priority (Ongoing)
37-44. See details above.

## SECURITY SCORE REASSESSMENT

The existing SECURITY_AUDIT_REPORT.md claims 9.5/10 and "PRODUCTION-READY". This audit finds a revised score of **5.0/10** — significant work needed before production.

| Category | Claimed | Actual |
|---|---|---|
| Rate Limiting | Applied | Not applied (critical bug) |
| XSS Protection | Implemented | Not implemented |
| Input Validation | Comprehensive | Missing on many routes |
| Model Integrity | Consistent | Multiple critical mismatches |
| Role-Based Access | Working | Gaps on several routes |
| Test Coverage | N/A | Zero tests |
| Scripts | N/A | Broken |

---
**Report Generated:** August 19, 2026
