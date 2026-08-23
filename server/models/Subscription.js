const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // Link to tenant
  tenantId: { 
    type: String, 
    required: true 
  },
  
  // Plan details
  plan: {
    type: String,
    enum: ['trial', 'basic', 'professional', 'enterprise'],
    required: true
  },
  
  interval: {
    type: String,
    enum: ['monthly', 'yearly', 'trial'],
    required: true
  },
  
  // Pricing
  amount: { type: Number, required: true }, // in kobo (NGN) or cents
  currency: { type: String, default: 'NGN' },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing', 'incomplete'],
    default: 'trialing'
  },
  
  // Dates
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  trialStart: { type: Date },
  trialEnd: { type: Date },
  canceledAt: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  
  // Paystack integration
  paystackCustomerCode: { type: String },
  paystackSubscriptionCode: { type: String },
  paystackAuthorizationCode: { type: String },
  paystackPlanCode: { type: String },
  
  // Payment history
  lastPaymentDate: { type: Date },
  lastPaymentAmount: { type: Number },
  lastPaymentStatus: { type: String },
  nextPaymentDate: { type: Date },
  failedPaymentAttempts: { type: Number, default: 0 },
  
  // Billing details
  billingEmail: { type: String },
  billingName: { type: String },
  billingPhone: { type: String },
  
  // Metadata
  metadata: { type: Map, of: String },
  notes: { type: String }
}, { 
  timestamps: true 
});

// Indexes
subscriptionSchema.index({ tenantId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });
subscriptionSchema.index({ paystackSubscriptionCode: 1 });
subscriptionSchema.index({ nextPaymentDate: 1 });

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' || this.status === 'trialing';
};

// Method to check if subscription has expired
subscriptionSchema.methods.isExpired = function() {
  return new Date() > this.currentPeriodEnd;
};

// Method to check if payment is overdue
subscriptionSchema.methods.isOverdue = function() {
  return this.status === 'past_due';
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = async function(immediately = false) {
  if (immediately) {
    this.status = 'canceled';
    this.canceledAt = new Date();
  } else {
    this.cancelAtPeriodEnd = true;
  }
  await this.save();
};

// Method to reactivate subscription
subscriptionSchema.methods.reactivate = async function() {
  this.status = 'active';
  this.cancelAtPeriodEnd = false;
  this.canceledAt = null;
  await this.save();
};

// Static method to find active subscription for tenant
subscriptionSchema.statics.findActiveByTenant = function(tenantId) {
  return this.findOne({ 
    tenantId, 
    status: { $in: ['active', 'trialing'] } 
  });
};

// Static method to find expiring subscriptions
subscriptionSchema.statics.findExpiring = function(daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    status: { $in: ['active', 'trialing'] },
    currentPeriodEnd: { $lte: futureDate, $gte: new Date() }
  });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
