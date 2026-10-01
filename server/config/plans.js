// Single source of truth for what each subscription tier includes.
// null on a limit means unlimited.
const PLANS = {
  founding:   { studentLimit: null, staffLimit: null, features: { cbt: true } },
  nano:       { studentLimit: 50,   staffLimit: 3,    features: { cbt: false } },
  micro:      { studentLimit: 100,  staffLimit: 5,    features: { cbt: false } },
  starter:    { studentLimit: 150,  staffLimit: 10,   features: { cbt: false } },
  standard:   { studentLimit: 250,  staffLimit: 15,   features: { cbt: false } },
  growth:     { studentLimit: 400,  staffLimit: null, features: { cbt: true } },
  enterprise: { studentLimit: null, staffLimit: null, features: { cbt: true } },
};

const PLAN_NAMES = Object.keys(PLANS);

// Per-term price in Naira (this business bills per academic term, not monthly/yearly).
// Only the tiers a proprietor can self-service purchase appear here — Founding is a
// manually-granted status only a super admin assigns, and Enterprise is "Contact Us"
// with no listed price, so neither belongs in a self-service purchase flow.
const PLAN_PRICES = {
  nano: 42500,
  micro: 75000,
  starter: 105000,
  standard: 162500,
  growth: 240000,
};

const SELF_SERVICE_PLAN_NAMES = Object.keys(PLAN_PRICES);

module.exports = { PLANS, PLAN_NAMES, PLAN_PRICES, SELF_SERVICE_PLAN_NAMES };
