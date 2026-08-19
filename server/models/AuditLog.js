const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true }, // Multi-tenant support
  action: { type: String, required: true }, // e.g. "delete"
  entityType: { type: String, required: true }, // e.g. "Fee"
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, // full record at time of deletion
  performedBy: { type: String }, // user id from the token
  performedAt: { type: Date, default: Date.now },
});

// Indexes
auditLogSchema.index({ tenantId: 1 }); // Filter by tenant
auditLogSchema.index({ tenantId: 1, performedAt: -1 }); // Sort by date per tenant
auditLogSchema.index({ tenantId: 1, entityType: 1 }); // Filter by tenant + entity type
auditLogSchema.index({ tenantId: 1, performedBy: 1 }); // Filter by tenant + user

module.exports = mongoose.model('AuditLog', auditLogSchema);
