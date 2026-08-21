/**
 * Read-only diagnostic: list what's actually in the users and tenants collections.
 * Usage: node server/scripts/inspectDb.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB:', mongoose.connection.db.databaseName, '\n');

    const users = await User.find({}, 'email role tenantId createdAt').lean();
    console.log(`👤 Users (${users.length} total):`);
    users.forEach(u => console.log(`   - ${u.email} | role: ${u.role} | tenantId: ${u.tenantId} | created: ${u.createdAt}`));

    console.log('');

    const tenants = await Tenant.find({}, 'tenantId schoolName status subdomain primaryContact createdAt').lean();
    console.log(`🏫 Tenants (${tenants.length} total):`);
    tenants.forEach(t => console.log(`   - "${t.schoolName}" | tenantId: ${t.tenantId} | subdomain: ${t.subdomain} | primaryContact: ${JSON.stringify(t.primaryContact)} | created: ${t.createdAt}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

inspect();