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

// Student validation
const validateStudent = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Student name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('admissionNumber')
    .trim()
    .notEmpty()
    .withMessage('Admission number is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Admission number must be between 3 and 20 characters'),
  body('classId')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other'),
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
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
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
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
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
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
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

// MongoDB ID validation
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors,
];

module.exports = {
  validateLogin,
  validateStudent,
  validateParent,
  validateStaff,
  validateFee,
  validateScore,
  validateMongoId,
  handleValidationErrors,
};
