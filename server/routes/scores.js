const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const Score = require('../models/Score');
const computeGrade = require('../utils/grading');
const School = require('../models/School');
const Student = require('../models/Student');

router.get('/', requireAuth, async (req, res) => {
  try {
    const school = await School.findOne();
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const scores = await Score.find()
      .populate('studentId')
      .populate({
        path: 'subjectId',
        populate: { path: 'classId' },
      });

    const withGrades = scores.map((score) => {
      const scoreObj = score.toObject();
      const section = score.subjectId?.classId?.section;
      scoreObj.grade = computeGrade(scoreObj.total, section, maxTotal);
      return scoreObj;
    });

    res.json(withGrades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const score = new Score(req.body);
    await score.save();
    res.status(201).json(score);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const updated = await Score.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: 'Score not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const deleted = await Score.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Score not found' });
    res.json({ message: 'Score deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all scores for every active student in a class, for a given term/session
router.get('/report-card', requireAuth, async (req, res) => {
  try {
    const { classId, term, session } = req.query;

    if (!classId || !term || !session) {
      return res.status(400).json({ error: 'classId, term, and session are required' });
    }

    const school = await School.findOne();
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const students = await Student.find({ classId, status: 'Active' }).populate('classId');

    const results = [];

    for (const student of students) {
      const scoresRaw = await Score.find({ studentId: student._id, term, session }).populate({
        path: 'subjectId',
        populate: { path: 'classId' },
      });

      const scores = scoresRaw.map((score) => {
        const scoreObj = score.toObject();
        const section = score.subjectId?.classId?.section;
        scoreObj.grade = computeGrade(scoreObj.total, section, maxTotal);
        return scoreObj;
      });

      const totalScore = scores.reduce((sum, s) => sum + s.total, 0);

      results.push({
        student: {
          id: student._id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: student.classId?.name || '—',
        },
        scores,
        totalScore,
      });
    }

    // Rank by total score, highest first, for class position
    results.sort((a, b) => b.totalScore - a.totalScore);
    results.forEach((r, i) => {
      r.position = i + 1;
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;