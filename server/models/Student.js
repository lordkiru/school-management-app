const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  admissionNumber: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['Active', 'Graduated', 'Withdrawn', 'Transferred'],
    default: 'Active',
  },
}, { timestamps: true });
module.exports = mongoose.model('Student', studentSchema);