const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Tenant identification
  tenantId: { 
    type: String, 
    required: true, 
    unique: true
  },
  
  // School information
  schoolName: { 
    type: String, 
    required: true 
  },
  
  // The user (proprietor/super_admin) who owns/administers this tenant
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Subdomain for accessing the school (e.g., "greenwood" for greenwood.schoolsaas.com)
  subdomain: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  
  // Optional custom domain (e.g., "school.greenwood.edu")
  customDomain: { 
    type: String, 
    unique: true, 
    sparse: true,
    lowercase: true,
    trim: true
  },
  
  // Subscription & Billing
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'basic', 'professional', 'enterprise'],
    default: 'trial'
  },
  
  subscriptionStatus: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing', 'suspended'],
    default: 'trialing'
  },
  
  subscriptionStartDate: { type: Date },
  subscriptionEndDate: { type: Date },
  trialEndsAt: { type: Date },
  
  // Plan limits
  limits: {
    maxStudents: { type: Number, default: 50 },
    maxStaff: { type: Number, default: 10 },
    maxStorage: { type: Number, default: 1024 }, // MB
    features: {
      sms: { type: Boolean, default: false },
      advancedReporting: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      whiteLabel: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    }
  },
  
  // Current usage tracking
  usage: {
    currentStudents: { type: Number, default: 0 },
    currentStaff: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // MB
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Primary contact information
  primaryContact: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },
  
  // Billing information
  billingEmail: { type: String },
  
  // School settings
  settings: {
    timezone: { type: String, default: 'Africa/Lagos' },
    currency: { type: String, default: 'NGN' },
    academicYearStart: { type: String, default: 'September' },
    logo: { type: String },
    primaryColor: { type: String, default: '#4F46E5' },
    language: { type: String, default: 'en' }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  
  // Paystack Subaccount — lets fee payments settle directly into the school's
  // own bank account (0% platform commission; Paystack's own fee still applies)
  settlementBank: { type: String },       // Paystack bank code, e.g. "058" for GTBank
  accountNumber: { type: String },
  resolvedAccountName: { type: String },  // Verified via Paystack's Resolve Account Number API
  paystackSubaccountCode: { type: String }, // e.g. "ACCT_xxxxx", set once the subaccount is created

  // Metadata
  onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  onboardedAt: { type: Date, default: Date.now },
  metadata: { type: Map, of: String },
  
  // Notes (for admin use)
  notes: { type: String }
}, { 
  timestamps: true 
});

// Indexes for performance
// Note: tenantId, subdomain, customDomain already indexed via unique:true on field definition
tenantSchema.index({ subscriptionStatus: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ subscriptionPlan: 1 });
tenantSchema.index({ 'primaryContact.email': 1 });

// Virtual for full URL
tenantSchema.virtual('url').get(function() {
  if (this.customDomain) {
    return `https://${this.customDomain}`;
  }
  return `https://${this.subdomain}.schoolsaas.com`;
});

// Method to check if tenant is active and subscription is valid
tenantSchema.methods.isActive = function() {
  if (this.status !== 'active') return false;
  if (this.subscriptionStatus === 'canceled') return false;
  if (this.subscriptionStatus === 'suspended') return false;
  return true;
};

// Method to check if trial has expired
tenantSchema.methods.isTrialExpired = function() {
  if (this.subscriptionStatus !== 'trialing') return false;
  if (!this.trialEndsAt) return false;
  return new Date() > this.trialEndsAt;
};

// Method to check if usage limit is reached
tenantSchema.methods.hasReachedLimit = function(resourceType) {
  if (resourceType === 'students') {
    return this.usage.currentStudents >= this.limits.maxStudents;
  }
  if (resourceType === 'staff') {
    return this.usage.currentStaff >= this.limits.maxStaff;
  }
  if (resourceType === 'storage') {
    return this.usage.storageUsed >= this.limits.maxStorage;
  }
  return false;
};

// Method to check if feature is available
tenantSchema.methods.hasFeature = function(featureName) {
  return this.limits.features[featureName] === true;
};

// Method to update usage
tenantSchema.methods.updateUsage = async function(resourceType, count) {
  if (resourceType === 'students') {
    this.usage.currentStudents = count;
  } else if (resourceType === 'staff') {
    this.usage.currentStaff = count;
  } else if (resourceType === 'storage') {
    this.usage.storageUsed = count;
  }
  this.usage.lastUpdated = new Date();
  await this.save();
};

// Static method to find by subdomain
tenantSchema.statics.findBySubdomain = function(subdomain) {
  return this.findOne({ subdomain, status: 'active' });
};

// Static method to find by custom domain
tenantSchema.statics.findByCustomDomain = function(domain) {
  return this.findOne({ customDomain: domain, status: 'active' });
};

module.exports = mongoose.model('Tenant', tenantSchema);