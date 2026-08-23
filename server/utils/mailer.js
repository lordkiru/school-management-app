/**
 * mailer.js — Nodemailer transport wrapper
 *
 * Configured for Gmail SMTP by default. To switch providers just change
 * the EMAIL_* env vars — the sendMail() function stays the same.
 *
 * Gmail setup:
 *   EMAIL_HOST=smtp.gmail.com
 *   EMAIL_PORT=587
 *   EMAIL_USER=you@gmail.com
 *   EMAIL_PASS=your16charapppassword
 *   EMAIL_FROM=Lemida <you@gmail.com>
 *
 * Resend/Brevo/SendGrid SMTP:
 *   Replace HOST/PORT/USER/PASS with their SMTP credentials.
 */

const nodemailer = require('nodemailer');

// Create the transport once — reused for every email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: parseInt(process.env.EMAIL_PORT) === 465, // true only for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * sendMail(options)
 *
 * @param {object} options
 * @param {string} options.to        - Recipient email address
 * @param {string} options.subject   - Email subject line
 * @param {string} options.html      - HTML body
 * @param {string} [options.text]    - Plain text fallback (auto-generated if omitted)
 */
async function sendMail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@lemida.app';

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''), // strip HTML tags for plain-text fallback
  });
}

module.exports = { sendMail };
