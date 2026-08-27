# Parent Portal Auto-fill Plan

> **Status:** Planned — not yet implemented  
> **Priority:** High (UX improvement — removes manual data entry for parents)  
> **Effort:** Small — 3 frontend files, no backend changes needed

---

## Problem

When a parent clicks **Results** or **Fees** on their dashboard child card, they are taken to a blank form and asked to **type their child's admission number manually**.

This is unnecessary friction — the dashboard already knows which child was clicked (it has the name, admission number, class etc.), but that information is not being passed through to the destination pages.

### Current Flow
```
Dashboard child card
  → clicks "Results"
  → /results page loads (blank)
  → parent must type admission number
  → clicks Search
  → results appear

Dashboard child card  
  → clicks "Fees"
  → /pay page loads (blank)
  → parent must type admission number
  → clicks Search
  → fees appear
```

### Desired Flow
```
Dashboard child card
  → clicks "Results"
  → /results page loads with child name shown immediately
  → results load automatically (no typing, no button click)

Dashboard child card
  → clicks "Fees"
  → /pay page loads with child name shown immediately
  → fees load automatically (no typing, no button click)
```

---

## Root Cause Analysis

`ParentDashboard.jsx` (lines 167–178) already passes `?studentId=` in the URL:

```jsx
href={`/results?studentId=${child._id}`}
href={`/pay?studentId=${child._id}`}
```

But `ParentResults.jsx` and `ParentPay.jsx` **never read `studentId` from the URL** — they show a blank form and wait for the parent to type.

The backend public endpoints (`/students/public/results/:admissionNumber` and `/fees/public/lookup/:admissionNumber`) require an **admission number**, not a student ID. The child object in the dashboard already has `admissionNumber`, so we can simply pass it in the URL too.

---

## Solution

### No backend changes needed.

Pass `admissionNumber` and `studentName` in the URL from the dashboard, then have the Results and Pay pages read those params, pre-fill the form, and auto-trigger the lookup on mount.

---

## Files to Change (3 total)

---

### 1. `client/src/components/ParentDashboard.jsx`

**What changes:** Update the two `<a>` button `href` values (lines ~167–178).

**Before:**
```jsx
href={`/results?studentId=${child._id}`}
href={`/pay?studentId=${child._id}`}
```

**After:**
```jsx
href={`/results?admissionNumber=${encodeURIComponent(child.admissionNumber)}&studentName=${encodeURIComponent(child.name)}`}
href={`/pay?admissionNumber=${encodeURIComponent(child.admissionNumber)}&studentName=${encodeURIComponent(child.name)}`}
```

---

### 2. `client/src/components/ParentResults.jsx`

**What changes:** Read URL params on mount; if `admissionNumber` is present, pre-fill and auto-fetch.

**Logic to add:**
```js
const urlParams = new URLSearchParams(window.location.search);
const urlAdmissionNumber = urlParams.get('admissionNumber') || '';
const urlStudentName = urlParams.get('studentName') || '';

// On mount: if admissionNumber in URL, auto-trigger lookup
useEffect(() => {
  if (urlAdmissionNumber) {
    setAdmissionNumber(urlAdmissionNumber);
    // trigger fetch directly (not via form submit)
    fetchResults(urlAdmissionNumber);
  }
}, []);
```

**UX changes:**
- If auto-filled: hide the search form, show `"Loading results for {studentName}..."` while fetching
- If no URL params: show the search form as before (backwards compatible for direct visits)

---

### 3. `client/src/components/ParentPay.jsx`

**What changes:** Same pattern as Results.

**Logic to add:**
```js
const urlParams = new URLSearchParams(window.location.search);
const urlAdmissionNumber = urlParams.get('admissionNumber') || '';
const urlStudentName = urlParams.get('studentName') || '';

useEffect(() => {
  if (urlAdmissionNumber) {
    setAdmissionNumber(urlAdmissionNumber);
    fetchFees(urlAdmissionNumber);
  }
}, []);
```

**UX changes:**
- Page heading changes from generic `"School Fee Payment"` to `"{studentName}'s Fees"` when auto-filled
- Search form hidden when auto-filled from dashboard
- Form still shown if visiting `/pay` directly without params

---

## UX Comparison

| Action | Before | After |
|--------|--------|-------|
| Parent clicks **Results** on dashboard | Blank form, must type admission number | Results load automatically — no input needed |
| Parent clicks **Fees** on dashboard | Blank form, must type admission number | Fees load automatically — no input needed |
| Parent visits `/results` directly (no login) | Blank form with tenantId guard | Same (unchanged) |
| Parent visits `/pay` directly (no login) | Blank form with tenantId guard | Same (unchanged) |
| Parent visits `/results` with params but no session | Redirected to portal | Same (unchanged) |

---

## Implementation Checklist

- [ ] Update `ParentDashboard.jsx` — pass `admissionNumber` + `studentName` in href
- [ ] Update `ParentResults.jsx` — read URL params, auto-fetch on mount, hide form when auto-filled
- [ ] Update `ParentPay.jsx` — read URL params, auto-fetch on mount, update heading
- [ ] Test: clicking Results from dashboard auto-loads results
- [ ] Test: clicking Fees from dashboard auto-loads fees
- [ ] Test: visiting `/results` and `/pay` directly still shows the manual form
- [ ] Commit and push

---

## Notes

- `encodeURIComponent` is used on the URL params to handle names with spaces and special characters (e.g. "Chukwuemeka O'Brien")
- The `tenantId` guard already in place is unaffected — the auto-fill only kicks in after `tenantId` is confirmed
- No new API endpoints needed
- No changes to `ParentLogin.jsx` or `ParentPortal.jsx`
