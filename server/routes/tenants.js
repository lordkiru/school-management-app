const express = require('express');
const router = express.Router();
const axios = require('axios');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const bcrypt = require('bcryptjs');
const { createSubaccount } = require('../services/paystackSubaccount');

// Get all tenants (Super Admin only - for platform management)
router.get('/', requireAuth, async (req, res) => {
  try {
    // Only allow if user is a super admin (you may need to add this role)
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const tenants = await Tenant.find()
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current tenant info
router.get('/me', requireAuth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.user.tenantId })
      .populate('ownerId', 'name email');
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new tenant (Public self-registration)
const { authLimiter } = require('../middleware/rateLimiter');
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { schoolName, ownerName, ownerEmail, ownerPassword, subdomain } = req.body;

    // Validate required fields
    if (!schoolName || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ 
        error: 'School name, owner name, email, and password are required' 
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: ownerEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate unique tenantId
    const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create tenant
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

    const tenant = new Tenant({
      tenantId,
      schoolName,
      subdomain: subdomain || tenantId,
      subscriptionPlan: 'trial',
      subscriptionStatus: 'trialing',
      trialEndsAt,
      primaryContact: {
        name: ownerName,
        email: ownerEmail,
      },
      status: 'active',
    });

    await tenant.save();

    // Create owner user (proprietor)
    const owner = new User({
      tenantId,
      name: ownerName,
      email: ownerEmail,
      password: ownerPassword, // Will be hashed by pre-save hook
      role: 'proprietor',
    });

    await owner.save();

    // Link owner to tenant
    tenant.ownerId = owner._id;
    await tenant.save();

    // Create default subscription (trial)
    const subscription = new Subscription({
      tenantId,
      plan: 'trial',
      interval: 'trial',
      amount: 0,
      currency: 'NGN',
      status: 'trialing',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
      trialStart: new Date(),
      trialEnd: trialEndsAt,
    });

    await subscription.save();

    res.status(201).json({
      message: 'Tenant created successfully',
      tenant: {
        tenantId: tenant.tenantId,
        schoolName: tenant.schoolName,
        subdomain: tenant.subdomain,
      },
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
      },
      subscription: {
        plan: subscription.plan,
        endDate: subscription.currentPeriodEnd,
      },
    });
  } catch (err) {
    console.error('Tenant registration error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Update tenant info (Proprietor only)
router.patch('/me', requireAuth, requireRole('proprietor'), async (req, res) => {
  try {
    const { name, subdomain, settings } = req.body;

    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { schoolName: name, subdomain, settings },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update tenant status (Super Admin only)
router.patch('/:tenantId/status', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { status } = req.body;

    if (!['active', 'suspended', 'deleted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use active, suspended, or deleted. (Trial/cancellation state is tracked separately on the subscription.)' });
    }

    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.params.tenantId },
      { status },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete tenant (Super Admin only - soft delete)
router.delete('/:tenantId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.params.tenantId },
      { status: 'deleted' },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ message: 'Tenant cancelled successfully', tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tenants/banks - list Nigerian banks for a bank-selection dropdown (Super Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/banks', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const response = await axios.get('https://api.paystack.co/bank', {
      params: { country: 'nigeria' },
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const banks = response.data.data.map((b) => ({ name: b.name, code: b.code }));
    res.json(banks);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch bank list' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /tenants/resolve-account?accountNumber=&bankCode= - verify the account holder
// name before saving bank details (Super Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/resolve-account', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { accountNumber, bankCode } = req.query;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: 'accountNumber and bankCode are required' });
    }

    const response = await axios.get('https://api.paystack.co/bank/resolve', {
      params: { account_number: accountNumber, bank_code: bankCode },
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    res.json({ accountName: response.data.data.account_name });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data?.message || 'Could not verify account number' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tenants/:tenantId/setup-subaccount - create the school's Paystack Subaccount
// so their fee income settles directly into their own bank account (Super Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:tenantId/setup-subaccount', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: 'accountNumber and bankCode are required' });
    }

    const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const subaccount = await createSubaccount({
      businessName: tenant.schoolName,
      bankCode,
      accountNumber,
    });

    tenant.settlementBank = bankCode;
    tenant.accountNumber = accountNumber;
    tenant.resolvedAccountName = subaccount.account_name || '';
    tenant.paystackSubaccountCode = subaccount.subaccount_code;
    await tenant.save();

    res.json({
      message: "Subaccount created — fee payments will now settle directly to this school's bank account.",
      tenant,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data?.message || 'Failed to create Paystack subaccount' });
  }
});

module.exports = router;