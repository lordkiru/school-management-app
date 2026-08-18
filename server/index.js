require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const subjectRoutes = require('./routes/subjects');
const scoreRoutes = require('./routes/scores');
const feeRoutes = require('./routes/fees');
const authRoutes = require('./routes/auth');
const schoolRoutes = require('./routes/school');
const auditLogRoutes = require('./routes/auditlog');
const paystackWebhookRoutes = require('./routes/paystackWebhook');
const staffRoutes = require('./routes/staff');
const timetableRoutes = require('./routes/timetable');
const sessionRoutes = require('./routes/sessions');
const parentRoutes = require('./routes/parents');




const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


const app = express();
app.use(cors());
app.use(express.json());
app.use('/students', studentRoutes);
app.use('/classes', classRoutes);
app.use('/subjects', subjectRoutes);
app.use('/scores', scoreRoutes);
app.use('/fees', feeRoutes);
app.use('/auth', authRoutes);
app.use('/school', schoolRoutes);
app.use('/auditlog', auditLogRoutes);
app.use('/paystack/webhook', paystackWebhookRoutes);
app.use('/staff', staffRoutes);
app.use('/timetable', timetableRoutes);
app.use('/sessions', sessionRoutes);
app.use('/parents', parentRoutes);
app.get('/', (req, res) => {
  res.send('API is running');
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });