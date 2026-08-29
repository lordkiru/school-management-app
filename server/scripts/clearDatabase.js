/**
 * clearDatabase.js
 *
 * Clears school data in the connected MongoDB database so you can start fresh
 * with new test data. Platform administration records are preserved.
 *
 * SAFETY: this is a genuinely destructive script. It will refuse to run
 * against a database whose name looks like production, unless you pass
 * --force. Always double-check the database name it prints before confirming.
 *
 * USAGE:
 *   node scripts/clearDatabase.js
 *     -> prints what it's about to do and asks for a typed confirmation
 *
 *   node scripts/clearDatabase.js --yes
 *     -> skips the interactive prompt (still blocked on prod-looking names)
 *
 *   node scripts/clearDatabase.js --yes --force
 *     -> skips the prompt AND the production-name guard. Only use this if
 *        you are 100% certain which database MONGO_URI points at.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const readline = require('readline');

const args = process.argv.slice(2);
const skipPrompt = args.includes('--yes') || args.includes('-y');
const force = args.includes('--force');
const PLATFORM_TENANT_ID = 'tenant_super_admin_platform';

// Names that suggest this connection string points at a real, live database.
// This is a heuristic, not a guarantee — always read the printed DB name yourself.
const PROD_NAME_HINTS = ['prod', 'production', 'live'];

function looksLikeProd(dbName) {
  const lower = dbName.toLowerCase();
  return PROD_NAME_HINTS.some((hint) => lower.includes(hint));
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set. Check your .env file.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);

  const dbName = mongoose.connection.name;
  const host = mongoose.connection.host;
  console.log(`\nConnected to database: "${dbName}" on host: ${host}\n`);

  if (looksLikeProd(dbName) && !force) {
    console.error(
      `🛑 Refusing to continue: the database name "${dbName}" looks like it could be ` +
      `production. If you're SURE this is a test/dev database and just has an unlucky ` +
      `name, re-run with --force to override this check.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const collections = await mongoose.connection.db.listCollections().toArray();
  if (collections.length === 0) {
    console.log('Database is already empty. Nothing to do.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('The following collections will be cleared, except protected platform records:');
  for (const c of collections) {
    console.log(`  - ${c.name}`);
  }
  console.log('');

  if (!skipPrompt) {
    const answer = await ask(
      `Type the database name ("${dbName}") to confirm, or anything else to cancel: `
    );
    if (answer.trim() !== dbName) {
      console.log('❌ Confirmation did not match. Nothing was deleted.');
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  console.log('\n🧹 Clearing collections...\n');
  let totalDeleted = 0;

  for (const c of collections) {
    // Skip Mongo's own internal system collections, just in case one shows up
    if (c.name.startsWith('system.')) continue;

    const filter = getDeleteFilter(c.name);
    const result = await mongoose.connection.db.collection(c.name).deleteMany(filter);
    totalDeleted += result.deletedCount;
    console.log(`  ✅ ${c.name}: ${result.deletedCount} document(s) deleted`);
  }

  console.log(`\n✨ Done. ${totalDeleted} total document(s) deleted across ${collections.length} collection(s).`);
  console.log('Preserved: the platform tenant, super-admin users, and the platform subscription.');
  console.log('Indexes and schema validation were left in place — only school documents were removed.');

  await mongoose.disconnect();
  process.exit(0);
}

function getDeleteFilter(collectionName) {
  switch (collectionName) {
    case 'users':
      return { role: { $ne: 'super_admin' } };
    case 'tenants':
      return { tenantId: { $ne: PLATFORM_TENANT_ID } };
    case 'subscriptions':
      return { tenantId: { $ne: PLATFORM_TENANT_ID } };
    default:
      return {};
  }
}

main().catch((err) => {
  console.error('\n❌ Something went wrong:', err.message);
  process.exit(1);
});
