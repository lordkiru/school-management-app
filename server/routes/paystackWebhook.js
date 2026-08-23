const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Fee = require('../models/Fee');

// Paystack calls this automatically when a payment event happens
router.post('/', express.json(), async (req, res) => {
  try {
    // Verify this request genuinely came from Paystack, not an impersonator
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { feeId } = event.data.metadata;
      const amountPaid = event.data.amount / 100; // convert kobo back to naira
      const reference = event.data.reference;

      const fee = await Fee.findById(feeId);
      if (fee) {
        // Idempotency check: skip if this reference has already been recorded
        const alreadyProcessed = fee.payments && fee.payments.some(p => p.reference === reference);
        if (!alreadyProcessed) {
          fee.amountPaid += amountPaid;
          fee.payments.push({
            amount: amountPaid,
            reference,
            paymentMethod: 'Paystack',
            paymentDate: new Date(event.data.paid_at || Date.now()),
          });
          await fee.save();
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;
