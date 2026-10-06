const router = require('express').Router();
const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Item = require('../models/Item');
const User = require('../models/User');
const { signedIn, allowRoles } = require('../middleware/auth');

const endpoint = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};
const withOverdue = (loan) => {
  const data = loan.toObject ? loan.toObject() : loan;
  data.id = String(data._id);
  data.overdue = ['approved'].includes(data.status) && new Date(data.dueDate).getTime() + 86400000 < Date.now();
  return data;
};

router.get('/', signedIn, endpoint(async (req, res) => {
  let filter = req.user.role === 'student' ? { borrower: req.user._id } : {};
  if (req.user.role === 'teacher') {
    const students = await User.find({ role: 'student', teacher: req.user._id }).select('_id');
    filter = { borrower: { $in: students.map((student) => student._id) } };
  }
  const loans = await Loan.find(filter).populate('borrower', 'name studentId department role').sort({ createdAt: -1 });
  res.json(loans.map(withOverdue));
}));

router.post('/', signedIn, allowRoles('student'), endpoint(async (req, res) => {
  const { group, project, purpose, borrowDate, dueDate, items } = req.body;
  if (!project || !purpose || !Array.isArray(items) || !items.length || !dueDate)
    return res.status(400).json({ error: 'กรอกโปรเจกต์ วัตถุประสงค์ วันคืน และรายการอุปกรณ์ให้ครบ' });
  if (new Date(dueDate) < new Date(borrowDate || Date.now()))
    return res.status(400).json({ error: 'กำหนดคืนต้องไม่ก่อนวันที่ยืม' });
  const clean = [];
  for (const row of items) {
    if (!row.itemId || !mongoose.isValidObjectId(row.itemId))
      return res.status(400).json({ error: 'เลือกรายการอุปกรณ์ให้ถูกต้อง' });
    const qty = Number(row.quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) return res.status(400).json({ error: 'จำนวนที่ขอต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
    const item = await Item.findById(row.itemId);
    if (!item) return res.status(404).json({ error: 'ไม่พบอุปกรณ์ที่เลือก' });
    clean.push({ itemId: item._id, code: item.code, name: item.name, quantity: qty, kind: item.kind });
  }
  const loan = await Loan.create({ borrower: req.user._id, group, project, purpose, borrowDate: borrowDate || new Date(), dueDate, items: clean, history: ['ส่งคำขอยืม'] });
  res.status(201).json(loan);
}));

router.post('/:id/decision', signedIn, allowRoles('admin'), endpoint(async (req, res) => {
  const decision = req.body.decision;
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'เลือกอนุมัติหรือไม่อนุมัติ' });
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) throw Object.assign(new Error('ไม่พบคำขอยืม'), { status: 404 });
      if (loan.status !== 'pending') throw Object.assign(new Error('คำขอนี้ถูกดำเนินการแล้ว'), { status: 409 });

      if (decision === 'approved') {
        for (const row of loan.items) {
          const isSupply = row.kind === 'supply';
          const updated = await Item.findOneAndUpdate(
            { _id: row.itemId, 'st.available': { $gte: row.quantity }, ...(isSupply ? { total: { $gte: row.quantity } } : {}) },
            isSupply
              ? { $inc: { total: -row.quantity, 'st.available': -row.quantity, __v: 1 }, $push: { log: `ใช้วัสดุ ${row.quantity} · ${loan.project}` } }
              : { $inc: { 'st.available': -row.quantity, 'st.borrowed': row.quantity, __v: 1 }, $push: { log: `อนุมัติยืม ${row.quantity} · ${loan.project}` } },
            { new: true, runValidators: true, session }
          );
          if (!updated) throw Object.assign(new Error(`จำนวน ${row.name} คงเหลือไม่พอ`), { status: 409 });
        }
        if (loan.items.every((row) => row.kind === 'supply')) loan.status = 'returned';
        else loan.status = 'approved';
      } else loan.status = 'rejected';

      loan.adminNote = String(req.body.note || '').slice(0, 500);
      loan.history.push(decision === 'approved' ? 'Admin อนุมัติคำขอ' : 'Admin ไม่อนุมัติคำขอ');
      await loan.save({ session });
      result = loan;
    });
  } finally {
    await session.endSession();
  }
  res.json(withOverdue(result));
}));

router.post('/:id/return', signedIn, allowRoles('admin'), endpoint(async (req, res) => {
  const { itemId, quantity, condition, note } = req.body;
  const qty = Number(quantity);
  const to = ['available', 'broken', 'damaged', 'lost'].includes(condition) ? condition : null;
  if (!Number.isSafeInteger(qty) || qty < 1) return res.status(400).json({ error: 'จำนวนคืนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
  if (!to) return res.status(400).json({ error: 'เลือกสภาพอุปกรณ์ให้ถูกต้อง' });
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) throw Object.assign(new Error('ไม่พบรายการยืม'), { status: 404 });
      if (loan.status !== 'approved') throw Object.assign(new Error('รายการนี้ไม่อยู่ในสถานะรอคืน'), { status: 409 });
      const row = loan.items.find((entry) => String(entry.itemId) === String(itemId));
      if (!row || row.kind !== 'asset') throw Object.assign(new Error('เลือกครุภัณฑ์ที่อยู่ในรายการยืม'), { status: 400 });
      if (qty > row.quantity - row.returned)
        throw Object.assign(new Error('จำนวนคืนมากกว่าจำนวนที่ยังค้าง'), { status: 400 });

      const updated = await Item.findOneAndUpdate({ _id: itemId, 'st.borrowed': { $gte: qty } }, {
        $inc: { 'st.borrowed': -qty, [`st.${to}`]: qty, __v: 1 },
        $push: { log: `รับคืน ${qty} · ${to} · ${loan.project}${note ? ` · ${String(note).slice(0, 100)}` : ''}` }
      }, { new: true, runValidators: true, session });
      if (!updated) throw Object.assign(new Error('ยอดจำนวนถูกยืมไม่พอสำหรับการคืน'), { status: 409 });

      row.returned += qty;
      loan.history.push(`รับคืน ${row.name} ${qty} ชิ้น สภาพ ${to}`);
      if (loan.items.every((entry) => entry.kind === 'supply' || entry.returned >= entry.quantity)) loan.status = 'returned';
      await loan.save({ session });
      result = loan;
    });
  } finally {
    await session.endSession();
  }
  res.json(withOverdue(result));
}));

router.get('/summary', signedIn, allowRoles('admin', 'teacher'), endpoint(async (req, res) => {
  let scope = {};
  if (req.user.role === 'teacher') {
    const students = await User.find({ role: 'student', teacher: req.user._id }).select('_id');
    scope = { borrower: { $in: students.map((student) => student._id) } };
  }
  const loans = await Loan.find({ ...scope, status: { $in: ['pending', 'approved'] } });
  const allLoans = await Loan.find(scope);
  const now = new Date();
  const projects = {};
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { month: date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }), requests: 0, quantity: 0 };
  });
  for (const loan of allLoans) {
    const monthIndex = (loan.createdAt.getFullYear() - now.getFullYear()) * 12 + loan.createdAt.getMonth() - now.getMonth() + 5;
    if (monthIndex >= 0 && monthIndex < monthly.length) {
      monthly[monthIndex].requests += 1;
      if (['approved', 'returned'].includes(loan.status)) monthly[monthIndex].quantity += loan.items.reduce((sum, row) => sum + row.quantity, 0);
    }
    const key = `${loan.project || 'ไม่ระบุ'} · ${loan.group || 'ไม่ระบุกลุ่ม'}`;
    if (!projects[key]) projects[key] = { project: loan.project || 'ไม่ระบุ', group: loan.group || 'ไม่ระบุกลุ่ม', requests: 0, items: 0, supplies: 0, overdue: 0 };
    projects[key].requests += 1;
    projects[key].items += loan.items.reduce((sum, row) => sum + row.quantity, 0);
    if (['approved', 'returned'].includes(loan.status)) {
      projects[key].supplies += loan.items.filter((row) => row.kind === 'supply').reduce((sum, row) => sum + row.quantity, 0);
    }
    if (loan.status === 'approved' && loan.dueDate.getTime() + 86400000 < now.getTime()) projects[key].overdue += 1;
  }
  res.json({ pending: loans.filter((l) => l.status === 'pending').length,
    approved: loans.filter((l) => l.status === 'approved').length,
    overdue: loans.filter((l) => l.status === 'approved' && l.dueDate.getTime() + 86400000 < now.getTime()).length,
    projectCount: Object.keys(projects).length, projects: Object.values(projects), monthly });
}));

module.exports = router;
