const mongoose = require('mongoose');

const cbtAttemptSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'CbtTest', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  // Index into each question's options array; null/-1 means unanswered. Same length/order as
  // questionOrder below when set, otherwise the test's questions array at the time the attempt started.
  answers: { type: [Number], default: [] },
  // Per-student shuffled question order (question _ids from the test), set at start time when
  // the test has shuffleQuestions: true. Empty when shuffling is off — use the test's own order.
  questionOrder: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  score: { type: Number, default: null }, // raw marks earned, filled in on submit
  maxScore: { type: Number, default: null }, // total possible marks, snapshotted at submit time
  startedAt: { type: Date, required: true }, // server-stamped — the deadline source of truth
  submittedAt: { type: Date, default: null },
  autoSubmitted: { type: Boolean, default: false }, // true if the timer ran out before manual submit
  status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
}, { timestamps: true });

// Indexes for better query performance
cbtAttemptSchema.index({ tenantId: 1 }); // Filter by tenant
cbtAttemptSchema.index({ tenantId: 1, testId: 1, studentId: 1 }, { unique: true }); // One attempt per student per test
cbtAttemptSchema.index({ tenantId: 1, testId: 1 }); // Teacher: all attempts for a test
cbtAttemptSchema.index({ tenantId: 1, studentId: 1 }); // Student: their own attempts

module.exports = mongoose.model('CbtAttempt', cbtAttemptSchema);
