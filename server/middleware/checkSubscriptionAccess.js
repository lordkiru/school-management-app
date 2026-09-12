const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const { PLANS } = require('../config/plans');

/**
 * Middleware: checkSubscriptionAccess
 *
 * Resolves what a tenant is allowed and attaches it to req.planAccess:
 *   - { unlimited: true }                              — currently trialing, trial not expired
 *   - { unlimited: false, plan, limits }                — active paid subscription found
 *
 * Blocks (403) if the trial has ended and there's no active paid subscription —
 * including the case where no Subscription document exists at all.
 *
 * Should run AFTER requireAuth and requireActiveSubscription (that middleware
 * already blocks suspended/deleted/canceled/trial-expired tenants — this one
 * is purely about resolving plan-aware limits for the ones let through).
 */
async function checkSubscriptionAccess(req, res, next) {
  try {
    // Super admin bypasses entirely — same convention as requireActiveSubscription
    if (req.user.role === 'super_admin') {
      req.planAccess = { unlimited: true };
      return next();
    }

    const tenant = await Tenant.findOne({ tenantId: req.user.tenantId });
    if (!tenant) {
      return res.status(403).json({
        error: 'School account not found. Please contact support.',
        code: 'TENANT_NOT_FOUND',
      });
    }

    if (tenant.isTrialing && !tenant.isTrialExpired()) {
      req.planAccess = { unlimited: true };
      return next();
    }

    const subscription = await Subscription.findActiveByTenant(tenant.tenantId);
    const limits = subscription && PLANS[subscription.plan];

    if (!subscription || !limits) {
      return res.status(403).json({
        error: 'Your free trial has ended - please subscribe to continue using Lemida SchoolManager',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    req.planAccess = { unlimited: false, plan: subscription.plan, limits };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = checkSubscriptionAccess;
