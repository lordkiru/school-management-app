const mongoose = require('mongoose');

// Stores a class teacher's remark for a student for a specific term/session.
// Kept separate from Score to avoid duplication (one remark per student per term,
// not one per subject row).
const teacherRemarkSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
  session: { type: String, required: true },
  remark: { type: String, default: '', maxlength: 500 },
  principalRemark: { type: String, default: '', maxlength: 500 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// One remark per student per term per session per tenant
teacherRemarkSchema.index(
  { tenantId: 1, studentId: 1, term: 1, session: 1 },
  { unique: true }
);
teacherRemarkSchema.index({ tenantId: 1, classId: 1, term: 1, session: 1 });

module.exports = mongoose.model('TeacherRemark', teacherRemarkSchema);
