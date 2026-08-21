/**
 * Create Super Admin User Script
 * 
 * This script creates a super admin user who can access the platform dashboard
 * and manage all tenants, subscriptions, and users.
 * 
 * Usage: node server/scripts/createSuperAdmin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Works around Windows/ISP DNS not resolving mongodb+srv SRV records
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');

const SUPER_ADMIN_TENANT_ID = 'tenant_super_admin_platform';

async function createSuperAdmin() {
  try {
    console.log('🚀 Creating Super Admin user...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if super admin tenant exists
    let superAdminTenant = await Tenant.findOne({ tenantId: SUPER_ADMIN_TENANT_ID });

    // Use default credentials for simplicity
    const name = 'Super Admin';
    const email = 'admin@platform.com';
    const password = 'Admin@123';

    if (!superAdminTenant) {
      console.log('📝 Creating Super Admin tenant...');

      const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years

      superAdminTenant = new Tenant({
        tenantId: SUPER_ADMIN_TENANT_ID,
        schoolName: 'Platform Administration',
        subdomain: 'admin',
        subscriptionPlan: 'enterprise',
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: farFuture,
        primaryContact: {
          name,
          email,
        },
        status: 'active',
      });
      await superAdminTenant.save();
      console.log('✅ Super Admin tenant created\n');

      // Create subscription for super admin tenant
      const subscription = new Subscription({
        tenantId: SUPER_ADMIN_TENANT_ID,
        plan: 'enterprise',
        interval: 'yearly',
        amount: 0,
        currency: 'NGN',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: farFuture,
      });
      await subscription.save();
      console.log('✅ Super Admin subscription created\n');
    } else {
      console.log('⚠️  Super Admin tenant already exists\n');
    }

    // Check if super admin user already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('⚠️  Super Admin user already exists:');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log('\n💡 If you want to create a new super admin, delete the existing one first.\n');
      return;
    }

    console.log('📝 Creating Super Admin with default credentials...\n');

    // Create super admin user
    const superAdmin = new User({
      tenantId: SUPER_ADMIN_TENANT_ID,
      name,
      email,
      password, // Will be hashed by pre-save hook
      role: 'super_admin',
    });

    await superAdmin.save();

    // Link the tenant to its owning super admin user
    superAdminTenant.ownerId = superAdmin._id;
    await superAdminTenant.save();

    console.log('\n✅ Super Admin user created successfully!\n');
    console.log('📋 Super Admin Credentials:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role:     super_admin`);
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🔐 IMPORTANT: Save these credentials securely!\n');
    console.log('📝 Next steps:');
    console.log('   1. Login with these credentials');
    console.log('   2. Access super admin dashboard at /superadmin/dashboard');
    console.log('   3. Manage all tenants and subscriptions');
    console.log('   4. Change the password after first login\n');

  } catch (error) {
    console.error('\n❌ Error creating super admin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run script
createSuperAdmin();