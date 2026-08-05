const mongoose = require('mongoose');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const timetableSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  dayOfWeek: { type: String, enum: DAYS, required: true },
  startTime: { type: String, required: true }, // e.g. "08:00"
  endTime: { type: String, required: true },   // e.g. "08:40"
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);