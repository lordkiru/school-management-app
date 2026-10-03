const express = require('express');
const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/webhook', (req, res) => {
  console.log('WhatsApp event received:', JSON.stringify(req.body, null, 2));

  // Delivery outcomes (sent / delivered / read / failed) arrive here, not in the send
  // response — a message Meta accepted can still fail later. One readable line per status.
  try {
    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        for (const s of change.value?.statuses || []) {
          const errors = s.errors?.length ? ` errors: ${JSON.stringify(s.errors)}` : '';
          console.log(`[WhatsApp] status "${s.status}" for message ${s.id} to ${s.recipient_id}${errors}`);
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] could not parse webhook statuses:', err.message);
  }
  res.sendStatus(200);
});

module.exports = router;