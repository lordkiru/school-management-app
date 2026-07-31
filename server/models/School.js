const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'My School' },
  address: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('School', schoolSchema);