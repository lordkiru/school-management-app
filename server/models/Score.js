const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
  session: { type: String, required: true },
  ca1: { type: Number, default: 0 },
  ca2: { type: Number, default: 0 },
  exam: { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

scoreSchema.index({ studentId: 1, subjectId: 1, term: 1, session: 1 }, { unique: true });

scoreSchema.virtual('total').get(function () {
  return this.ca1 + this.ca2 + this.exam;
});

scoreSchema.virtual('grade').get(function () {
  const total = this.ca1 + this.ca2 + this.exam;
  if (total >= 75) return 'A1';
  if (total >= 70) return 'B2';
  if (total >= 65) return 'B3';
  if (total >= 60) return 'C4';
  if (total >= 55) return 'C5';
  if (total >= 50) return 'C6';
  if (total >= 45) return 'D7';
  if (total >= 40) return 'E8';
  return 'F9';
});

module.exports = mongoose.model('Score', scoreSchema);