const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Score = require('../models/Score');
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const bcrypt = require('bcryptjs');

// Use memory storage so we don't write temp files to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Helper: parse uploaded Excel/CSV buffer into array of row objects ────────
function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// ─── Helper: build & send a template Excel file ──────────────────────────────
function sendTemplate(res, sheetData, filename) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  // Set column widths
  ws['!cols'] = sheetData[0].map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE DOWNLOADS
// ════════════════════════════════════════════════════════════════════════════

// GET /import/template/students
router.get('/template/students', requireAuth, requireRole('proprietor', 'admin'), (req, res) => {
  sendTemplate(res, [
    ['Name', 'Admission Number', 'Class Name', 'Gender', 'Date of Birth (YYYY-MM-DD)', 'Status'],
    ['John Doe', 'PRI0001', 'JSS1 Gold', 'Male', '2010-05-15', 'Active'],
    ['Jane Smith', 'PRI0002', 'JSS1 Gold', 'Female', '2011-03-20', 'Active'],
  ], 'students-template.xlsx');
});

// GET /import/template/parents
router.get('/template/parents', requireAuth, requireRole('proprietor', 'admin'), (req, res) => {
  sendTemplate(res, [
    ['Parent Name', 'Email', 'Phone', 'Password', 'Student Admission Number'],
    ['Mr. Doe', 'doe@example.com', '08012345678', 'parent123', 'PRI0001'],
    ['Mrs. Smith', 'smith@example.com', '08087654321', 'parent456', 'PRI0002'],
  ], 'parents-template.xlsx');
});

// GET /import/template/scores
router.get('/template/scores', requireAuth, requireRole('proprietor', 'admin', 'teacher'), (req, res) => {
  sendTemplate(res, [
    ['Admission Number', 'Subject Name', 'Term', 'Session', 'CA1', 'CA2', 'Exam'],
    ['PRI0001', 'Mathematics', 'First Term', '2024/2025', '15', '18', '55'],
    ['PRI0001', 'English Language', 'First Term', '2024/2025', '20', '17', '60'],
  ], 'scores-template.xlsx');
});

// GET /import/template/staff
router.get('/template/staff', requireAuth, requireRole('proprietor', 'admin'), (req, res) => {
  sendTemplate(res, [
    ['Name', 'Email', 'Role', 'Phone', 'Password'],
    ['Mr. Teacher', 'teacher@school.com', 'teacher', '08011112222', 'Staff@1234'],
    ['Mrs. Bursar', 'bursar@school.com', 'bursar', '08033334444', 'Staff@1234'],
  ], 'staff-template.xlsx');
});

// ════════════════════════════════════════════════════════════════════════════
// PREVIEW (parse without saving)
// ════════════════════════════════════════════════════════════════════════════

// POST /import/preview/students
router.post('/preview/students', requireAuth, requireRole('proprietor', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const rows = parseWorkbook(req.file.buffer);
    const classes = await Class.find({ tenantId: req.user.tenantId });
    const classMap = {};
    classes.forEach((c) => { classMap[c.name.toLowerCase().trim()] = c._id; });

    const preview = rows.map((row, i) => {
      const errors = [];
      const name = String(row['Name'] || '').trim();
      const admissionNumber = String(row['Admission Number'] || '').trim();
      const className = String(row['Class Name'] || '').trim();
      const gender = String(row['Gender'] || '').trim();
      const dob = String(row['Date of Birth (YYYY-MM-DD)'] || '').trim();
      const status = String(row['Status'] || 'Active').trim();

      if (!name) errors.push('Name is required');
      if (!admissionNumber) errors.push('Admission Number is required');
      if (!className) errors.push('Class Name is required');
      else if (!classMap[className.toLowerCase()]) errors.push(`Class "${className}" not found`);
      if (!['Male', 'Female'].includes(gender)) errors.push('Gender must be Male or Female');
      if (!dob || isNaN(Date.parse(dob))) errors.push('Invalid date of birth');

      return {
        row: i + 2,
        name, admissionNumber, className, gender, dob, status,
        classId: classMap[className.toLowerCase()],
        errors,
      };
    });

    res.json({ total: preview.length, errors: preview.filter((r) => r.errors.length).length, rows: preview });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /import/preview/parents
router.post('/preview/parents', requireAuth, requireRole('proprietor', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const rows = parseWorkbook(req.file.buffer);
    const students = await Student.find({ tenantId: req.user.tenantId });
    const admMap = {};
    students.forEach((s) => { admMap[s.admissionNumber?.toLowerCase()] = s._id; });

    const preview = rows.map((row, i) => {
      const errors = [];
      const name = String(row['Parent Name'] || '').trim();
      const email = String(row['Email'] || '').trim();
      const phone = String(row['Phone'] || '').trim();
      const password = String(row['Password'] || '').trim();
      const admissionNumber = String(row['Student Admission Number'] || '').trim();

      if (!name) errors.push('Parent name required');
      if (!email || !/\S+@\S+\.\S+/.test(email)) errors.push('Valid email required');
      if (!password || password.length < 6) errors.push('Password min 6 chars');
      const studentId = admMap[admissionNumber?.toLowerCase()];
      if (admissionNumber && !studentId) errors.push(`Student "${admissionNumber}" not found`);

      return { row: i + 2, name, email, phone, password, admissionNumber, studentId, errors };
    });

    res.json({ total: preview.length, errors: preview.filter((r) => r.errors.length).length, rows: preview });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /import/preview/scores
router.post('/preview/scores', requireAuth, requireRole('proprietor', 'admin', 'teacher'), upload.single('file'), async (req, res) => {
  try {
    const rows = parseWorkbook(req.file.buffer);
    const students = await Student.find({ tenantId: req.user.tenantId });
    const subjects = await Subject.find({ tenantId: req.user.tenantId });
    const admMap = {};
    students.forEach((s) => { admMap[s.admissionNumber?.toLowerCase()] = s._id; });
    const subjectMap = {};
    subjects.forEach((s) => { subjectMap[s.name.toLowerCase().trim()] = s._id; });

    const preview = rows.map((row, i) => {
      const errors = [];
      const admissionNumber = String(row['Admission Number'] || '').trim();
      const subjectName = String(row['Subject Name'] || '').trim();
      const term = String(row['Term'] || '').trim();
      const session = String(row['Session'] || '').trim();
      const ca1 = parseFloat(row['CA1']);
      const ca2 = parseFloat(row['CA2']);
      const exam = parseFloat(row['Exam']);

      const studentId = admMap[admissionNumber?.toLowerCase()];
      if (!studentId) errors.push(`Student "${admissionNumber}" not found`);
      const subjectId = subjectMap[subjectName?.toLowerCase()];
      if (!subjectId) errors.push(`Subject "${subjectName}" not found`);
      if (!['First Term', 'Second Term', 'Third Term'].includes(term)) errors.push('Invalid term');
      if (!session || !/^\d{4}\/\d{4}$/.test(session)) errors.push('Session must be YYYY/YYYY');
      if (isNaN(ca1) || ca1 < 0 || ca1 > 100) errors.push('CA1 must be 0-100');
      if (isNaN(ca2) || ca2 < 0 || ca2 > 100) errors.push('CA2 must be 0-100');
      if (isNaN(exam) || exam < 0 || exam > 100) errors.push('Exam must be 0-100');

      return { row: i + 2, admissionNumber, subjectName, term, session, ca1, ca2, exam, studentId, subjectId, errors };
    });

    res.json({ total: preview.length, errors: preview.filter((r) => r.errors.length).length, rows: preview });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /import/preview/staff
router.post('/preview/staff', requireAuth, requireRole('proprietor', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const rows = parseWorkbook(req.file.buffer);
    const preview = rows.map((row, i) => {
      const errors = [];
      const name = String(row['Name'] || '').trim();
      const email = String(row['Email'] || '').trim();
      const role = String(row['Role'] || '').trim();
      const phone = String(row['Phone'] || '').trim();
      const password = String(row['Password'] || '').trim();

      if (!name) errors.push('Name required');
      if (!email || !/\S+@\S+\.\S+/.test(email)) errors.push('Valid email required');
      if (!['admin', 'teacher', 'bursar', 'proprietor'].includes(role)) errors.push('Role must be admin/teacher/bursar/proprietor');
      if (!password || password.length < 6) errors.push('Password min 6 chars');

      return { row: i + 2, name, email, role, phone, password, errors };
    });

    res.json({ total: preview.length, errors: preview.filter((r) => r.errors.length).length, rows: preview });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CONFIRM IMPORTS (actually save to DB)
// ════════════════════════════════════════════════════════════════════════════

// POST /import/confirm/students
router.post('/confirm/students', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { rows } = req.body; // pre-validated rows from preview
    let imported = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      if (row.errors && row.errors.length) { skipped++; continue; }
      try {
        const existing = await Student.findOne({ tenantId: req.user.tenantId, admissionNumber: row.admissionNumber });
        if (existing) { skipped++; continue; }
        await Student.create({
          tenantId: req.user.tenantId,
          name: row.name,
          admissionNumber: row.admissionNumber,
          classId: row.classId,
          gender: row.gender,
          dateOfBirth: row.dob,
          status: row.status || 'Active',
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${row.row}: ${e.message}`);
        skipped++;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import/confirm/parents
router.post('/confirm/parents', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { rows } = req.body;
    let imported = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      if (row.errors && row.errors.length) { skipped++; continue; }
      try {
        const existing = await Parent.findOne({ tenantId: req.user.tenantId, email: row.email.toLowerCase() });
        if (existing) {
          // If student not yet linked, link them
          if (row.studentId && !existing.children.includes(row.studentId)) {
            existing.children.push(row.studentId);
            await existing.save();
          }
          skipped++;
          continue;
        }
        const parent = await Parent.create({
          tenantId: req.user.tenantId,
          name: row.name,
          email: row.email.toLowerCase(),
          phone: row.phone,
          password: row.password,
          children: row.studentId ? [row.studentId] : [],
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${row.row}: ${e.message}`);
        skipped++;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import/confirm/scores
router.post('/confirm/scores', requireAuth, requireRole('proprietor', 'admin', 'teacher'), async (req, res) => {
  try {
    const { rows } = req.body;
    let imported = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      if (row.errors && row.errors.length) { skipped++; continue; }
      try {
        const total = (parseFloat(row.ca1) || 0) + (parseFloat(row.ca2) || 0) + (parseFloat(row.exam) || 0);
        await Score.findOneAndUpdate(
          { tenantId: req.user.tenantId, studentId: row.studentId, subjectId: row.subjectId, term: row.term, session: row.session },
          { tenantId: req.user.tenantId, studentId: row.studentId, subjectId: row.subjectId, term: row.term, session: row.session, ca1: row.ca1, ca2: row.ca2, exam: row.exam, total },
          { upsert: true, new: true, runValidators: false }
        );
        imported++;
      } catch (e) {
        errors.push(`Row ${row.row}: ${e.message}`);
        skipped++;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import/confirm/staff
router.post('/confirm/staff', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { rows } = req.body;
    let imported = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      if (row.errors && row.errors.length) { skipped++; continue; }
      try {
        const existing = await User.findOne({ tenantId: req.user.tenantId, email: row.email.toLowerCase() });
        if (existing) { skipped++; continue; }
        const hashed = await bcrypt.hash(row.password, 10);
        await User.create({
          tenantId: req.user.tenantId,
          name: row.name,
          email: row.email.toLowerCase(),
          role: row.role,
          phone: row.phone,
          password: hashed,
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${row.row}: ${e.message}`);
        skipped++;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
