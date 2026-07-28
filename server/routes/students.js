const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Score = require('../models/Score');
const Fee = require('../models/Fee');

// Get all students
router.get('/', async (req, res) => {
  try {
    const students = await Student.find().populate('classId');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get one student with their scores and fees
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('classId');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const scores = await Score.find({ studentId: req.params.id }).populate('subjectId');
    const fees = await Fee.find({ studentId: req.params.id });

    res.json({ student, scores, fees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new student
router.post('/', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Update a student
router.patch('/:id', async (req, res) => {
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

// Delete a student
router.delete('/:id', async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;