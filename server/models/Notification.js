const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  type: {
    type: String,
    enum: ['absence_alert', 'fee_reminder', 'result_published', 'custom_broadcast', 'custom_individual'],
    required: true,
  },
  channel: { type: String, default: 'whatsapp' },
  recipientPhone: { type: String, required: true },
  recipientName: { type: String, default: '' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', default: null },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  message: { type: String, required: true },
  status: {
    type: String,
    enum: ['sent', 'failed', 'queued'],
    default: 'queued',
  },
  metaMessageId: { type: String, default: '' }, // WhatsApp message ID from Meta API
  errorMessage: { type: String, default: '' },
  sentAt: { type: Date, default: null },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = system/cron
}, { timestamps: true });

notificationSchema.index({ tenantId: 1 });
notificationSchema.index({ tenantId: 1, type: 1 });
notificationSchema.index({ tenantId: 1, parentId: 1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
