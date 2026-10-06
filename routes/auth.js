const router = require('express').Router();
const User = require('../models/User');
const { signedIn, allowRoles } = require('../middleware/auth');
const { hashPassword, checkPassword, makeToken } = require('../services/authService');

const endpoint = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

router.post('/register', endpoint(async (req, res) => {
  const { name, studentId, department, phone, email, password } = req.body;
  if (!name || !studentId || !email || !password || password.length < 8)
    return res.status(400).json({ error: 'กรอกข้อมูลให้ครบ และรหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  const user = await User.create({ name, studentId, department, phone, email, passwordHash: hashPassword(password), role: 'student' });
  res.status(201).json({ token: makeToken(user), user });
}));

router.post('/login', endpoint(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!user || !checkPassword(String(req.body.password || ''), user.passwordHash))
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  res.json({ token: makeToken(user), user });
}));

router.get('/me', signedIn, (req, res) => res.json(req.user));

router.get('/users', signedIn, allowRoles('admin', 'teacher'), endpoint(async (req, res) => {
  const filter = req.user.role === 'teacher' ? { role: 'student', teacher: req.user._id } : {};
  res.json(await User.find(filter).sort({ name: 1 }));
}));

router.get('/teachers', signedIn, allowRoles('admin'), endpoint(async (req, res) => {
  res.json(await User.find({ role: 'teacher' }).select('name studentId').sort({ name: 1 }));
}));

router.post('/users', signedIn, allowRoles('admin'), endpoint(async (req, res) => {
  const { name, studentId, department, phone, email, password, role, teacher } = req.body;
  if (!name || !studentId || !email || !password || password.length < 8 || !['admin', 'teacher', 'student'].includes(role))
    return res.status(400).json({ error: 'กรอกข้อมูลผู้ใช้และบทบาทให้ถูกต้อง' });
  const user = await User.create({ name, studentId, department, phone, email, role, teacher: role === 'student' && teacher ? teacher : null, passwordHash: hashPassword(password) });
  res.status(201).json(user);
}));

module.exports = router;
