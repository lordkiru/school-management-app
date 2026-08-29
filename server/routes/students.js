const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Score = require('../models/Score');
const Fee = require('../models/Fee');
const AuditLog = require('../models/AuditLog');
const computeGrade = require('../utils/grading');
const getNextSequence = require('../utils/getNextSequence');
const School = require('../models/School');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validateStudent, validateMongoId } = require('../middleware/validators');

// Get all students — supports ?page=1&limit=50&search=
router.get('/', requireAuth, requireRole('proprietor', 'admin', 'bursar', 'teacher'), async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    // Pagination defaults: no pagination if page/limit not provided (backward-compatible)
    const usePagination = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    const filter = { tenantId: req.user.tenantId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (usePagination) {
      const total = await Student.countDocuments(filter);
      const students = await Student.find(filter)
        .populate('classId')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.json({
        students,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    // Legacy: return flat array when no pagination params given
    const students = await Student.find(filter).populate('classId');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public results lookup — requires a school-issued opaque access token.
router.get('/public/results/:admissionNumber', apiLimiter, async (req, res) => {
  try {
    const { tenantId, accessToken } = req.query;
    if (!tenantId || !accessToken) {
      return res.status(400).json({ error: 'tenantId and accessToken are required' });
    }
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber,
      tenantId,
      publicAccessToken: accessToken,
    }).populate('classId');
    if (!student) return res.status(404).json({ error: 'Invalid student access details' });

    const school = await School.findOne({ tenantId: student.tenantId });
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const scoresRaw = await Score.find({ tenantId: student.tenantId, studentId: student._id }).populate({
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

// Student self-service: view own profile (used by the CBT dashboard)
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.user.id, tenantId: req.user.tenantId }).populate('classId');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({
      id: student._id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      classId: student.classId,
      mustChangePassword: student.mustChangePassword,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student self-service: set a new PIN (required on first login, optional after)
router.patch('/me/change-pin', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!newPin || newPin.length < 4) {
      return res.status(400).json({ error: 'New PIN must be at least 4 characters' });
    }

    const student = await Student.findOne({ _id: req.user.id, tenantId: req.user.tenantId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Skip the currentPin check only on a forced first-time change
    if (!student.mustChangePassword) {
      const isMatch = await student.comparePassword(currentPin || '');
      if (!isMatch) return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    student.password = newPin;
    student.mustChangePassword = false;
    await student.save();

    res.json({ message: 'PIN updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get one student with their scores and fees
router.get('/:id', requireAuth, requireRole('proprietor', 'admin', 'bursar', 'teacher'), async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .select('+password -publicAccessToken')
      .populate('classId');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const school = await School.findOne({ tenantId: req.user.tenantId });
    const maxTotal = school ? school.ca1Max + school.ca2Max + school.examMax : 100;

    const scoresRaw = await Score.find({ tenantId: req.user.tenantId, studentId: req.params.id }).populate({
      path: 'subjectId',
      populate: { path: 'classId' },
    });

    const scores = scoresRaw.map((score) => {
      const scoreObj = score.toObject();
      const section = score.subjectId?.classId?.section;
      scoreObj.grade = computeGrade(scoreObj.total, section, maxTotal);
      return scoreObj;
    });

    const fees = await Fee.find({ tenantId: req.user.tenantId, studentId: req.params.id });

    const studentResponse = student.toObject();
    studentResponse.cbtLoginConfigured = Boolean(student.password);
    delete studentResponse.password;
    delete studentResponse.publicAccessToken;

    res.json({ student: studentResponse, scores, fees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new student
router.post('/', requireAuth, requireActiveSubscription, requireRole('proprietor', 'admin'), validateStudent, async (req, res) => {
  try {
    const nextNumber = await getNextSequence('admissionNumber', req.user.tenantId);
    const admissionNumber = `ADM${String(nextNumber).padStart(5, '0')}`;

    const student = new Student({
      ...req.body,
      tenantId: req.user.tenantId,
      admissionNumber,
    });
    await student.save();

    if (student.classId) {
      const classmates = await Student.find({ 
        tenantId: req.user.tenantId,
        classId: student.classId, 
        _id: { $ne: student._id } 
      });
      const classmateIds = classmates.map((c) => c._id);

      if (classmateIds.length > 0) {
        const existingFee = await Fee.findOne({ 
          tenantId: req.user.tenantId,
          studentId: { $in: classmateIds } 
        }).sort({ createdAt: -1 });

        if (existingFee) {
          const alreadyHasFee = await Fee.findOne({
            tenantId: req.user.tenantId,
            studentId: student._id,
            term: existingFee.term,
            session: existingFee.session,
          });

          if (!alreadyHasFee) {
            await Fee.create({
              tenantId: req.user.tenantId,
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
      { tenantId: req.user.tenantId, _id: { $in: studentIds }, status: 'Active' },
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
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate (or reset) a CBT login PIN for a single student.
// Returns the plaintext PIN once — it is never retrievable again, only re-generatable.
router.post('/:id/generate-pin', requireAuth, requireRole('proprietor', 'admin', 'teacher'), validateMongoId, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const pin = String(Math.floor(1000 + Math.random() * 9000)); // random 4-digit PIN
    student.password = pin; // hashed by the pre('save') hook
    student.mustChangePassword = true;
    await student.save();

    res.json({
      studentId: student._id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      pin, // plaintext — only ever shown here, print/share immediately
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk-generate CBT login PINs for every active student in a class — e.g. before a CBT session.
// Returns a list of { admissionNumber, name, pin } for the teacher to print as login slips.
router.post('/generate-pins', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.body;
    if (!classId) return res.status(400).json({ error: 'classId is required' });

    const students = await Student.find({ tenantId: req.user.tenantId, classId, status: 'Active' });
    const results = [];

    for (const student of students) {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      student.password = pin;
      student.mustChangePassword = true;
      await student.save();
      results.push({ studentId: student._id, name: student.name, admissionNumber: student.admissionNumber, pin });
    }

    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manually refund some or all of a student's wallet credit (e.g. a withdrawing student).
// This is deliberately a separate, explicit action — overpayments are credited to the
// wallet automatically, but paying that credit back out in cash is never automatic.
router.post('/:id/wallet/refund', requireAuth, requireRole('proprietor', 'bursar'), validateMongoId, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (amount == null || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'A positive refund amount is required' });
    }

    const student = await Student.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (amount > student.walletBalance) {
      return res.status(400).json({ error: `Refund amount exceeds wallet balance of ₦${student.walletBalance.toLocaleString()}` });
    }

    student.walletBalance -= amount;
    await student.save();

    await AuditLog.create({
      tenantId: req.user.tenantId,
      action: 'update',
      entityType: 'Student',
      entityId: student._id,
      snapshot: {
        reason: reason || 'Manual wallet refund',
        refundedAmount: amount,
        remainingWalletBalance: student.walletBalance,
      },
      performedBy: req.user?.email || req.user?.id,
    });

    res.json({
      message: `₦${amount.toLocaleString()} refunded. Remaining wallet balance: ₦${student.walletBalance.toLocaleString()}`,
      studentWalletBalance: student.walletBalance,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a student and all their related records
router.delete('/:id', requireAuth, requireRole('proprietor', 'admin'), validateMongoId, async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    await Score.deleteMany({ tenantId: req.user.tenantId, studentId: req.params.id });
    await Fee.deleteMany({ tenantId: req.user.tenantId, studentId: req.params.id });

    res.json({ message: 'Student and all related records deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;