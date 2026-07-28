const express = require('express');
const router = express.Router();
const Score = require('../models/Score');

router.get('/', async (req, res) => {
  try {
    const scores = await Score.find()
      .populate('studentId')
      .populate('subjectId');
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const score = new Score(req.body);
    await score.save();
    res.status(201).json(score);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;