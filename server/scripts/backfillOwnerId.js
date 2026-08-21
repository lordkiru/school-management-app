/**
 * One-off script: link the existing super admin tenant to its owner user.
 * Only needed if you ran createSuperAdmin.js BEFORE the ownerId field was
 * added to the Tenant model — safe to run again, it's a no-op if already linked.
 *
 * Usage: node server/scripts/backfillOwnerId.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

async function backfill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    console.log('MONGO_URI starts with:', process.env.MONGO_URI.slice(0, 25));
    console.log('');

    const superAdmin = await User.findOne({ role: 'super_admin' });

    if (!superAdmin) {
      console.log('❌ No super_admin user found. Nothing to link.');
      return;
    }

    const result = await Tenant.updateOne(
      { tenantId: 'tenant_super_admin_platform' },
      { ownerId: superAdmin._id }
    );

    if (result.matchedCount === 0) {
      console.log('❌ No tenant with tenantId "tenant_super_admin_platform" found.');
    } else {
      console.log(`✅ Linked tenant to owner: ${superAdmin.email} (${superAdmin._id})`);
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