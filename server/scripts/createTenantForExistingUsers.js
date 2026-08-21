/**
 * One-off script: create a real tenant for "My School" and link all
 * existing users that currently have no tenantId to it.
 *
 * Safe to run more than once — it won't duplicate the tenant or re-touch
 * users that already have a tenantId.
 *
 * Usage: node server/scripts/createTenantForExistingUsers.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

const SCHOOL_NAME = 'My School';
const SUBDOMAIN = 'myschool';
const PROPRIETOR_EMAIL = 'festus@school.com';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const proprietor = await User.findOne({ email: PROPRIETOR_EMAIL });
    if (!proprietor) {
      console.log(`❌ Could not find a user with email ${PROPRIETOR_EMAIL}. Aborting — nothing changed.`);
      return;
    }

    let tenant = await Tenant.findOne({ subdomain: SUBDOMAIN });

    if (tenant) {
      console.log(`⚠️  Tenant "${tenant.schoolName}" (${tenant.tenantId}) already exists. Reusing it.\n`);
    } else {
      const tenantId = `tenant_${SUBDOMAIN}_${Date.now()}`;
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      tenant = new Tenant({
        tenantId,
        schoolName: SCHOOL_NAME,
        subdomain: SUBDOMAIN,
        subscriptionPlan: 'trial',
        subscriptionStatus: 'trialing',
        trialEndsAt,
        primaryContact: {
          name: proprietor.name,
          email: proprietor.email,
        },
        status: 'active',
      });
      await tenant.save();
      console.log(`✅ Created tenant "${SCHOOL_NAME}" (${tenant.tenantId})\n`);

      const subscription = new Subscription({
        tenantId,
        plan: 'trial',
        interval: 'trial',
        amount: 0,
        currency: 'NGN',
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        trialStart: new Date(),
        trialEnd: trialEndsAt,
      });
      await subscription.save();
      console.log('✅ Created trial subscription for the tenant\n');
    }

    // Link every currently-unlinked user to this tenant
    const unlinkedBefore = await User.find({ tenantId: { $exists: false } }, 'email role').lean();
    console.log(`📋 Users without a tenantId (${unlinkedBefore.length}):`);
    unlinkedBefore.forEach(u => console.log(`   - ${u.email} (${u.role})`));
    console.log('');

    const result = await User.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: tenant.tenantId } }
    );
    console.log(`✅ Linked ${result.modifiedCount} users to tenant ${tenant.tenantId}\n`);

    // Link tenant back to its proprietor as owner
    if (!tenant.ownerId) {
      tenant.ownerId = proprietor._id;
      await tenant.save();
      console.log(`✅ Set ${proprietor.email} as the tenant's owner\n`);
    }

    console.log('🎉 Done. All previously-unlinked users now belong to:', tenant.schoolName, `(${tenant.tenantId})`);
    console.log('\n📝 Important: everyone on this tenant needs to log out and log back in —');
    console.log('   their JWT was issued with tenantId: undefined and needs a fresh one.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

run();