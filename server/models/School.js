const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support - one school per tenant
  name: { type: String, required: true, default: 'My School' },
  address: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  ca1Max: { type: Number, default: 20 },
  ca2Max: { type: Number, default: 20 },
  examMax: { type: Number, default: 60 },
  // WhatsApp Business API (Meta Cloud API) settings
  whatsappEnabled: { type: Boolean, default: false },
  whatsappPhoneNumberId: { type: String, default: '' }, // Meta Phone Number ID
  whatsappAccessToken: { type: String, default: '' },   // Meta System User Access Token
  whatsappBusinessAccountId: { type: String, default: '' }, // WABA ID
}, { timestamps: true });

// Indexes
schoolSchema.index({ tenantId: 1 }, { unique: true }); // One school per tenant

module.exports = mongoose.model('School', schoolSchema);
