/**
 * Read-only diagnostic: check how many records in each collection
 * are missing a tenantId.
 * Usage: node server/scripts/inspectAllTenantId.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const Fee = require('../models/Fee');
const Parent = require('../models/Parent');
const School = require('../models/School');
const Session = require('../models/Session');
const Timetable = require('../models/Timetable');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB:', mongoose.connection.db.databaseName, '\n');

    const collections = [
      { model: Student, name: 'Students' },
      { model: Class, name: 'Classes' },
      { model: Subject, name: 'Subjects' },
      { model: Score, name: 'Scores' },
      { model: Fee, name: 'Fees' },
      { model: Parent, name: 'Parents' },
      { model: School, name: 'Schools' },
      { model: Session, name: 'Sessions' },
      { model: Timetable, name: 'Timetables' },
      { model: AuditLog, name: 'AuditLogs' },
      { model: Counter, name: 'Counters' },
    ];

    for (const { model, name } of collections) {
      const total = await model.countDocuments();
      const missing = await model.countDocuments({ tenantId: { $exists: false } });
      const nully = await model.countDocuments({ tenantId: null });
      console.log(`${name}: ${total} total | missing tenantId: ${missing} | null tenantId: ${nully}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

inspect();
