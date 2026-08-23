const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  name: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Indexes for better query performance
subjectSchema.index({ tenantId: 1 }); // Filter by tenant
subjectSchema.index({ tenantId: 1, classId: 1 }); // Filter by tenant + class
subjectSchema.index({ tenantId: 1, teacherId: 1 }); // Filter by tenant + teacher
subjectSchema.index({ tenantId: 1, name: 1, classId: 1 }, { unique: true }); // Subject name unique per class per tenant

module.exports = mongoose.model('Subject', subjectSchema);
