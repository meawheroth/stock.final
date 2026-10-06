require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/db');
const itemRoutes = require('./routes/items');
const authRoutes = require('./routes/auth');
const loanRoutes = require('./routes/loans');
const errorHandler = require('./middleware/errorHandler');
const { ensureAdmin } = require('./services/authService');

const tokenSecret = process.env.TOKEN_SECRET || process.env.JWT_SECRET;
const missing = [!process.env.MONGODB_URI && 'MONGODB_URI', !tokenSecret && 'JWT_SECRET'].filter(Boolean);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use('/api/items', itemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/loans', loanRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ ok: connected, database: connected ? 'connected' : 'disconnected' });
});
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API ที่ร้องขอ' }));
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
connectDB()
  .then(async () => {
    await ensureAdmin();
    app.listen(port, () => console.log(`Stock manager is running at http://localhost:${port}`));
  })
  .catch((error) => { console.error('Application startup failed:', error.message); process.exitCode = 1; });
