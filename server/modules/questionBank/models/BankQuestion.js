const mongoose = require('mongoose');

const EXAMS = ['WAEC', 'NECO'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const STATUSES = ['draft', 'approved', 'rejected'];
const POOLS = ['public', 'reserved'];

// A question in the shared Lemida bank. It belongs to Lemida, not to any school, so there is
// deliberately no tenantId here.
const bankQuestionSchema = new mongoose.Schema({
  externalId: { type: String, required: true, unique: true, trim: true }, // e.g. "WM-001"
  exams: {
    type: [{ type: String, enum: EXAMS }],
    validate: { validator: (arr) => arr.length >= 1, message: 'A question needs at least one exam' },
  },
  subject: { type: String, required: true, trim: true },
  section: { type: String, trim: true },
  topic: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: DIFFICULTIES, default: 'medium' },

  text: { type: String, required: true, trim: true },
  options: {
    type: [String],
    validate: {
      validator: (arr) => {
        if (arr.length < 2 || arr.length > 6) return false;
        const cleaned = arr.map((o) => String(o).trim().toLowerCase());
        return cleaned.every(Boolean) && new Set(cleaned).size === cleaned.length;
      },
      message: 'Options must be 2 to 6 non-empty, different answers',
    },
  },
  correctIndex: {
    type: Number,
    required: true,
    validate: {
      validator(value) {
        return Number.isInteger(value) && value >= 0 && value < (this.options ? this.options.length : 0);
      },
      message: 'correctIndex must point at one of the options',
    },
  },
  explanation: { type: String, required: true, trim: true },

  status: { type: String, enum: STATUSES, default: 'draft' },
  // 'reserved' questions are only for school mocks and are never served to the student Exam Prep app.
  pool: { type: String, enum: POOLS, default: 'public' },

  batch: { type: String, trim: true },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  reviewNotes: { type: String, trim: true },
  createdBy: { type: String },
}, { timestamps: true, collection: 'bankquestions' });

bankQuestionSchema.path('exams').default(() => [...EXAMS]);

bankQuestionSchema.index({ subject: 1, topic: 1, status: 1 });
bankQuestionSchema.index({ status: 1, pool: 1, subject: 1 });

const BankQuestion = mongoose.models.BankQuestion || mongoose.model('BankQuestion', bankQuestionSchema);

module.exports = BankQuestion;
module.exports.EXAMS = EXAMS;
module.exports.DIFFICULTIES = DIFFICULTIES;
module.exports.STATUSES = STATUSES;
module.exports.POOLS = POOLS;
