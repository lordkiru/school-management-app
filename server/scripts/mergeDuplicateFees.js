/**
 * One-off script: find students with more than one fee record for the same
 * term + session (created before the top-up fix), and merge them into a
 * single record — summing amountExpected and amountPaid, combining payment
 * history, and deleting the extra row(s).
 *
 * Usage:
 *   node scripts/mergeDuplicateFees.js            (dry run — no changes made)
 *   node scripts/mergeDuplicateFees.js --apply    (merges and deletes duplicates)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');

const isDryRun = !process.argv.includes('--apply');

async function mergeDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    console.log(isDryRun ? '🔍 DRY RUN — no changes will be saved' : '✍️  APPLY MODE — records will be merged');
    console.log('');

    const duplicateGroups = await Fee.aggregate([
      {
        $group: {
          _id: { tenantId: '$tenantId', studentId: '$studentId', term: '$term', session: '$session' },
          ids: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate fee records found. Nothing to merge.');
      return;
    }

    console.log(`Found ${duplicateGroups.length} student/term/session combination(s) with duplicates:\n`);

    for (const group of duplicateGroups) {
      const fees = await Fee.find({ _id: { $in: group.ids } }).sort({ createdAt: 1 });
      const student = await Student.findById(group._id.studentId);
      const studentName = student?.name || `(missing student, id: ${group._id.studentId})`;

      const totalExpected = fees.reduce((sum, f) => sum + f.amountExpected, 0);
      const totalPaid = fees.reduce((sum, f) => sum + f.amountPaid, 0);
      const combinedPayments = fees.flatMap((f) => f.payments);

      console.log(
        `  • ${studentName} — ${group._id.term} ${group._id.session} — ${fees.length} rows found ` +
        `(expected: ${fees.map((f) => f.amountExpected).join(' + ')} = ₦${totalExpected.toLocaleString()}, ` +
        `paid: ${fees.map((f) => f.amountPaid).join(' + ')} = ₦${totalPaid.toLocaleString()})`
      );

      if (isDryRun) continue;

      const [keep, ...duplicates] = fees; // keep the oldest record, merge the rest into it
      keep.amountExpected = totalExpected;
      keep.amountPaid = totalPaid;
      keep.payments = combinedPayments;
      await keep.save();

      for (const dup of duplicates) {
        await AuditLog.create({
          tenantId: dup.tenantId,
          action: 'delete',
          entityType: 'Fee',
          entityId: dup._id,
          snapshot: dup.toObject(),
          performedBy: 'system:mergeDuplicateFees',
        });
        await Fee.findByIdAndDelete(dup._id);
      }

      console.log(`    ✅ Merged into one record (kept ${keep._id}), deleted ${duplicates.length} duplicate(s).`);
    }

    if (isDryRun) {
      console.log('');
      console.log('This was a dry run — no records were changed.');
      console.log('Re-run with --apply to actually merge these records:');
      console.log('  node scripts/mergeDuplicateFees.js --apply');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

mergeDuplicates();
