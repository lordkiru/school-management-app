const mongoose = require('mongoose');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const timetableSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  dayOfWeek: { type: String, enum: DAYS, required: true },
  startTime: { type: String, required: true }, // e.g. "08:00"
  endTime: { type: String, required: true },   // e.g. "08:40"
}, { timestamps: true });

// Indexes
timetableSchema.index({ tenantId: 1 }); // Filter by tenant
timetableSchema.index({ tenantId: 1, classId: 1 }); // Filter by tenant + class
timetableSchema.index({ tenantId: 1, classId: 1, dayOfWeek: 1 }); // Filter by tenant + class + day

module.exports = mongoose.model('Timetable', timetableSchema);
