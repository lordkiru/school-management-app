const requireAuth = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Score = require('../models/Score');
const Fee = require('../models/Fee');
const computeGrade = require('../utils/grading');

// Get all students
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { admissionNumber: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const students = await Student.find(filter).populate('classId');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one student with their scores and fees
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('classId');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const scoresRaw = await Score.find({ studentId: req.params.id }).populate({
      path: 'subjectId',
      populate: { path: 'classId' },
    });

    const scores = scoresRaw.map((score) => {
      const scoreObj = score.toObject();
      const section = score.subjectId?.classId?.section;
      scoreObj.grade = computeGrade(scoreObj.total, section);
      return scoreObj;
    });

    const fees = await Fee.find({ studentId: req.params.id });

    res.json({ student, scores, fees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new student
router.post('/', requireAuth, async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a student
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a student and all their related records
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    await Score.deleteMany({ studentId: req.params.id });
    await Fee.deleteMany({ studentId: req.params.id });

    res.json({ message: 'Student and all related records deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;