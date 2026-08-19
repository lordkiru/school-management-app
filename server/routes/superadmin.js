const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const requireAuth = require('../middleware/auth');

// Middleware to check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Super admin only.' });
  }
  next();
};

// ============================================
// DASHBOARD OVERVIEW
// ============================================

// Get platform overview/statistics
router.get('/dashboard', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    // Get tenant statistics
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });
    const trialTenants = await Tenant.countDocuments({ status: 'trial' });
    const suspendedTenants = await Tenant.countDocuments({ status: 'suspended' });
    const cancelledTenants = await Tenant.countDocuments({ status: 'cancelled' });

    // Get subscription statistics
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const expiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
    
    // Get subscription by plan
    const subscriptionsByPlan = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    // Get total users across all tenants
    const totalUsers = await User.countDocuments();
    const totalStudents = await Student.countDocuments();

    // Get recent tenants (last 10)
    const recentTenants = await Tenant.find()
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate revenue (mock - you'd integrate with payment system)
    const monthlyRevenue = await Subscription.aggregate([
      { 
        $match: { 
          status: 'active',
          billingCycle: 'monthly'
        } 
      },
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overview: {
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        cancelledTenants,
        totalUsers,
        totalStudents,
        activeSubscriptions,
        expiredSubscriptions,
      },
      subscriptionsByPlan,
      recentTenants,
      monthlyRevenue,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TENANT MANAGEMENT
// ============================================

// Get all tenants with pagination and filters
router.get('/tenants', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } }
      ];
    }

    const tenants = await Tenant.find(query)
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Tenant.countDocuments(query);

    res.json({
      tenants,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get detailed tenant info
router.get('/tenants/:tenantId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.params.tenantId })
      .populate('ownerId', 'name email phone');

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get tenant statistics
    const userCount = await User.countDocuments({ tenantId: req.params.tenantId });
    const studentCount = await Student.countDocuments({ tenantId: req.params.tenantId });
    const totalRevenue = await Fee.aggregate([
      { $match: { tenantId: req.params.tenantId, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);

    // Get subscription info
    const subscription = await Subscription.findOne({ 
      tenantId: req.params.tenantId 
    }).sort({ createdAt: -1 });

    res.json({
      tenant,
      statistics: {
        userCount,
        studentCount,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      subscription,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update tenant status
router.patch('/tenants/:tenantId/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'suspended', 'trial', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.params.tenantId },
      { status },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ message: 'Tenant status updated', tenant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create new tenant/school (Super Admin)
router.post('/tenants/create', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { schoolName, ownerName, ownerEmail, ownerPassword, subdomain, plan = 'trial' } = req.body;

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
    const tenant = new Tenant({
      tenantId,
      name: schoolName,
      subdomain: subdomain || tenantId,
      status: plan === 'trial' ? 'trial' : 'active',
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

    // Create subscription
    const billingCycle = 'monthly';
    const startDate = new Date();
    const endDate = new Date();
    
    if (plan === 'trial') {
      endDate.setDate(endDate.getDate() + 14); // 14 days trial
    } else if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const subscription = new Subscription({
      tenantId,
      plan,
      billingCycle,
      status: 'active',
      startDate,
      endDate,
    });

    await subscription.save();

    res.status(201).json({
      message: 'School created successfully by super admin',
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status,
      },
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
      },
      subscription: {
        plan: subscription.plan,
        endDate: subscription.endDate,
      },
    });
  } catch (err) {
    console.error('Tenant creation error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Delete tenant (soft delete)
router.delete('/tenants/:tenantId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.params.tenantId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Also cancel their subscription
    await Subscription.updateMany(
      { tenantId: req.params.tenantId, status: 'active' },
      { status: 'cancelled', endDate: new Date() }
    );

    res.json({ message: 'Tenant cancelled successfully', tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete tenant and all data (DANGEROUS - use with caution)
router.delete('/tenants/:tenantId/permanent', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'DELETE_PERMANENTLY') {
      return res.status(400).json({ 
        error: 'Please confirm permanent deletion by sending { "confirm": "DELETE_PERMANENTLY" }' 
      });
    }

    const tenant = await Tenant.findOne({ tenantId: req.params.tenantId });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Delete all tenant data
    const Student = require('../models/Student');
    const Class = require('../models/Class');
    const Subject = require('../models/Subject');
    const Score = require('../models/Score');
    const Fee = require('../models/Fee');
    const Parent = require('../models/Parent');
    const School = require('../models/School');
    const Session = require('../models/Session');
    const Timetable = require('../models/Timetable');
    const AuditLog = require('../models/AuditLog');
    const Counter = require('../models/Counter');

    await Promise.all([
      User.deleteMany({ tenantId: req.params.tenantId }),
      Student.deleteMany({ tenantId: req.params.tenantId }),
      Class.deleteMany({ tenantId: req.params.tenantId }),
      Subject.deleteMany({ tenantId: req.params.tenantId }),
      Score.deleteMany({ tenantId: req.params.tenantId }),
      Fee.deleteMany({ tenantId: req.params.tenantId }),
      Parent.deleteMany({ tenantId: req.params.tenantId }),
      School.deleteMany({ tenantId: req.params.tenantId }),
      Session.deleteMany({ tenantId: req.params.tenantId }),
      Timetable.deleteMany({ tenantId: req.params.tenantId }),
      AuditLog.deleteMany({ tenantId: req.params.tenantId }),
      Counter.deleteMany({ tenantId: req.params.tenantId }),
      Subscription.deleteMany({ tenantId: req.params.tenantId }),
      Tenant.deleteOne({ tenantId: req.params.tenantId }),
    ]);

    res.json({ 
      message: 'Tenant and all associated data permanently deleted',
      tenantId: req.params.tenantId,
      tenantName: tenant.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

// Get all subscriptions
router.get('/subscriptions', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, plan } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    const subscriptions = await Subscription.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscription.countDocuments(query);

    // Populate tenant info
    const populatedSubscriptions = await Promise.all(
      subscriptions.map(async (sub) => {
        const tenant = await Tenant.findOne({ tenantId: sub.tenantId });
        return {
          ...sub.toObject(),
          tenant: tenant ? { name: tenant.name, subdomain: tenant.subdomain } : null
        };
      })
    );

    res.json({
      subscriptions: populatedSubscriptions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update subscription status
router.patch('/subscriptions/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'cancelled', 'expired', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ message: 'Subscription status updated', subscription });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

// Get all users across all tenants
router.get('/users', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, tenantId, search } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (tenantId) query.tenantId = tenantId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ANALYTICS & REPORTS
// ============================================

// Get platform analytics
router.get('/analytics', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // New tenants over time
    const newTenants = await Tenant.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Active subscriptions over time
    const subscriptionTrends = await Subscription.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            plan: '$plan'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Tenant status distribution
    const tenantStatusDistribution = await Tenant.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      newTenants,
      subscriptionTrends,
      tenantStatusDistribution,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export platform data (for reporting)
router.get('/export', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { type = 'tenants' } = req.query;

    let data;
    switch (type) {
      case 'tenants':
        data = await Tenant.find().populate('ownerId', 'name email');
        break;
      case 'subscriptions':
        data = await Subscription.find();
        break;
      case 'users':
        data = await User.find().select('-password');
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    res.json({ data, exportedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
