const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Session = require('../models/Session');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { sendAbsenceAlert } = require('./notifications');

// ─────────────────────────────────────────────────────────────────────────────
// POST /attendance/mark
// Teacher (or admin) submits the full class register for today.
// Body: { classId, date (optional, defaults to today), records: [{ studentId, status, notes }] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/mark', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId, date, records } = req.body;

    if (!classId) return res.status(400).json({ error: 'classId is required' });
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array is required and must not be empty' });
    }

    // Determine date — default to today (UTC midnight)
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setUTCHours(0, 0, 0, 0);

    // Get the current session for this tenant
    const currentSession = await Session.findOne({ tenantId: req.user.tenantId, isCurrent: true });
    if (!currentSession) return res.status(400).json({ error: 'No active session found. Please set a current session first.' });

    // Check if attendance was already submitted for this class on this date
    const existingCount = await Attendance.countDocuments({
      tenantId: req.user.tenantId,
      classId,
      date: attendanceDate,
    });
    if (existingCount > 0) {
      return res.status(409).json({ error: 'Attendance for this class has already been submitted today. Contact an admin to make corrections.' });
    }

    // Confirm every student in the register actually belongs to this tenant
    const submittedStudentIds = records.map((r) => r.studentId);
    const validStudents = await Student.find({
      tenantId: req.user.tenantId,
      _id: { $in: submittedStudentIds },
    }).select('_id');
    const validStudentIds = new Set(validStudents.map((s) => String(s._id)));
    const unknownIds = submittedStudentIds.filter((id) => !validStudentIds.has(String(id)));
    if (unknownIds.length > 0) {
      return res.status(400).json({ error: 'One or more students do not belong to this school' });
    }

    // Build attendance documents
    const docs = records.map((r) => ({
      tenantId: req.user.tenantId,
      studentId: r.studentId,
      classId,
      sessionId: currentSession._id,
      date: attendanceDate,
      status: r.status || 'Present',
      markedBy: req.user.id,
      notes: r.notes || '',
    }));

    await Attendance.insertMany(docs, { ordered: false });

    // Identify absent students for WhatsApp alert (Phase 3 will wire this up)
    const absentStudentIds = records
      .filter((r) => r.status === 'Absent')
      .map((r) => r.studentId);

    res.status(201).json({
      message: `Attendance marked for ${docs.length} student(s)`,
      date: attendanceDate,
      absentCount: absentStudentIds.length,
    });

    // Fire absence WhatsApp alerts asynchronously (don't block the response)
    if (absentStudentIds.length > 0) {
      for (const sid of absentStudentIds) {
        sendAbsenceAlert(req.user.tenantId, sid, attendanceDate).catch((e) =>
          console.error('[absenceAlert]', e.message)
        );
      }
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Some attendance records already exist for today.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/class/:classId?date=YYYY-MM-DD
// Returns the attendance register for a class on a given date (defaults to today)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/class/:classId', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const dateParam = req.query.date;

    const attendanceDate = dateParam ? new Date(dateParam) : new Date();
    attendanceDate.setUTCHours(0, 0, 0, 0);

    const records = await Attendance.find({
      tenantId: req.user.tenantId,
      classId,
      date: attendanceDate,
    }).populate('studentId', 'name admissionNumber');

    res.json({ date: attendanceDate, classId, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/student/:studentId?limit=30
// Returns a student's attendance history (most recent first)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/student/:studentId', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const limit = parseInt(req.query.limit) || 60;

    const records = await Attendance.find({
      tenantId: req.user.tenantId,
      studentId,
    })
      .sort({ date: -1 })
      .limit(limit)
      .populate('classId', 'name');

    // Calculate summary stats
    const total = records.length;
    const present = records.filter((r) => r.status === 'Present' || r.status === 'Late').length;
    const absent = records.filter((r) => r.status === 'Absent').length;
    const excused = records.filter((r) => r.status === 'Excused').length;
    const attendancePercent = total > 0 ? Math.round((present / total) * 100) : null;

    res.json({ studentId, total, present, absent, excused, attendancePercent, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/summary/:classId?sessionId=
// Returns term attendance % for every student in a class
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary/:classId', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;

    // Determine session
    let sessionId = req.query.sessionId;
    if (!sessionId) {
      const currentSession = await Session.findOne({ tenantId: req.user.tenantId, isCurrent: true });
      if (currentSession) sessionId = currentSession._id;
    }

    const query = { tenantId: req.user.tenantId, classId };
    if (sessionId) query.sessionId = sessionId;

    const records = await Attendance.find(query).populate('studentId', 'name admissionNumber');

    // Group by student
    const studentMap = {};
    records.forEach((r) => {
      const sid = r.studentId?._id?.toString();
      if (!sid) return;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          studentId: sid,
          name: r.studentId.name,
          admissionNumber: r.studentId.admissionNumber,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      }
      studentMap[sid].total++;
      if (r.status === 'Present') studentMap[sid].present++;
      else if (r.status === 'Absent') studentMap[sid].absent++;
      else if (r.status === 'Late') { studentMap[sid].late++; studentMap[sid].present++; }
      else if (r.status === 'Excused') studentMap[sid].excused++;
    });

    const summary = Object.values(studentMap).map((s) => ({
      ...s,
      attendancePercent: s.total > 0 ? Math.round((s.present / s.total) * 100) : null,
    }));

    res.json({ classId, sessionId, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/today-overview
// Admin view: which classes have been marked today and which haven't
// ─────────────────────────────────────────────────────────────────────────────
router.get('/today-overview', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const Class = require('../models/Class');
    const User = require('../models/User');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get all classes for this tenant
    const classes = await Class.find({ tenantId: req.user.tenantId });

    // Get distinct classIds that have attendance today
    const markedClassIds = await Attendance.distinct('classId', {
      tenantId: req.user.tenantId,
      date: today,
    });

    const markedSet = new Set(markedClassIds.map((id) => id.toString()));

    // Get teachers and their assigned classes
    const teachers = await User.find({
      tenantId: req.user.tenantId,
      role: 'teacher',
      assignedClassId: { $ne: null },
    }).select('name assignedClassId');

    const teacherByClass = {};
    teachers.forEach((t) => {
      if (t.assignedClassId) {
        teacherByClass[t.assignedClassId.toString()] = t.name;
      }
    });

    const overview = classes.map((cls) => ({
      classId: cls._id,
      className: cls.name,
      section: cls.section,
      markedToday: markedSet.has(cls._id.toString()),
      teacherName: teacherByClass[cls._id.toString()] || null,
    }));

    const markedCount = overview.filter((c) => c.markedToday).length;
    res.json({ date: today, totalClasses: classes.length, markedCount, unmarkedCount: classes.length - markedCount, overview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/flagged-absences
// Students with 3+ consecutive absences (admin view)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/flagged-absences', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 3;

    // Get recent attendance (last 30 days)
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const records = await Attendance.find({
      tenantId: req.user.tenantId,
      date: { $gte: since },
    })
      .sort({ studentId: 1, date: -1 })
      .populate('studentId', 'name admissionNumber')
      .populate('classId', 'name');

    // Group by student and find consecutive absences
    const studentRecords = {};
    records.forEach((r) => {
      const sid = r.studentId?._id?.toString();
      if (!sid) return;
      if (!studentRecords[sid]) {
        studentRecords[sid] = { student: r.studentId, classInfo: r.classId, records: [] };
      }
      studentRecords[sid].records.push(r);
    });

    const flagged = [];
    Object.values(studentRecords).forEach(({ student, classInfo, records: recs }) => {
      // recs are sorted by date desc — count consecutive absences from latest
      let consecutiveAbsences = 0;
      for (const rec of recs) {
        if (rec.status === 'Absent') consecutiveAbsences++;
        else break;
      }
      if (consecutiveAbsences >= threshold) {
        flagged.push({
          studentId: student._id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: classInfo?.name || 'Unknown',
          consecutiveAbsences,
          lastSeen: recs.find((r) => r.status !== 'Absent')?.date || null,
        });
      }
    });

    flagged.sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);
    res.json({ threshold, flaggedCount: flagged.length, flagged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /attendance/sync
// PWA offline batch sync — accepts array of attendance submissions
// Body: { submissions: [{ classId, date, records: [...] }] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { submissions } = req.body;
    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: 'submissions array is required' });
    }

    const currentSession = await Session.findOne({ tenantId: req.user.tenantId, isCurrent: true });
    if (!currentSession) return res.status(400).json({ error: 'No active session found.' });

    const results = [];
    for (const submission of submissions) {
      const { classId, date, records } = submission;
      if (!classId || !records || !Array.isArray(records)) {
        results.push({ classId, date, status: 'skipped', reason: 'Invalid submission' });
        continue;
      }

      const attendanceDate = new Date(date);
      attendanceDate.setUTCHours(0, 0, 0, 0);

      // Skip if already marked
      const existingCount = await Attendance.countDocuments({
        tenantId: req.user.tenantId,
        classId,
        date: attendanceDate,
      });

      if (existingCount > 0) {
        results.push({ classId, date, status: 'skipped', reason: 'Already marked' });
        continue;
      }

      const docs = records.map((r) => ({
        tenantId: req.user.tenantId,
        studentId: r.studentId,
        classId,
        sessionId: currentSession._id,
        date: attendanceDate,
        status: r.status || 'Present',
        markedBy: req.user.id,
        notes: r.notes || '',
      }));

      try {
        await Attendance.insertMany(docs, { ordered: false });
        results.push({ classId, date, status: 'synced', count: docs.length });
      } catch (insertErr) {
        results.push({ classId, date, status: 'error', reason: insertErr.message });
      }
    }

    res.json({ message: 'Sync complete', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/parent/child/:studentId
// Parents can view their child's attendance — scoped to their children
// ─────────────────────────────────────────────────────────────────────────────
router.get('/parent/child/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;

    // If parent role, verify this child belongs to them
    if (req.user.role === 'parent') {
      const Parent = require('../models/Parent');
      const parent = await Parent.findOne({ _id: req.user.id, tenantId: req.user.tenantId });
      if (!parent) return res.status(404).json({ error: 'Parent not found' });
      const childIds = parent.children.map((id) => id.toString());
      if (!childIds.includes(studentId)) {
        return res.status(403).json({ error: 'You do not have access to this student' });
      }
    }

    const limit = parseInt(req.query.limit) || 60;
    const records = await Attendance.find({
      tenantId: req.user.tenantId,
      studentId,
    })
      .sort({ date: -1 })
      .limit(limit);

    const total = records.length;
    const present = records.filter((r) => r.status === 'Present' || r.status === 'Late').length;
    const absent = records.filter((r) => r.status === 'Absent').length;
    const attendancePercent = total > 0 ? Math.round((present / total) * 100) : null;

    res.json({ studentId, total, present, absent, attendancePercent, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
