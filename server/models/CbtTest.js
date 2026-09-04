const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: (arr) => arr.length >= 2 && arr.length <= 6,
      message: 'Each question needs between 2 and 6 options',
    },
  },
  correctIndex: { type: Number, required: true },
  marks: { type: Number, default: 1, min: 1 },
}, { _id: true });

const cbtTestSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  title: { type: String, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
  session: { type: String, required: true },
  durationMinutes: { type: Number, required: true, min: 1, max: 300 },
  // Which CA slot on Score this test's auto-marked result feeds into
  caSlot: { type: String, enum: ['ca1', 'ca2'], required: true },
  questions: {
    type: [questionSchema],
    validate: {
      validator: (arr) => arr.length > 0,
      message: 'A test needs at least one question',
    },
  },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  isArchived: { type: Boolean, default: false }, // hides a test (even published) without deleting its attempts/scores
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Indexes for better query performance
cbtTestSchema.index({ tenantId: 1 }); // Filter by tenant
cbtTestSchema.index({ tenantId: 1, classId: 1, status: 1 }); // Student: available tests for their class
cbtTestSchema.index({ tenantId: 1, subjectId: 1 }); // Filter by tenant + subject
cbtTestSchema.index({ tenantId: 1, createdBy: 1 }); // Filter by tenant + teacher
cbtTestSchema.index({ createdAt: -1 }); // Sort by creation date

// Total marks available on this test — used to scale the raw score against caXMax on submit
cbtTestSchema.virtual('totalPossibleMarks').get(function () {
  return this.questions.reduce((sum, q) => sum + q.marks, 0);
});

cbtTestSchema.set('toJSON', { virtuals: true });
cbtTestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CbtTest', cbtTestSchema);
