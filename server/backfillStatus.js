const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');

async function backfill() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected — backfilling status...');

  const result = await Student.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'Active' } }
  );

  console.log(`Updated ${result.modifiedCount} student(s) to status: Active`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});