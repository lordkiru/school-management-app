const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  name: { type: String, required: true }, // e.g. "2025/2026"
  isCurrent: { type: Boolean, default: false },
}, { timestamps: true });

// Indexes
sessionSchema.index({ tenantId: 1 }); // Filter by tenant
sessionSchema.index({ tenantId: 1, name: 1 }, { unique: true }); // Session name unique per tenant
sessionSchema.index({ tenantId: 1, isCurrent: 1 }); // Find current session per tenant

module.exports = mongoose.model('Session', sessionSchema);
