const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const AuditLog = require('../models/AuditLog');
const Student = require('../models/Student');
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const { SELF_SERVICE_PLAN_NAMES } = require('../config/plans');

// One academic term, for a newly-activated self-service subscription period.
const TERM_LENGTH_MONTHS = 4;

// Paystack calls this automatically when a payment event happens
router.post('/', async (req, res) => {
  try {
    // Verify this request genuinely came from Paystack, not an impersonator
    const signature = req.headers['x-paystack-signature'];
    const expectedHash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.alloc(0))
      .digest();
    const signatureBuffer = typeof signature === 'string' && /^[a-f0-9]{128}$/i.test(signature)
      ? Buffer.from(signature, 'hex')
      : null;

    if (
      !signatureBuffer ||
      !crypto.timingSafeEqual(signatureBuffer, expectedHash)
    ) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const metadata = event.data.metadata || {};
      const amountPaid = event.data.amount / 100; // convert kobo back to naira
      const reference = event.data.reference;

      // The explicit `type` tag is what makes this split safe — a fee payment
      // can only ever reach the fee branch, a subscription payment can only
      // ever reach the subscription branch. Nothing here is inferred from
      // which other fields happen to be present.
      if (metadata.type === 'subscription') {
        await handleSubscriptionPayment(metadata, amountPaid, reference, event.data.paid_at);
      } else if (metadata.type === 'fee' || metadata.feeId) {
        // The `metadata.feeId` fallback exists only so a fee payment already
        // in flight at the moment this deploy goes live (initiated by the old
        // code, which never set `type`) still gets credited correctly.
        await handleFeePayment(metadata, amountPaid, reference, event.data.paid_at);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Fee payment — credits a Fee record, capped at its outstanding balance; any
// overpayment goes to the student's wallet.
// ─────────────────────────────────────────────────────────────────────────────
async function handleFeePayment(metadata, amountPaid, reference, paidAt) {
  const { feeId } = metadata;
  const fee = await Fee.findById(feeId);
  if (!fee) return;

  const alreadyProcessed = fee.payments && fee.payments.some((p) => p.reference === reference);
  if (alreadyProcessed) return;

  const balance = fee.amountExpected - fee.amountPaid;
  // Cap what's applied to this fee at the outstanding balance; anything beyond that is an
  // overpayment — same handling as a manual payment in PATCH /fees/:id/pay.
  const appliedToFee = Math.max(Math.min(amountPaid, balance), 0);
  const excess = amountPaid - appliedToFee;

  fee.amountPaid += appliedToFee;
  // Record the full amount received (not just what was applied) so the history
  // reflects what actually changed hands — the audit log explains the split.
  fee.payments.push({
    amount: amountPaid,
    reference,
    paymentMethod: 'Paystack',
    paymentDate: new Date(paidAt || Date.now()),
  });
  await fee.save();

  await AuditLog.create({
    tenantId: fee.tenantId,
    action: 'payment',
    entityType: 'Fee',
    entityId: fee._id,
    snapshot: {
      amountPaid,
      appliedToFee,
      excess,
      reference,
      paymentMethod: 'Paystack',
      newAmountPaid: fee.amountPaid,
      amountExpected: fee.amountExpected,
    },
    performedBy: 'system:paystack-webhook', // no authenticated user on a webhook
  });

  if (excess > 0) {
    // Route the overpayment into the student's wallet as credit for a future term,
    // rather than letting it silently inflate amountPaid past what was actually owed.
    const student = await Student.findOneAndUpdate(
      { _id: fee.studentId, tenantId: fee.tenantId },
      { $inc: { walletBalance: excess } },
      { new: true }
    );

    await AuditLog.create({
      tenantId: fee.tenantId,
      action: 'update',
      entityType: 'Student',
      entityId: fee.studentId,
      snapshot: {
        reason: 'Fee overpayment credited to wallet',
        feeId: fee._id,
        overpaymentAmount: excess,
        newWalletBalance: student?.walletBalance,
      },
      performedBy: 'system:paystack-webhook',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription payment — this is where a plan actually activates. POST
// /subscriptions/upgrade only ever initiates the payment; it never writes
// status: 'active' itself. That only happens here, after Paystack confirms
// the money arrived.
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionPayment(metadata, amountPaid, reference, paidAt) {
  const { plan, tenantId } = metadata;

  if (!tenantId || !SELF_SERVICE_PLAN_NAMES.includes(plan)) {
    console.error('[webhook] subscription charge.success with invalid/missing metadata:', metadata);
    return;
  }

  // Idempotency: Paystack can resend the same event — never double-activate
  // a period for one payment.
  const alreadyProcessed = await Subscription.findOne({ tenantId, paystackReference: reference });
  if (alreadyProcessed) return;

  // End whatever subscription was previously active for this tenant — a new
  // paid period is starting.
  await Subscription.updateMany(
    { tenantId, status: 'active' },
    { status: 'canceled', canceledAt: new Date() }
  );

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + TERM_LENGTH_MONTHS);

  await Subscription.create({
    tenantId,
    plan,
    interval: 'termly',
    amount: amountPaid,
    currency: 'NGN',
    status: 'active',
    currentPeriodStart,
    currentPeriodEnd,
    paystackReference: reference,
    lastPaymentDate: new Date(paidAt || Date.now()),
    lastPaymentAmount: amountPaid,
    lastPaymentStatus: 'success',
  });

  // This is the actual moment of activation — a locked-out, trial-expired
  // school regains full access only once this write happens.
  await Tenant.findOneAndUpdate(
    { tenantId },
    {
      status: 'active',
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      isTrialing: false,
    }
  );
}

module.exports = router;
