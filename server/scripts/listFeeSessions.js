/**
 * Diagnostic script: lists every distinct session value currently used across
 * Fee records, with a count for each, and flags any that don't match the
 * proper YYYY/YYYY format. Read-only — makes no changes.
 *
 * Usage: node scripts/listFeeSessions.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Fee = require('../models/Fee');

async function listSessions() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    console.log('');

    const results = await Fee.aggregate([
      { $group: { _id: '$session', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    if (results.length === 0) {
      console.log('No fee records found at all.');
      return;
    }

    console.log(`Found ${results.length} distinct session value(s) across all fee records:\n`);

    const validFormat = /^\d{4}\/\d{4}$/;

    for (const r of results) {
      const isValid = validFormat.test(r._id || '');
      const flag = isValid ? '  ' : '⚠️ ';
      console.log(`${flag} "${r._id}" — ${r.count} record(s)${isValid ? '' : '  (does not match YYYY/YYYY format)'}`);
    }

    console.log('');
    console.log('Any line marked ⚠️  is a candidate to fix with:');
    console.log('  node scripts/fixSessionMismatch.js --from=<value> --to=<correct session>');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

listSessions();
