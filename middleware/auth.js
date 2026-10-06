const User = require('../models/User');
const { readToken } = require('../services/authService');

async function signedIn(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = readToken(token);
    if (!payload) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    req.user = user;
    next();
  } catch (error) { next(error); }
}

function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next() : res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์ทำรายการ' });
}

module.exports = { signedIn, allowRoles };
