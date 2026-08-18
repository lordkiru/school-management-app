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

// Indexes for better query performance
scoreSchema.index({ studentId: 1, subjectId: 1, term: 1, session: 1 }, { unique: true }); // Existing compound index
scoreSchema.index({ studentId: 1 }); // Query all scores for a student
scoreSchema.index({ subjectId: 1 }); // Query scores by subject
scoreSchema.index({ term: 1, session: 1 }); // Query scores by term/session
scoreSchema.index({ createdAt: -1 }); // Sort by creation date

scoreSchema.virtual('total').get(function () {
  return this.ca1 + this.ca2 + this.exam;
});

module.exports = mongoose.model('Score', scoreSchema);