const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('เชื่อมต่อ MongoDB สำเร็จ');
  } catch (error) {
    console.error('เชื่อมต่อ MongoDB ไม่สำเร็จ:', error.message);
    throw error;
  }
}

module.exports = connectDB;
