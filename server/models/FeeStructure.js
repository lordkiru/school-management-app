const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },   // e.g. "Tuition Fee", "PTA Levy"
  amount: { type: Number, required: true, min: 0 },
}, { _id: true });

const feeStructureSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  classId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  term:     { type: String, required: true, enum: ['First Term', 'Second Term', 'Third Term'] },
  session:  { type: String, required: true },
  items:    { type: [feeItemSchema], default: [] },
}, { timestamps: true });

// A class can only have one fee structure per term/session per tenant
feeStructureSchema.index({ tenantId: 1, classId: 1, term: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
