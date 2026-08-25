/**
 * One-off script: reassign fee records tagged with a broken/incorrect
 * session value (e.g. "2026") over to the correct session name
 * (e.g. "2005/2006"). If a student already has a record under the correct
 * session (duplicate key), the two are merged automatically instead of
 * the script aborting.
 *
 * Usage:
 *   node scripts/fixSessionMismatch.js --from=2026 --to=2005/2006
 *       (dry run — lists affected records, no changes made)
 *
 *   node scripts/fixSessionMismatch.js --from=2026 --to=2005/2006 --apply
 *       (reassigns/merges the affected records)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');

const isDryRun = !process.argv.includes('--apply');

function getArg(flag) {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.split('=')[1] : null;
}

const fromSession = getArg('from');
const toSession = getArg('to');

async function fixSessionMismatch() {
  if (!fromSession || !toSession) {
    console.log('❌ Both --from and --to are required.');
    console.log('   Example: node scripts/fixSessionMismatch.js --from=2026 --to=2005/2006');
    process.exit(1);
  }

  if (!/^\d{4}\/\d{4}$/.test(toSession)) {
    console.log(`❌ --to value "${toSession}" doesn't look like a valid session (expected format YYYY/YYYY).`);
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    console.log(isDryRun ? '🔍 DRY RUN — no changes will be saved' : '✍️  APPLY MODE — records will be updated');
    console.log(`Reassigning session "${fromSession}" → "${toSession}"`);
    console.log('');

    const affected = await Fee.find({ session: fromSession }).populate('studentId');

    if (affected.length === 0) {
      console.log(`✅ No fee records found with session "${fromSession}". Nothing to fix.`);
      return;
    }

    console.log(`Found ${affected.length} fee record(s) tagged "${fromSession}":\n`);

    for (const fee of affected) {
      const studentName = fee.studentId?.name || `(missing student, id: ${fee.studentId})`;
      console.log(
        `  • ${studentName} — ${fee.term} — expected ₦${fee.amountExpected.toLocaleString()}, paid ₦${fee.amountPaid.toLocaleString()}`
      );
    }

    if (isDryRun) {
      console.log('');
      console.log('This was a dry run — no records were changed.');
      console.log(`Re-run with --apply to reassign these to "${toSession}":`);
      console.log(`  node scripts/fixSessionMismatch.js --from=${fromSession} --to=${toSession} --apply`);
      console.log('');
      console.log('If a student already has a record under the target session, the two will be merged automatically.');
      return;
    }

    let fixed = 0;
    let merged = 0;
    let skipped = 0;

    for (const fee of affected) {
      const oldSession = fee.session;
      const studentName = fee.studentId?.name || String(fee.studentId);

      try {
        fee.session = toSession;
        await fee.save();

        await AuditLog.create({
          tenantId: fee.tenantId,
          action: 'update',
          entityType: 'Fee',
          entityId: fee._id,
          snapshot: { reason: 'Backfill: fixed mismatched session value', from: oldSession, to: toSession },
          performedBy: 'system:fixSessionMismatch',
        });

        fixed++;
      } catch (err) {
        // If the student already has a record under the correct session (duplicate key),
        // merge this one into it instead of aborting the whole run.
        if (err.code === 11000) {
          const existing = await Fee.findOne({
            tenantId: fee.tenantId,
            studentId: fee.studentId,
            term: fee.term,
            session: toSession,
          });

          if (existing) {
            existing.amountExpected += fee.amountExpected;
            existing.amountPaid += fee.amountPaid;
            existing.payments = [...existing.payments, ...fee.payments];
            await existing.save();

            await AuditLog.create({
              tenantId: fee.tenantId,
              action: 'delete',
              entityType: 'Fee',
              entityId: fee._id,
              snapshot: {
                ...fee.toObject(),
                reason: 'Backfill: merged into existing record after session fix',
                mergedInto: existing._id,
              },
              performedBy: 'system:fixSessionMismatch',
            });

            await Fee.findByIdAndDelete(fee._id);
            console.log(`    🔀 ${studentName} — merged into existing "${toSession}" record`);
            merged++;
            continue;
          }
        }

        console.log(`    ⚠️  ${studentName} — failed: ${err.message}`);
        skipped++;
      }
    }

    console.log('');
    console.log(`✅ Done. ${fixed} reassigned, ${merged} merged into an existing record, ${skipped} skipped due to errors.`);
    if (skipped > 0) {
      console.log('Review the ⚠️ lines above — those records were not changed.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixSessionMismatch();