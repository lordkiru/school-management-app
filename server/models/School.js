const mongoose = require('mongoose');
const { SCHOOL_LEVELS } = require('../config/schoolLevels');

const schoolSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Multi-tenant support - one school per tenant
  name: { type: String, required: true, default: 'My School' },
  address: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  ca1Max: { type: Number, default: 20 },
  ca2Max: { type: Number, default: 20 },
  examMax: { type: Number, default: 60 },
  // Which levels/sections this school actually operates — purely a display filter
  // for the dashboard and class dropdowns; classes/students in a deselected level
  // are never touched, just hidden. Defaults to all 5 so existing schools (and
  // any document saved before this field existed) see everything unchanged.
  schoolLevels: {
    type: [String],
    enum: SCHOOL_LEVELS,
    default: SCHOOL_LEVELS,
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'At least one school level must be selected',
    },
  },
  // WhatsApp Business API (Meta Cloud API) settings
  whatsappEnabled: { type: Boolean, default: false },
  whatsappPhoneNumberId: { type: String, default: '' }, // Meta Phone Number ID
  whatsappAccessToken: { type: String, default: '' },   // Meta System User Access Token
  whatsappBusinessAccountId: { type: String, default: '' }, // WABA ID
  // Termii SMS settings
  smsEnabled: { type: Boolean, default: false },
  termiiWhatsappEnabled: { type: Boolean, default: false }, // WhatsApp via Termii (reuses same key)
  smsApiKey: { type: String, default: '' },      // Termii API key
  smsSenderId: { type: String, default: '' },    // Approved sender ID (e.g. "GREENWOOD")
}, { timestamps: true });

// Indexes
schoolSchema.index({ tenantId: 1 }, { unique: true }); // One school per tenant

module.exports = mongoose.model('School', schoolSchema);
