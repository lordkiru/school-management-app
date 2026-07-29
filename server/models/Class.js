const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g. "JSS1 Gold"
  level: { type: String, required: true }, // e.g. "JSS1"
  section: {
    type: String,
    enum: ['Creche', 'Kindergarten', 'Nursery', 'Primary', 'Secondary'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);