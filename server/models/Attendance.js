const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late', 'Excused'],
    required: true,
  },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '' },
  // 24-hour HH:MM, only meaningful for Late students. Optional: a late alert is sent to the
  // parent only when the teacher recorded one.
  arrivalTime: {
    type: String,
    default: '',
    validate: { validator: (v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), message: 'arrivalTime must be HH:MM (24-hour)' },
  },
}, { timestamps: true });

// Indexes
attendanceSchema.index({ tenantId: 1 });
attendanceSchema.index({ tenantId: 1, classId: 1, date: 1 });
attendanceSchema.index({ tenantId: 1, studentId: 1 });
// Prevent duplicate attendance record for same student on same day (unique)
attendanceSchema.index({ tenantId: 1, studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
