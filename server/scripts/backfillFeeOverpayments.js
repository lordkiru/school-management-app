/**
 * One-off script: find existing fee records where amountPaid exceeds
 * amountExpected (from before overpayment capping existed), cap them back
 * down to amountExpected, and move the excess into the student's
 * walletBalance as credit. Logs each fix to the audit trail.
 *
 * Safe to run again afterward — once a fee's amountPaid no longer exceeds
 * amountExpected, it's skipped.
 *
 * Usage:
 *   node server/scripts/backfillFeeOverpayments.js            (dry run — no changes made)
 *   node server/scripts/backfillFeeOverpayments.js --apply    (applies the fixes)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');

const isDryRun = !process.argv.includes('--apply');

async function backfill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    console.log(isDryRun ? '🔍 DRY RUN — no changes will be saved' : '✍️  APPLY MODE — changes will be saved');
    console.log('');

    // $expr lets us compare two fields on the same document
    const overpaidFees = await Fee.find({
      $expr: { $gt: ['$amountPaid', '$amountExpected'] },
    }).populate('studentId');

    if (overpaidFees.length === 0) {
      console.log('✅ No overpaid fee records found. Nothing to fix.');
      return;
    }

    console.log(`Found ${overpaidFees.length} overpaid fee record(s):\n`);

    let totalExcess = 0;

    for (const fee of overpaidFees) {
      const excess = fee.amountPaid - fee.amountExpected;
      totalExcess += excess;

      const studentName = fee.studentId?.name || `(missing student, id: ${fee.studentId})`;
      console.log(
        `  • ${studentName} — ${fee.term} ${fee.session} — paid ₦${fee.amountPaid.toLocaleString()} ` +
        `of ₦${fee.amountExpected.toLocaleString()} expected — excess: ₦${excess.toLocaleString()}`
      );

      if (isDryRun || !fee.studentId) {
        if (!fee.studentId) console.log(`    ⚠️  Skipped — no linked student found, cannot credit a wallet.`);
        continue;
      }

      fee.amountPaid = fee.amountExpected;
      await fee.save();

      const student = await Student.findByIdAndUpdate(
        fee.studentId._id,
        { $inc: { walletBalance: excess } },
        { new: true }
      );

      await AuditLog.create({
        tenantId: fee.tenantId,
        action: 'update',
        entityType: 'Student',
        entityId: student._id,
        snapshot: {
          reason: 'Backfill: historical fee overpayment credited to wallet',
          feeId: fee._id,
          overpaymentAmount: excess,
          newWalletBalance: student.walletBalance,
        },
        performedBy: 'system:backfillFeeOverpayments',
      });

      console.log(`    ✅ Fixed — ₦${excess.toLocaleString()} credited to wallet (new balance: ₦${student.walletBalance.toLocaleString()})`);
    }

    console.log('');
    console.log(`Total excess found: ₦${totalExcess.toLocaleString()} across ${overpaidFees.length} record(s)`);
    if (isDryRun) {
      console.log('');
      console.log('This was a dry run — no changes were saved.');
      console.log('Re-run with --apply to actually fix these records:');
      console.log('  node server/scripts/backfillFeeOverpayments.js --apply');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

backfill();
