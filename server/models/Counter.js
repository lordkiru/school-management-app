const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true }, // Multi-tenant support
  name: { type: String, required: true }, // e.g. "admissionNumber"
  value: { type: Number, default: 0 },
});

// Indexes - counter name unique per tenant
counterSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
