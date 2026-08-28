const { body, param, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Login validation
const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

// Student login validation (admission number + PIN, not email/password)
const validateStudentLogin = [
  body('admissionNumber')
    .trim()
    .notEmpty()
    .withMessage('Admission number is required'),
  body('pin')
    .trim()
    .notEmpty()
    .withMessage('PIN is required')
    .isLength({ min: 4, max: 10 })
    .withMessage('PIN must be between 4 and 10 characters'),
  handleValidationErrors,
];

// Student validation (admissionNumber is auto-generated)
const validateStudent = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Student name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Invalid date format. Use YYYY-MM-DD'),
  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['Male', 'Female'])
    .withMessage('Gender must be Male or Female'),
  body('classId')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  handleValidationErrors,
];

// Parent validation
const validateParent = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Parent name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s-()]+$/)
    .withMessage('Invalid phone number format'),
  handleValidationErrors,
];

// Staff validation
const validateStaff = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Staff name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['proprietor', 'admin', 'teacher', 'bursar'])
    .withMessage('Invalid role'),
  handleValidationErrors,
];

// Fee validation
const validateFee = [
  body('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID'),
  body('amountExpected')
    .notEmpty()
    .withMessage('Amount expected is required')
    .isFloat({ min: 0 })
    .withMessage('Amount expected must be a positive number'),
  body('term')
    .notEmpty()
    .withMessage('Term is required')
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Invalid term'),
  body('session')
    .notEmpty()
    .withMessage('Session is required')
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage('Session must be in format YYYY/YYYY (e.g., 2024/2025)'),
  handleValidationErrors,
];

// Score validation
const validateScore = [
  body('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID'),
  body('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('ca1')
    .notEmpty()
    .withMessage('CA1 score is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('CA1 must be between 0 and 100'),
  body('ca2')
    .notEmpty()
    .withMessage('CA2 score is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('CA2 must be between 0 and 100'),
  body('exam')
    .notEmpty()
    .withMessage('Exam score is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Exam must be between 0 and 100'),
  body('term')
    .notEmpty()
    .withMessage('Term is required')
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Invalid term'),
  body('session')
    .notEmpty()
    .withMessage('Session is required')
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage('Session must be in format YYYY/YYYY'),
  handleValidationErrors,
];

// CBT test validation
const validateCbtTest = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Title must be between 2 and 150 characters'),
  body('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('term')
    .notEmpty()
    .withMessage('Term is required')
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Invalid term'),
  body('session')
    .notEmpty()
    .withMessage('Session is required')
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage('Session must be in format YYYY/YYYY'),
  body('durationMinutes')
    .notEmpty()
    .withMessage('Duration is required')
    .isInt({ min: 1, max: 300 })
    .withMessage('Duration must be between 1 and 300 minutes'),
  body('caSlot')
    .notEmpty()
    .withMessage('CA slot is required')
    .isIn(['ca1', 'ca2'])
    .withMessage('caSlot must be ca1 or ca2'),
  body('questions')
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),
  body('questions.*.text')
    .trim()
    .notEmpty()
    .withMessage('Every question needs text'),
  body('questions.*.options')
    .isArray({ min: 2, max: 6 })
    .withMessage('Every question needs 2 to 6 options'),
  body('questions.*.correctIndex')
    .isInt({ min: 0 })
    .withMessage('Every question needs a valid correct answer index'),
  handleValidationErrors,
];

// CBT attempt submission validation
const validateCbtSubmit = [
  body('answers')
    .isArray()
    .withMessage('Answers must be an array'),
  handleValidationErrors,
];

// MongoDB ID validation
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors,
];

// Password reset validation
const validatePasswordReset = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid token format'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

// Generate reset token validation
const validateGenerateReset = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID'),
  handleValidationErrors,
];

// Payment amount validation
const validateAmount = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  handleValidationErrors,
];

// Student ID validation (for linking/unlinking)
const validateStudentId = [
  body('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID'),
  handleValidationErrors,
];

// Class validation
const validateClass = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Class name is required')
    .isLength({ max: 60 })
    .withMessage('Class name is too long'),
  body('level')
    .trim()
    .notEmpty()
    .withMessage('Level is required')
    .isLength({ max: 30 })
    .withMessage('Level is too long'),
  body('section')
    .notEmpty()
    .withMessage('Section is required')
    .isIn(['Creche', 'Kindergarten', 'Nursery', 'Primary', 'Secondary'])
    .withMessage('Section must be one of: Creche, Kindergarten, Nursery, Primary, Secondary'),
  handleValidationErrors,
];

// Subject validation
const validateSubject = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Subject name is required')
    .isLength({ max: 60 })
    .withMessage('Subject name is too long'),
  body('classId')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('teacherId')
    .optional({ nullable: true })
    .isMongoId()
    .withMessage('Invalid teacher ID'),
  handleValidationErrors,
];

module.exports = {
  validateLogin,
  validateStudentLogin,
  validateStudent,
  validateParent,
  validateStaff,
  validateFee,
  validateScore,
  validateCbtTest,
  validateCbtSubmit,
  validateMongoId,
  validatePasswordReset,
  validateGenerateReset,
  validateAmount,
  validateStudentId,
  validateClass,
  validateSubject,
  handleValidationErrors,
};