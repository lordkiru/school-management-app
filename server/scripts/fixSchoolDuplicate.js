/**
 * One-off script: keep the real School record (with logo + real grading
 * config), link it to the tenant, and delete the blank auto-created
 * duplicate.
 *
 * Usage: node server/scripts/fixSchoolDuplicate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const School = require('../models/School');

const REAL_DOC_ID = '6a6aba9bd3dca4ddb294e48e';
const DUPLICATE_DOC_ID = '6a877d6929a019c5671fd8cd';
const TENANT_ID = 'tenant_myschool_1787264213753';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const realDoc = await School.findById(REAL_DOC_ID);
    const duplicateDoc = await School.findById(DUPLICATE_DOC_ID);

    if (!realDoc) {
      console.log('❌ Could not find the real School document. Aborting — nothing changed.');
      return;
    }
    if (!duplicateDoc) {
      console.log('⚠️  Duplicate document not found (already removed?). Will still link the real doc.');
    }

    // Delete the blank duplicate FIRST so it frees up the tenantId for the real doc
    if (duplicateDoc) {
      await School.deleteOne({ _id: DUPLICATE_DOC_ID });
      console.log('✅ Deleted the blank duplicate School document');
    }

    // Now link the real doc to the tenant
    realDoc.tenantId = TENANT_ID;
    await realDoc.save();
    console.log(`✅ Linked your real School record (logo, grading config) to tenant ${TENANT_ID}`);

    console.log('\n🎉 Done. Your school settings and logo should now load correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

run();
