const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g. "delete"
  entityType: { type: String, required: true }, // e.g. "Fee"
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, // full record at time of deletion
  performedBy: { type: String }, // user id from the token
  performedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);