const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  name: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  admissionNumber: { type: String, required: true },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['Male', 'Female'] },
  status: {
    type: String,
    enum: ['Active', 'Graduated', 'Withdrawn', 'Transferred'],
    default: 'Active',
  },
  walletBalance: { type: Number, default: 0, min: 0 }, // Credit from fee overpayments, auto-applied to future fees
}, { timestamps: true });

// Indexes for better query performance
studentSchema.index({ tenantId: 1 }); // Filter by tenant
studentSchema.index({ tenantId: 1, admissionNumber: 1 }, { unique: true }); // Admission number unique per tenant
studentSchema.index({ tenantId: 1, classId: 1 }); // Filter by tenant + class
studentSchema.index({ tenantId: 1, status: 1 }); // Filter by tenant + status
studentSchema.index({ tenantId: 1, name: 'text' }); // Text search per tenant
studentSchema.index({ createdAt: -1 }); // Sort by creation date

module.exports = mongoose.model('Student', studentSchema);