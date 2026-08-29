const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const Score = require('../models/Score');
const computeGrade = require('../utils/grading');
const School = require('../models/School');
const Student = require('../models/Student');
const { validateScore, validateMongoId } = require('../middleware/validators');

// Get scores — supports ?page=1&limit=50&classId=&term=&session=
router.get('/', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { page, limit, classId, term, session } = req.query;

    const usePagination = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));

    const school = await School.findOne({ tenantId: req.user.tenantId });
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const filter = { tenantId: req.user.tenantId };
    if (term) filter.term = term;
    if (session) filter.session = session;

    // If classId given, find all students in that class first
    if (classId) {
      const studentsInClass = await Student.find({ tenantId: req.user.tenantId, classId }).select('_id');
      filter.studentId = { $in: studentsInClass.map((s) => s._id) };
    }

    const query = Score.find(filter)
      .populate('studentId')
      .populate({ path: 'subjectId', populate: { path: 'classId' } });

    let scores;
    if (usePagination) {
      const total = await Score.countDocuments(filter);
      scores = await query.sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum);
      const withGrades = scores.map((score) => {
        const scoreObj = score.toObject();
        scoreObj.grade = computeGrade(scoreObj.total, score.subjectId?.classId?.section, maxTotal);
        return scoreObj;
      });
      return res.json({ scores: withGrades, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    }

    scores = await query;
    const withGrades = scores.map((score) => {
      const scoreObj = score.toObject();
      scoreObj.grade = computeGrade(scoreObj.total, score.subjectId?.classId?.section, maxTotal);
      return scoreObj;
    });
    res.json(withGrades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireActiveSubscription, requireRole('proprietor', 'admin', 'teacher'), validateScore, async (req, res) => {
  try {
    const score = new Score({
      ...req.body,
      tenantId: req.user.tenantId,
    });
    await score.save();
    res.status(201).json(score);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    const updated = await Score.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Score not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const deleted = await Score.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: 'Score not found' });
    res.json({ message: 'Score deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all scores for every active student in a class, for a given term/session
router.get('/report-card', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId, term, session } = req.query;

    if (!classId || !term || !session) {
      return res.status(400).json({ error: 'classId, term, and session are required' });
    }

    const TeacherRemark = require('../models/TeacherRemark');

    const school = await School.findOne({ tenantId: req.user.tenantId });
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const students = await Student.find({ 
      tenantId: req.user.tenantId,
      classId, 
      status: 'Active' 
    }).populate('classId');

    // Fetch all remarks for this class/term/session in one query
    const allRemarks = await TeacherRemark.find({
      tenantId: req.user.tenantId,
      classId,
      term,
      session,
    });
    const remarkByStudent = {};
    allRemarks.forEach((r) => {
      remarkByStudent[r.studentId.toString()] = r;
    });

    const results = [];

    for (const student of students) {
      const scoresRaw = await Score.find({ 
        tenantId: req.user.tenantId,
        studentId: student._id, 
        term, 
        session 
      }).populate({
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
      const remarkDoc = remarkByStudent[student._id.toString()];

      results.push({
        student: {
          id: student._id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: student.classId?.name || '—',
          classId: student.classId?._id || classId,
        },
        scores,
        totalScore,
        teacherRemark: remarkDoc?.remark || '',
        principalRemark: remarkDoc?.principalRemark || '',
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
