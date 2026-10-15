const { PLANS } = require('../config/plans');

// What a school may do with CBT, in one place so the middleware, the school-facing
// entitlements endpoint and the super-admin list can never disagree:
//
//   Full CBT   (CA tests + mock + practice + Mock & Practice page): the plan includes CBT,
//              or the school is in an active trial.
//   Add-on     (mock + practice + Mock & Practice page, never CA tests): the plan does not
//              include CBT, but a super admin switched the CBT add-on on and its end date
//              is still in the future.
//   Neither    no CBT.

const planHasCbt = (plan) => !!(plan && PLANS[plan] && PLANS[plan].features.cbt);

const isInActiveTrial = (tenant) => !!(tenant.isTrialing && !tenant.isTrialExpired());

// The school's own entitlements. `subscription` is its active paid subscription (or null).
function getCbtEntitlements({ tenant, subscription }) {
  const inTrial = isInActiveTrial(tenant);
  const fullCbt = inTrial || planHasCbt(subscription && subscription.plan);
  const addonActive = tenant.hasActiveCbtAddon();
  const expiresAt = tenant.cbtAddon && tenant.cbtAddon.expiresAt;
  return {
    fullCbt,
    mockPractice: fullCbt || addonActive,
    // null until a super admin has ever granted the add-on
    addon: expiresAt ? { active: addonActive, expiresAt } : null,
    inTrial,
  };
}

// The status a super admin sees against a school, from the tenant record alone.
//   trial | included | addon_active | addon_expired | off
// "expired" means the add-on was switched on and its end date has passed; one that was
// switched off by hand reads as "off".
function getTenantCbtStatus(tenant) {
  const addon = tenant.cbtAddon || {};
  const expiresAt = addon.expiresAt || null;

  let state = 'off';
  if (isInActiveTrial(tenant)) state = 'trial';
  else if (planHasCbt(tenant.subscriptionPlan)) state = 'included';
  else if (tenant.hasActiveCbtAddon()) state = 'addon_active';
  else if (addon.active && expiresAt) state = 'addon_expired';

  return { state, expiresAt };
}

module.exports = { planHasCbt, getCbtEntitlements, getTenantCbtStatus };
