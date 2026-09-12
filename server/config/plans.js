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

module.exports = { PLANS, PLAN_NAMES };
