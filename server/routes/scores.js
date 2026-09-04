const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const Score = require('../models/Score');
const computeGrade = require('../utils/grading');
const School = require('../models/School');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
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
    const { studentId, subjectId, term, session, ca1, ca2, exam } = req.body;
    const [studentOk, subjectOk] = await Promise.all([
      Student.exists({ _id: studentId, tenantId: req.user.tenantId }),
      Subject.exists({ _id: subjectId, tenantId: req.user.tenantId }),
    ]);
    if (!studentOk) return res.status(404).json({ error: 'Student not found' });
    if (!subjectOk) return res.status(404).json({ error: 'Subject not found' });

    // Only set the fields actually sent — CA1, CA2, and Exam are entered
    // independently over time, so this upserts on the natural key instead of
    // blindly inserting (which would hit the unique index and reject a later
    // CA2-only submission for a student/subject/term/session that already
    // has a CA1 record).
    const fieldsToSet = {};
    if (ca1 !== undefined) fieldsToSet.ca1 = ca1;
    if (ca2 !== undefined) fieldsToSet.ca2 = ca2;
    if (exam !== undefined) fieldsToSet.exam = exam;

    const score = await Score.findOneAndUpdate(
      { tenantId: req.user.tenantId, studentId, subjectId, term, session },
      { $set: fieldsToSet },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(score);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    // Never let the client move a record between tenants, or re-point it at
    // another tenant's student/subject, via the update body
    const { tenantId, _id, studentId, subjectId, ...updates } = req.body;
    if (studentId) {
      const studentOk = await Student.exists({ _id: studentId, tenantId: req.user.tenantId });
      if (!studentOk) return res.status(404).json({ error: 'Student not found' });
      updates.studentId = studentId;
    }
    if (subjectId) {
      const subjectOk = await Subject.exists({ _id: subjectId, tenantId: req.user.tenantId });
      if (!subjectOk) return res.status(404).json({ error: 'Subject not found' });
      updates.subjectId = subjectId;
    }

    const updated = await Score.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      updates,
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
