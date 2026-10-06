const mongoose = require('mongoose');

const loanItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  returned: { type: Number, default: 0, min: 0 },
  kind: { type: String, enum: ['asset', 'supply'], required: true }
}, { _id: false });

const loanSchema = new mongoose.Schema({
  borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  group: { type: String, default: '', trim: true },
  project: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  borrowDate: { type: Date, required: true },
  dueDate: { type: Date, required: true, index: true },
  items: { type: [loanItemSchema], validate: (items) => items.length > 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'returned'], default: 'pending', index: true },
  adminNote: { type: String, default: '' },
  history: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
