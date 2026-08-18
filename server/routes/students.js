const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Score = require('../models/Score');
const Fee = require('../models/Fee');
const computeGrade = require('../utils/grading');
const getNextSequence = require('../utils/getNextSequence');
const School = require('../models/School');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validateStudent, validateMongoId } = require('../middleware/validators');

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

// Public results lookup — no login required
router.get('/public/results/:admissionNumber', apiLimiter, async (req, res) => {
  try {
    const student = await Student.findOne({ admissionNumber: req.params.admissionNumber }).populate('classId');
    if (!student) return res.status(404).json({ error: 'No student found with that admission number' });

    const school = await School.findOne();
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const scoresRaw = await Score.find({ studentId: student._id }).populate({
      path: 'subjectId',
      populate: { path: 'classId' },
    });

    const scores = scoresRaw.map((score) => {
      const scoreObj = score.toObject();
      const section = score.subjectId?.classId?.section;
      scoreObj.grade = computeGrade(scoreObj.total, section, maxTotal);
      return scoreObj;
    });

    res.json({
      student: {
        name: student.name,
        admissionNumber: student.admissionNumber,
        className: student.classId?.name || '—',
      },
      scores,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one student with their scores and fees
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('classId');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const school = await School.findOne();
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const scoresRaw = await Score.find({ studentId: req.params.id }).populate({
      path: 'subjectId',
      populate: { path: 'classId' },
    });

    const scores = scoresRaw.map((score) => {
      const scoreObj = score.toObject();
      const section = score.subjectId?.classId?.section;
      scoreObj.grade = computeGrade(scoreObj.total, section, maxTotal);
      return scoreObj;
    });

    const fees = await Fee.find({ studentId: req.params.id });

    res.json({ student, scores, fees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new student
router.post('/', requireAuth, requireRole('proprietor', 'admin'), validateStudent, async (req, res) => {
  try {
    const nextNumber = await getNextSequence('admissionNumber');
    const admissionNumber = `ADM${String(nextNumber).padStart(5, '0')}`;

    const student = new Student({
      ...req.body,
      admissionNumber,
    });
    await student.save();

    if (student.classId) {
      const classmates = await Student.find({ classId: student.classId, _id: { $ne: student._id } });
      const classmateIds = classmates.map((c) => c._id);

      if (classmateIds.length > 0) {
        const existingFee = await Fee.findOne({ studentId: { $in: classmateIds } }).sort({ createdAt: -1 });

        if (existingFee) {
          const alreadyHasFee = await Fee.findOne({
            studentId: student._id,
            term: existingFee.term,
            session: existingFee.session,
          });

          if (!alreadyHasFee) {
            await Fee.create({
              studentId: student._id,
              term: existingFee.term,
              session: existingFee.session,
              amountExpected: existingFee.amountExpected,
            });
          }
        }
      }
    }

    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Promote every active student in one class to another class
router.patch('/promote-class', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { toClassId, studentIds } = req.body;

    if (!toClassId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'toClassId and a non-empty studentIds array are required' });
    }

    const result = await Student.updateMany(
      { _id: { $in: studentIds }, status: 'Active' },
      { $set: { classId: toClassId } }
    );

    res.json({
      message: `Promoted ${result.modifiedCount} student(s) to the new class.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a student
router.patch('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
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
router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
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