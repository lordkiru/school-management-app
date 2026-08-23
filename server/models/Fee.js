const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'Card', 'Paystack', 'Other'], default: 'Cash' },
  reference: { type: String }, // Transaction reference
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Staff who received payment
  notes: { type: String },
});

const feeSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
  session: { type: String, required: true },
  amountExpected: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  payments: [paymentSchema], // Payment history
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
feeSchema.index({ tenantId: 1 }); // Filter by tenant
feeSchema.index({ tenantId: 1, studentId: 1, term: 1, session: 1 }, { unique: true }); // Unique per tenant
feeSchema.index({ tenantId: 1, studentId: 1 }); // Query all fees for a student per tenant
feeSchema.index({ tenantId: 1, term: 1, session: 1 }); // Query fees by term/session per tenant
feeSchema.index({ createdAt: -1 }); // Sort by creation date

feeSchema.virtual('balance').get(function () {
  return this.amountExpected - this.amountPaid;
});

feeSchema.virtual('status').get(function () {
  const balance = this.amountExpected - this.amountPaid;
  if (balance <= 0) return 'Fully Paid';
  if (this.amountPaid > 0) return 'Partly Paid';
  return 'Not Paid';
});

module.exports = mongoose.model('Fee', feeSchema);
