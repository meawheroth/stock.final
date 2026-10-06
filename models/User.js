const crypto = require('node:crypto');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, unique: true, trim: true },
  userCode: { type: String, required: true, unique: true, trim: true },
  department: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' }
}, { timestamps: true });

userSchema.pre('validate', function () {
  if (!this.userCode) {
    this.userCode = `USR-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }
});

userSchema.set('toJSON', { transform: (_, result) => {
  delete result.passwordHash;
  delete result.__v;
  return result;
} });

module.exports = mongoose.model('User', userSchema);
