const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support - one school per tenant
  name: { type: String, required: true, default: 'My School' },
  address: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  ca1Max: { type: Number, default: 20 },
  ca2Max: { type: Number, default: 20 },
  examMax: { type: Number, default: 60 },
}, { timestamps: true });

// Indexes
schoolSchema.index({ tenantId: 1 }, { unique: true }); // One school per tenant

module.exports = mongoose.model('School', schoolSchema);
