const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// Get current tenant's subscription
router.get('/me', requireAuth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      tenantId: req.user.tenantId 
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json(subscription);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subscription history for current tenant
router.get('/history', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ 
      tenantId: req.user.tenantId 
    }).sort({ createdAt: -1 });

    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upgrade/Change subscription plan (Proprietor only)
router.post('/upgrade', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;

    if (!['trial', 'basic', 'professional', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    // Get current subscription
    const currentSubscription = await Subscription.findOne({ 
      tenantId: req.user.tenantId,
      status: 'active'
    });

    if (currentSubscription) {
      // End current subscription — use 'canceled' to match the Subscription model enum
      currentSubscription.status = 'canceled';
      currentSubscription.canceledAt = new Date();
      await currentSubscription.save();
    }

    // Calculate end date based on billing cycle
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create new subscription
    const newSubscription = new Subscription({
      tenantId: req.user.tenantId,
      plan,
      interval: billingCycle, // model uses 'interval', not 'billingCycle'
      amount: 0, // updated by payment webhook
      currency: 'NGN',
      status: 'active',
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
    });

    await newSubscription.save();

    // Update tenant status
    await Tenant.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { status: 'active' }
    );

    res.status(201).json({
      message: 'Subscription upgraded successfully',
      subscription: newSubscription,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel subscription (Proprietor only)
router.post('/cancel', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      tenantId: req.user.tenantId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Use 'canceled' to match the Subscription model enum (one 'l')
    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    await subscription.save();

    // Update tenant status — use 'suspended' (valid Tenant enum value)
    await Tenant.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { subscriptionStatus: 'canceled' }
    );

    res.json({
      message: 'Subscription cancelled successfully',
      subscription,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Renew subscription (Proprietor only)
router.post('/renew', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const currentSubscription = await Subscription.findOne({ 
      tenantId: req.user.tenantId 
    }).sort({ createdAt: -1 });

    if (!currentSubscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Calculate new end date based on existing interval
    const startDate = new Date();
    const endDate = new Date();
    if (currentSubscription.interval === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create renewal subscription
    const renewal = new Subscription({
      tenantId: req.user.tenantId,
      plan: currentSubscription.plan,
      interval: currentSubscription.interval,
      amount: currentSubscription.amount || 0,
      currency: currentSubscription.currency || 'NGN',
      status: 'active',
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
    });

    await renewal.save();

    // Update tenant status
    await Tenant.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { status: 'active' }
    );

    res.status(201).json({
      message: 'Subscription renewed successfully',
      subscription: renewal,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all subscriptions (Super Admin only)
router.get('/all', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const subscriptions = await Subscription.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update subscription status (Super Admin only)
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { status } = req.body;

    // Valid values must match the Subscription model enum: ['active', 'past_due', 'canceled', 'trialing', 'incomplete']
    if (!['active', 'past_due', 'canceled', 'trialing', 'incomplete'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'active', 'past_due', 'canceled', 'trialing', or 'incomplete'." });
    }

    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
