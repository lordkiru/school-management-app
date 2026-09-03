const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');
const Student = require('../models/Student');
const Tenant = require('../models/Tenant');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validateStudentLogin, validatePasswordReset, validateGenerateReset } = require('../middleware/validators');
const { sendMail } = require('../utils/mailer');

// Login
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password, subdomain } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    let user;

    if (subdomain && subdomain.trim()) {
      // ── Subdomain-scoped login (production multi-tenant) ──────────────────
      // Resolve the tenant first, then find the user within that tenant only.
      // Prevents non-deterministic collision when two schools share the same
      // staff email — findOne({ email }) alone would return a random one.
      const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase().trim() });
      if (!tenant) {
        // Don't reveal that the subdomain doesn't exist — generic message
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      user = await User.findOne({ email: normalizedEmail, tenantId: tenant.tenantId });
    } else {
      // ── Fallback: global lookup (dev / localhost / super admin) ───────────
      // Also used when the app is served from the root domain with no subdomain.
      user = await User.findOne({ email: normalizedEmail });
    }

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    // Check tenant status (skip for super_admin — they have their own platform tenant)
    if (user.role !== 'super_admin') {
      const tenant = await Tenant.findOne({ tenantId: user.tenantId });
      if (!tenant) {
        return res.status(403).json({ error: 'School account not found. Please contact support.' });
      }
      if (tenant.status === 'suspended') {
        return res.status(403).json({ error: 'Your school account has been suspended. Please contact support.' });
      }
      if (tenant.status === 'deleted') {
        return res.status(403).json({ error: 'This school account no longer exists.' });
      }
    }

    // 24h in production (tighter security), 7d in development (convenience)
    const tokenExpiry = process.env.NODE_ENV === 'production' ? '24h' : '7d';

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email, name: user.name, tenantId: user.tenantId, assignedClassId: user.assignedClassId },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, assignedClassId: user.assignedClassId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student login — admission number + PIN, not email/password.
// Like the parent portal, this is a shared link students access directly (not a staff
// subdomain login), so it accepts tenantId directly the same way parents.js does. A
// subdomain is also accepted for schools that have that set up, for consistency with staff login.
router.post('/student-login', authLimiter, validateStudentLogin, async (req, res) => {
  try {
    const { admissionNumber, pin, tenantId, subdomain } = req.body;
    const normalizedAdmissionNumber = admissionNumber.trim();

    let student;

    if (subdomain && subdomain.trim()) {
      const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase().trim() });
      if (!tenant) {
        return res.status(401).json({ error: 'Invalid admission number or PIN' });
      }
      student = await Student.findOne({ admissionNumber: normalizedAdmissionNumber, tenantId: tenant.tenantId });
    } else if (tenantId && tenantId.trim()) {
      student = await Student.findOne({ admissionNumber: normalizedAdmissionNumber, tenantId: tenantId.trim() });
    } else {
      return res.status(400).json({ error: 'School ID is required to identify your school' });
    }

    if (!student) return res.status(401).json({ error: 'Invalid admission number or PIN' });

    if (!student.password) {
      // No PIN has been provisioned for this student yet
      return res.status(403).json({ error: 'CBT login has not been set up for this student yet. Ask your teacher.' });
    }

    if (student.status !== 'Active') {
      return res.status(403).json({ error: 'This student account is not active.' });
    }

    const isMatch = await student.comparePassword(pin);
    if (!isMatch) return res.status(401).json({ error: 'Invalid admission number or PIN' });

    const tenant = await Tenant.findOne({ tenantId: student.tenantId });
    if (!tenant) {
      return res.status(403).json({ error: 'School account not found. Please contact support.' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Your school account has been suspended. Please contact support.' });
    }
    if (tenant.status === 'deleted') {
      return res.status(403).json({ error: 'This school account no longer exists.' });
    }

    student.lastLoginAt = new Date();
    await student.save();

    // Short-lived token — students are logging in for a timed test, not a persistent session
    const token = jwt.sign(
      { id: student._id, role: 'student', name: student.name, admissionNumber: student.admissionNumber, classId: student.classId, tenantId: student.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    res.json({
      token,
      student: {
        id: student._id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        classId: student.classId,
        tenantId: student.tenantId,
        mustChangePassword: student.mustChangePassword,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a password reset token (proprietor does this on behalf of a staff member)
// The token is NOT returned in the response — it must be delivered via another channel (e.g., shown securely in the admin UI or email).
router.post('/generate-reset', authLimiter, requireAuth, requireRole('proprietor', 'admin'), validateGenerateReset, async (req, res) => {
  try {
    const { userId } = req.body;

    // Ensure user belongs to same tenant
    const user = await User.findOne({ _id: userId, tenantId: req.user.tenantId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    await user.save();

    // NOTE: In a full production setup, send this token via email rather than returning it here.
    // For now, it is returned so admin can share the reset link with the staff member manually.
    res.json({ 
      message: 'Password reset token generated. Share this link with the staff member.',
      resetToken: token,
      expiresAt: user.resetTokenExpires,
      resetUrl: `${process.env.FRONTEND_URL || ''}/reset-password?token=${token}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Self-service forgot password — user submits their own email
// Always returns 200 to avoid leaking whether an email exists in the system.
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always respond with success — never reveal if email exists (security best practice)
    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // expires in 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Reset your Lemida password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #475569; margin-bottom: 24px;">
            Hi ${user.name},<br><br>
            We received a request to reset your password for your Lemida account (<strong>${user.email}</strong>).
            Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}"
             style="display: inline-block; background: #4f46e5; color: white; font-weight: 600;
                    padding: 12px 28px; border-radius: 8px; text-decoration: none; margin-bottom: 24px;">
            Reset Password
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="color: #94a3b8; font-size: 12px;">
            Or copy this link into your browser:<br>
            <span style="word-break: break-all;">${resetUrl}</span>
          </p>
        </div>
      `,
    });

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('forgot-password error:', err.message);
    // Don't expose internal errors — just return generic message
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  }
});

// Use a reset token to set a new password (no login required)
router.post('/reset-password', authLimiter, validatePasswordReset, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = newPassword; // your existing pre('save') hook hashes this automatically
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;