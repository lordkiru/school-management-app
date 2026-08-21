/**
 * One-off script: link all existing data (students, classes, fees, etc.)
 * that has no tenantId to the "My School" tenant.
 *
 * Safe to run more than once — only touches records with a missing/null
 * tenantId, never overwrites records that already belong to a tenant.
 *
 * Usage: node server/scripts/linkExistingDataToTenant.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
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

const SUBDOMAIN = 'myschool';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const tenant = await Tenant.findOne({ subdomain: SUBDOMAIN });
    if (!tenant) {
      console.log(`❌ No tenant found with subdomain "${SUBDOMAIN}". Aborting — nothing changed.`);
      return;
    }

    console.log(`📌 Linking all unlinked data to: ${tenant.schoolName} (${tenant.tenantId})\n`);

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
      const filter = { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] };
      const before = await model.countDocuments(filter);

      if (before === 0) {
        console.log(`✅ ${name}: nothing to link (0 unlinked records)`);
        continue;
      }

      const result = await model.updateMany(filter, { $set: { tenantId: tenant.tenantId } });
      console.log(`✅ ${name}: linked ${result.modifiedCount} of ${before} unlinked records`);
    }

    console.log('\n🎉 Done. All previously-unlinked data now belongs to:', tenant.schoolName);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

run();
