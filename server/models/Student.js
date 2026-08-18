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

// Indexes for better query performance
studentSchema.index({ admissionNumber: 1 }); // Already unique, but explicit index
studentSchema.index({ name: 'text' }); // Text search on name
studentSchema.index({ classId: 1 }); // Filter by class
studentSchema.index({ status: 1 }); // Filter by status
studentSchema.index({ createdAt: -1 }); // Sort by creation date

module.exports = mongoose.model('Student', studentSchema);
