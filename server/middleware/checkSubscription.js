const Tenant = require('../models/Tenant');

/**
 * Middleware: requireActiveSubscription
 *
 * Blocks access to any route if the tenant's subscription has expired or
 * the account has been suspended/deleted. Should be used AFTER requireAuth.
 *
 * Super admins bypass this check — they operate at the platform level.
 */
function requireActiveSubscription(req, res, next) {
  // Super admin bypasses subscription checks entirely
  if (req.user.role === 'super_admin') return next();

  Tenant.findOne({ tenantId: req.user.tenantId })
    .then((tenant) => {
      if (!tenant) {
        return res.status(403).json({
          error: 'School account not found. Please contact support.',
          code: 'TENANT_NOT_FOUND',
        });
      }

      if (tenant.status === 'suspended') {
        return res.status(403).json({
          error: 'Your school account has been suspended. Please contact support to reactivate.',
          code: 'ACCOUNT_SUSPENDED',
        });
      }

      if (tenant.status === 'deleted') {
        return res.status(403).json({
          error: 'This school account no longer exists.',
          code: 'ACCOUNT_DELETED',
        });
      }

      // Check if trial has expired
      if (tenant.subscriptionStatus === 'trialing' && tenant.isTrialExpired()) {
        return res.status(403).json({
          error: 'Your free trial has expired. Please upgrade to a paid plan to continue.',
          code: 'TRIAL_EXPIRED',
          trialEndedAt: tenant.trialEndsAt,
        });
      }

      // Check if subscription was cancelled
      if (tenant.subscriptionStatus === 'canceled') {
        return res.status(403).json({
          error: 'Your subscription has been cancelled. Please renew to continue.',
          code: 'SUBSCRIPTION_CANCELED',
        });
      }

      next();
    })
    .catch(next);
}

module.exports = requireActiveSubscription;
