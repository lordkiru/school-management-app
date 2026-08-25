/**
 * One-off script: remove leftover test/seed fee records that were created
 * with a broken negative amountExpected (e.g. "First Term 2005/2006" test
 * data). These are NOT real overpayments — they're bad data that should be
 * deleted outright, not run through the overpayment backfill.
 *
 * Deliberately scoped to session "2005/2006" AND amountExpected < 0, so it
 * can never accidentally match a real fee record, even a legitimately
 * negative-looking edge case from a different term/session.
 *
 * Usage:
 *   node scripts/cleanupTestFeeRecords.js            (dry run — no changes made)
 *   node scripts/cleanupTestFeeRecords.js --apply    (deletes the matched records)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const Student = require('../models/Student'); // required so populate('studentId') can resolve the schema
const AuditLog = require('../models/AuditLog');

const isDryRun = !process.argv.includes('--apply');

// Narrow, deliberate filter — only matches the known bad test data.
const TEST_DATA_FILTER = {
  session: '2005/2006',
  amountExpected: { $lt: 0 },
};

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    console.log(isDryRun ? '🔍 DRY RUN — no changes will be saved' : '✍️  APPLY MODE — records will be deleted');
    console.log('');

    const testRecords = await Fee.find(TEST_DATA_FILTER).populate('studentId');

    if (testRecords.length === 0) {
      console.log('✅ No matching test records found. Nothing to clean up.');
      return;
    }

    console.log(`Found ${testRecords.length} matching test record(s):\n`);

    for (const fee of testRecords) {
      const studentName = fee.studentId?.name || `(missing student, id: ${fee.studentId})`;
      console.log(
        `  • ${studentName} — ${fee.term} ${fee.session} — expected ₦${fee.amountExpected.toLocaleString()}, paid ₦${fee.amountPaid.toLocaleString()}`
      );
    }

    if (isDryRun) {
      console.log('');
      console.log('This was a dry run — no records were deleted.');
      console.log('Re-run with --apply to actually delete these records:');
      console.log('  node scripts/cleanupTestFeeRecords.js --apply');
      return;
    }

    for (const fee of testRecords) {
      await AuditLog.create({
        tenantId: fee.tenantId,
        action: 'delete',
        entityType: 'Fee',
        entityId: fee._id,
        snapshot: fee.toObject(),
        performedBy: 'system:cleanupTestFeeRecords',
      });
    }

    const result = await Fee.deleteMany(TEST_DATA_FILTER);
    console.log('');
    console.log(`✅ Deleted ${result.deletedCount} test fee record(s), each logged to the audit trail.`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

cleanup();
