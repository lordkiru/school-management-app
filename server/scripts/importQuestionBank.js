// Imports a question bank JSON file into the shared Lemida Question Bank.
//
//   node scripts/importQuestionBank.js <file.json> [--dry-run]
//
// --dry-run reports what would happen without saving anything. Without it, valid questions are
// saved as drafts (existing ones are updated; an approved question whose content changed goes back
// to draft). The file can live anywhere on your computer: never put real question files in the repo.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { importQuestionBank } = require('../modules/questionBank');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Usage: node scripts/importQuestionBank.js <file.json> [--dry-run]');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set. Check server/.env.');
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
} catch (err) {
  console.error(`Could not read ${file} as JSON: ${err.message}`);
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name} | ${dryRun ? 'DRY RUN (nothing will be saved)' : 'IMPORTING'}\n`);

  const report = await importQuestionBank({ payload, dryRun, actor: 'cli' });

  console.log(`Subject: ${report.subject || '(none)'}  Batch: ${report.batch || '(none)'}  Questions in file: ${report.total}`);
  console.log(`  ${dryRun ? 'Would create' : 'Created'}: ${report.toCreate}`);
  console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${report.toUpdate}`);
  console.log(`  Unchanged: ${report.unchanged}`);
  console.log(`  Theory questions skipped: ${report.theorySkipped}`);
  if (report.reapprovalNeeded.length) {
    console.log(`  Need re-approval (approved questions whose content changed): ${report.reapprovalNeeded.join(', ')}`);
  }
  if (report.errors.length) {
    console.log(`\n${report.errors.length} question(s) have problems and ${dryRun ? 'would be' : 'were'} skipped:`);
    report.errors.forEach((e) => console.log(`  ${e.externalId}: ${e.messages.join('; ')}`));
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Import failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
