const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const Tenant = require('../models/Tenant');
const axios = require('axios');

const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/checkSubscription');
const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const { validateFee, validateMongoId, validateAmount } = require('../middleware/validators');
const { apiLimiter, paymentLimiter } = require('../middleware/rateLimiter');

// Get fees — supports ?page=1&limit=50&search=&term=&session=
router.get('/', requireAuth, requireRole('proprietor', 'bursar'), async (req, res) => {
  try {
    const { search, page, limit, term, session } = req.query;

    const usePagination = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    const filter = { tenantId: req.user.tenantId };
    if (term) filter.term = term;
    if (session) filter.session = session;

    if (search) {
      const matchingStudents = await Student.find({
        tenantId: req.user.tenantId,
        name: { $regex: search, $options: 'i' },
      });
      filter.studentId = { $in: matchingStudents.map((s) => s._id) };
    }

    if (usePagination) {
      const total = await Fee.countDocuments(filter);
      const fees = await Fee.find(filter)
        .populate({ path: 'studentId', populate: { path: 'classId' } })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.json({
        fees,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    // Legacy: return flat array when no pagination params given
    const fees = await Fee.find(filter).populate({
      path: 'studentId',
      populate: { path: 'classId' },
    });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('proprietor', 'bursar'), validateFee, async (req, res) => {
  try {
    const { studentId, term, session, amountExpected } = req.body;

    // Confirm the student belongs to this tenant before creating anything against them
    const student = await Student.findOne({ _id: studentId, tenantId: req.user.tenantId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // If a fee record already exists for this student/term/session, top it up
    // instead of creating a second, separate row.
    const existing = await Fee.findOne({ tenantId: req.user.tenantId, studentId, term, session });
    if (existing) {
      existing.amountExpected += amountExpected;
      await existing.save();
      return res.status(200).json(existing);
    }

    const fee = new Fee({
      ...req.body,
      tenantId: req.user.tenantId,
    });

    // Auto-apply any wallet credit the student is carrying (e.g. from a prior overpayment)
    if (student.walletBalance > 0) {
      const applied = Math.min(student.walletBalance, fee.amountExpected);
      fee.amountPaid += applied;
      student.walletBalance -= applied;
      await student.save();

      await AuditLog.create({
        tenantId: req.user.tenantId,
        action: 'update',
        entityType: 'Fee',
        entityId: fee._id,
        snapshot: {
          reason: 'Wallet credit applied to new fee',
          amountApplied: applied,
          remainingWalletBalance: student.walletBalance,
        },
        performedBy: req.user?.email || req.user?.id,
      });
    }

    await fee.save();
    res.status(201).json(fee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record a payment against an existing fee record
router.patch('/:id/pay', requireAuth, requireRole('proprietor', 'bursar'), validateMongoId, validateAmount, async (req, res) => {
  try {
    const { amount, paymentMethod, notes } = req.body;
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    const balance = fee.amountExpected - fee.amountPaid;
    // Cap what's applied to this fee at the outstanding balance; anything beyond that is an overpayment.
    const appliedToFee = Math.max(Math.min(amount, balance), 0);
    const excess = amount - appliedToFee;

    fee.amountPaid += appliedToFee;
    // Record the full amount received (not just what was applied) so the history
    // reflects what actually changed hands — the receipt/wallet note explains the split.
    fee.payments.push({
      amount,
      paymentMethod: paymentMethod && ['Cash', 'Bank Transfer', 'Card', 'Paystack', 'Other'].includes(paymentMethod) ? paymentMethod : 'Cash',
      receivedBy: req.user?.id,
      notes,
    });
    await fee.save();

    let studentWalletBalance;
    if (excess > 0) {
      // Route the overpayment into the student's wallet as credit for a future term,
      // rather than letting it silently inflate amountPaid past what was actually owed.
      const student = await Student.findOneAndUpdate(
        { _id: fee.studentId, tenantId: req.user.tenantId },
        { $inc: { walletBalance: excess } },
        { new: true }
      );
      studentWalletBalance = student?.walletBalance;

      await AuditLog.create({
        tenantId: req.user.tenantId,
        action: 'update',
        entityType: 'Student',
        entityId: fee.studentId,
        snapshot: {
          reason: 'Fee overpayment credited to wallet',
          feeId: fee._id,
          overpaymentAmount: excess,
          newWalletBalance: studentWalletBalance,
        },
        performedBy: req.user?.email || req.user?.id,
      });
    }

    res.json({
      fee,
      ...(excess > 0 && {
        overpayment: excess,
        studentWalletBalance,
        message: `Payment exceeded the balance due by ₦${excess.toLocaleString()}. The excess has been credited to the student's wallet and will auto-apply to their next fee.`,
      }),
    });
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
        const fee = new Fee({
          tenantId: req.user.tenantId,
          studentId: student._id,
          term,
          session,
          amountExpected,
        });

        // Auto-apply any wallet credit the student is carrying from a prior overpayment
        if (student.walletBalance > 0) {
          const applied = Math.min(student.walletBalance, fee.amountExpected);
          fee.amountPaid += applied;
          student.walletBalance -= applied;
          await student.save();
        }

        await fee.save();
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

    const tenant = await Tenant.findOne({ tenantId: req.user.tenantId });
    if (!tenant?.paystackSubaccountCode) {
      return res.status(400).json({
        error: 'This school has not completed bank details setup yet. Contact the platform admin to enable online payments.',
      });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: `${fee.studentId.admissionNumber}@placeholder.school`,
        amount: balance * 100,
        subaccount: tenant.paystackSubaccountCode,
        bearer_type: 'subaccount',
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

// Public lookup — requires a school-issued opaque access token.
router.get('/public/lookup/:admissionNumber', apiLimiter, async (req, res) => {
  try {
    const { tenantId, accessToken } = req.query;
    if (!tenantId || !accessToken) {
      return res.status(400).json({ error: 'tenantId and accessToken are required' });
    }
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber,
      tenantId,
      publicAccessToken: accessToken,
    });
    if (!student) return res.status(404).json({ error: 'Invalid student access details' });

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
    const { tenantId, accessToken } = req.body;
    if (!tenantId || !accessToken) {
      return res.status(400).json({ error: 'tenantId and accessToken are required' });
    }

    const student = await Student.findOne({ tenantId, publicAccessToken: accessToken });
    if (!student) return res.status(404).json({ error: 'Invalid student access details' });

    const fee = await Fee.findOne({ _id: req.params.id, tenantId, studentId: student._id }).populate('studentId');
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    // Cross-tenant protection: verify the fee belongs to the same tenant as the student
    if (!fee.studentId || fee.studentId.tenantId !== fee.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const balance = fee.amountExpected - fee.amountPaid;
    if (balance <= 0) {
      return res.status(400).json({ error: 'This fee is already fully paid' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant?.paystackSubaccountCode) {
      return res.status(400).json({
        error: 'Online payment is not yet available for this school. Please contact the school office.',
      });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: `${fee.studentId.admissionNumber}@placeholder.school`,
        amount: balance * 100,
        subaccount: tenant.paystackSubaccountCode,
        bearer_type: 'subaccount',
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