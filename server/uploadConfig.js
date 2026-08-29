const multer = require('multer');
// multer-storage-cloudinary v2.x exports a factory function — call directly, no 'new'
const cloudinaryStorage = require('multer-storage-cloudinary');
// Must pass the ROOT cloudinary module (not .v2) — the lib does cloudinary.v2.uploader internally
const cloudinary = require('cloudinary');

// Ensure cloudinary is configured
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Options are flat (not nested under 'params') in v2.x
const storage = cloudinaryStorage({
  cloudinary,            // root cloudinary object
  folder: 'school-logos',
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [{ width: 400, height: 400, crop: 'limit' }],
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

module.exports = upload;
