const crypto = require('node:crypto');
const User = require('../models/User');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, saved) {
  if (typeof saved !== 'string') return false;
  const [salt, oldHash] = saved.split(':');
  if (!salt || !/^[0-9a-f]{128}$/i.test(oldHash || '')) return false;
  const newHash = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(newHash, Buffer.from(oldHash, 'hex'));
}

function makeToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })).toString('base64url');
  const data = `${header}.${payload}`;
  const secret = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'change-this-secret-before-deployment';
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function readToken(token) {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature) return null;
  const data = `${header}.${payload}`;
  const secret = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'change-this-secret-before-deployment';
  const expected = crypto.createHmac('sha256', secret).update(data).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    if (JSON.parse(Buffer.from(header, 'base64url').toString()).alg !== 'HS256') return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch { return null; }
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const oldAccount = await User.findOne({ email: email.toLowerCase() });
  if (oldAccount) {
    if (/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(oldAccount.passwordHash || '')) {
      if (oldAccount.role !== 'admin') {
        throw new Error('ADMIN_EMAIL มีบัญชีอยู่แล้วแต่ไม่ได้เป็น Admin กรุณาใช้อีเมลอื่นหรือเปลี่ยน role ก่อนเริ่มระบบ');
      }
      return;
    } else {
      if (!oldAccount.name) oldAccount.name = 'System Admin';
      if (!oldAccount.studentId) {
        const idInUse = await User.exists({ studentId: 'ADMIN-001' });
        oldAccount.studentId = idInUse
          ? `ADMIN-${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 8).toUpperCase()}`
          : 'ADMIN-001';
      }
      oldAccount.passwordHash = hashPassword(password);
      oldAccount.role = 'admin';
      await oldAccount.save();
      console.log('Initial admin account password was set from ADMIN_PASSWORD.');
    }
    return;
  }
  await User.create({ name: 'System Admin', studentId: 'ADMIN-001', email, passwordHash: hashPassword(password), role: 'admin' });
  console.log('Initial admin account created from ADMIN_EMAIL and ADMIN_PASSWORD.');
}

module.exports = { hashPassword, checkPassword, makeToken, readToken, ensureAdmin };
