const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
  session: { type: String, required: true },
  amountExpected: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

feeSchema.index({ studentId: 1, term: 1, session: 1 }, { unique: true });

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