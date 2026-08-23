const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  name: { type: String, required: true }, // e.g. "JSS1 Gold"
  level: { type: String, required: true }, // e.g. "JSS1"
  section: {
    type: String,
    enum: ['Creche', 'Kindergarten', 'Nursery', 'Primary', 'Secondary'],
    required: true,
  },
}, { timestamps: true });

// Indexes for better query performance
classSchema.index({ tenantId: 1 }); // Filter by tenant
classSchema.index({ tenantId: 1, name: 1 }, { unique: true }); // Class name unique per tenant
classSchema.index({ tenantId: 1, section: 1 }); // Filter by tenant + section
classSchema.index({ tenantId: 1, level: 1 }); // Filter by tenant + level

module.exports = mongoose.model('Class', classSchema);
