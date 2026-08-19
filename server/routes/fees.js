const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const axios = require('axios');

const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const { validateFee, validateMongoId, validateAmount } = require('../middleware/validators');
const { apiLimiter, paymentLimiter } = require('../middleware/rateLimiter');

router.get('/', requireAuth, requireRole('proprietor', 'bursar'), async (req, res) => {
  try {
    const { search } = req.query;

    if (search) {
      const matchingStudents = await Student.find({
        tenantId: req.user.tenantId,
        name: { $regex: search, $options: 'i' },
      });
      const studentIds = matchingStudents.map((s) => s._id);
      const fees = await Fee.find({ tenantId: req.user.tenantId, studentId: { $in: studentIds } }).populate('studentId');
      return res.json(fees);
    }

    const fees = await Fee.find({ tenantId: req.user.tenantId }).populate('studentId');
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('proprietor', 'bursar'), validateFee, async (req, res) => {
  try {
    const fee = new Fee({
      ...req.body,
      tenantId: req.user.tenantId,
    });
    await fee.save();
    res.status(201).json(fee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record a payment against an existing fee record
router.patch('/:id/pay', requireAuth, requireRole('proprietor', 'bursar'), validateMongoId, validateAmount, async (req, res) => {
  try {
    const { amount } = req.body;
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    fee.amountPaid += amount;
    await fee.save();
    res.json(fee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('proprietor', 'bursar'), validateMongoId, async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).populate('studentId');
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    await AuditLog.create({
      tenantId: req.user.tenantId,
      action: 'delete',
      entityType: 'Fee',
      entityId: fee._id,
      snapshot: fee.toObject(),
      performedBy: req.user?.email || req.user?.id,
    });

    await Fee.findByIdAndDelete(req.params.id);

    res.json({ message: 'Fee record deleted and logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add (aggregate) a fee amount for every student in a class at once
router.post('/bulk-by-class', requireAuth, requireRole('proprietor', 'bursar'), async (req, res) => {
  try {
    const { classId, term, session, amountExpected } = req.body;

    if (!classId || !term || !session || amountExpected == null) {
      return res.status(400).json({ error: 'classId, term, session, and amountExpected are required' });
    }

    const students = await Student.find({ tenantId: req.user.tenantId, classId });

    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found in this class' });
    }

    const results = { created: 0, updated: 0 };

    for (const student of students) {
      const existing = await Fee.findOne({ tenantId: req.user.tenantId, studentId: student._id, term, session });

      if (existing) {
        existing.amountExpected += amountExpected;
        await existing.save();
        results.updated++;
      } else {
        await Fee.create({
          tenantId: req.user.tenantId,
          studentId: student._id,
          term,
          session,
          amountExpected,
        });
        results.created++;
      }
    }

    res.status(201).json({
      message: `₦${amountExpected.toLocaleString()} added to ${results.created + results.updated} student(s) — ${results.created} new record(s), ${results.updated} existing record(s) topped up.`,
      ...results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adjust (overwrite) the expected fee for every student in a class
router.patch('/adjust-by-class', requireAuth, requireRole('proprietor', 'bursar'), async (req, res) => {
  try {
    const { classId, term, session, amountExpected } = req.body;

    if (!classId || !term || !session || amountExpected == null) {
      return res.status(400).json({ error: 'classId, term, session, and amountExpected are required' });
    }

    const students = await Student.find({ tenantId: req.user.tenantId, classId });
    const studentIds = students.map((s) => s._id);

    const result = await Fee.updateMany(
      { tenantId: req.user.tenantId, studentId: { $in: studentIds }, term, session },
      { $set: { amountExpected } }
    );

    res.json({
      message: `Expected fee set to ₦${amountExpected.toLocaleString()} for ${result.modifiedCount} student(s).`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ask Paystack to generate a payment link for a fee's outstanding balance
router.post('/:id/initiate-payment', requireAuth, requireRole('proprietor', 'bursar'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).populate('studentId');
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    const balance = fee.amountExpected - fee.amountPaid;
    if (balance <= 0) {
      return res.status(400).json({ error: 'This fee is already fully paid' });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: `${fee.studentId.admissionNumber}@placeholder.school`,
        amount: balance * 100,
        metadata: {
          feeId: fee._id.toString(),
          studentName: fee.studentId.name,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json({ authorizationUrl: response.data.data.authorization_url });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Public lookup — no login required. Returns only minimal info needed to pay.
router.get('/public/lookup/:admissionNumber', apiLimiter, async (req, res) => {
  try {
    const student = await Student.findOne({ admissionNumber: req.params.admissionNumber });
    if (!student) return res.status(404).json({ error: 'No student found with that admission number' });

    const allFees = await Fee.find({ tenantId: student.tenantId, studentId: student._id });
    const outstandingFees = allFees.filter((f) => f.amountExpected > f.amountPaid);

    res.json({
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      outstandingFees: outstandingFees.map((f) => ({
        id: f._id,
        term: f.term,
        session: f.session,
        balance: f.amountExpected - f.amountPaid,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public payment initiation — no login required
router.post('/public/:id/initiate-payment', paymentLimiter, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id).populate('studentId');
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    const balance = fee.amountExpected - fee.amountPaid;
    if (balance <= 0) {
      return res.status(400).json({ error: 'This fee is already fully paid' });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: `${fee.studentId.admissionNumber}@placeholder.school`,
        amount: balance * 100,
        metadata: {
          feeId: fee._id.toString(),
          studentName: fee.studentId.name,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json({ authorizationUrl: response.data.data.authorization_url });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Get fee totals grouped by class, optionally filtered by term/session
router.get('/report-by-class', requireAuth, requireRole('proprietor', 'bursar'), async (req, res) => {
  try {
    const { term, session } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (term) filter.term = term;
    if (session) filter.session = session;

    const fees = await Fee.find(filter).populate({
      path: 'studentId',
      populate: { path: 'classId' },
    });

    const byClass = {};

    for (const fee of fees) {
      const cls = fee.studentId?.classId;
      if (!cls) continue;

      const key = cls._id.toString();
      if (!byClass[key]) {
        byClass[key] = {
          classId: cls._id,
          className: cls.name,
          totalExpected: 0,
          totalPaid: 0,
          studentCount: 0,
        };
      }

      byClass[key].totalExpected += fee.amountExpected;
      byClass[key].totalPaid += fee.amountPaid;
      byClass[key].studentCount += 1;
    }

    const results = Object.values(byClass).map((c) => ({
      ...c,
      totalOutstanding: c.totalExpected - c.totalPaid,
    }));

    results.sort((a, b) => a.className.localeCompare(b.className));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
