const express = require('express');
const router = express.Router();
const axios = require('axios');
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { PLAN_PRICES, SELF_SERVICE_PLAN_NAMES } = require('../config/plans');

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

// Initiate a plan purchase/upgrade (Proprietor only) — this does NOT activate
// anything. It only asks Paystack for a payment link. The subscription is
// created/activated by paystackWebhook.js once the charge.success event
// confirms the money actually arrived — never here, and never for free.
router.post('/upgrade', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const { plan } = req.body;

    if (!SELF_SERVICE_PLAN_NAMES.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Founding is assigned by the platform; Enterprise is by custom quote — contact us for either.' });
    }

    const amount = PLAN_PRICES[plan];

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: amount * 100, // kobo
        // Deliberately no `subaccount` / `bearer_type` — this is money owed to
        // the platform itself, not a school, so it must settle to the main
        // Paystack account in full, never split to a tenant's subaccount.
        metadata: {
          type: 'subscription',
          plan,
          tenantId: req.user.tenantId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json({ authorizationUrl: response.data.data.authorization_url });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initiate payment' });
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
