const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const parentSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true }, // Multi-tenant support
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  phone: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  }],
}, {
  timestamps: true,
});

// Indexes for better query performance
parentSchema.index({ tenantId: 1 }); // Filter by tenant
parentSchema.index({ tenantId: 1, email: 1 }, { unique: true }); // Email unique per tenant
parentSchema.index({ tenantId: 1, phone: 1 }); // Filter by tenant + phone
parentSchema.index({ createdAt: -1 }); // Sort by creation date

// Before saving, hash the password if it's new or changed
parentSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method to check a login password against the stored hash
parentSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Parent', parentSchema);
