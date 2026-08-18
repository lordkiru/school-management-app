const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
  type: String,
  enum: ['proprietor', 'admin', 'teacher', 'bursar', 'parent'],
  required: true,
},
  resetToken: { type: String, default: null },
resetTokenExpires: { type: Date, default: null },
}, { timestamps: true });

// Indexes for better query performance
userSchema.index({ email: 1 }); // Already unique, but explicit index
userSchema.index({ role: 1 }); // Filter by role
userSchema.index({ resetToken: 1 }); // Password reset lookup
userSchema.index({ createdAt: -1 }); // Sort by creation date

// Before saving, hash the password if it's new or changed
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method to check a login password against the stored hash
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);