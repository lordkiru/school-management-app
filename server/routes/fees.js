const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');

router.get('/', async (req, res) => {
  try {
    const fees = await Fee.find().populate('studentId');
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const fee = new Fee(req.body);
    await fee.save();
    res.status(201).json(fee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record a payment against an existing fee record
router.patch('/:id/pay', async (req, res) => {
  try {
    const { amount } = req.body;
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    fee.amountPaid += amount;
    await fee.save();
    res.json(fee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Fee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Fee record not found' });
    res.json({ message: 'Fee record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;