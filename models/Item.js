const mongoose = require('mongoose');

const STOCK_KEYS = ['available', 'borrowed', 'broken', 'damaged', 'lost'];
const stockSchema = new mongoose.Schema(Object.fromEntries(
  STOCK_KEYS.map((key) => [key, { type: Number, default: 0, min: 0 }])
), { _id: false });

const itemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['asset', 'supply'], required: true, index: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  cat: { type: String, default: 'ทั่วไป', trim: true, maxlength: 80 },
  total: { type: Number, required: true, min: 1 },
  st: { type: stockSchema, required: true },
  img: { type: String, default: '' },
  desc: { type: String, default: '', maxlength: 1000 },
  log: [{ type: String, maxlength: 500 }]
}, {
  timestamps: true,
  toJSON: { virtuals: true, versionKey: false, transform: (_, doc) => { delete doc._id; } }
});

itemSchema.index({ name: 'text', code: 'text', cat: 'text' });
itemSchema.virtual('availability').get(function availability() {
  if (this.st.available <= 0) return 'out';
  return this.st.available <= this.total * 0.2 ? 'low' : 'ok';
});

module.exports = mongoose.model('Item', itemSchema);
module.exports.STOCK_KEYS = STOCK_KEYS;
