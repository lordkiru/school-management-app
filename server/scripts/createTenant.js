require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

/**
 * Script to manually create a new tenant (school)
 * Usage: node scripts/createTenant.js
 */

async function createTenant() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get input from command line or use defaults
    const schoolName = process.argv[2] || 'Demo School';
    const subdomain = process.argv[3] || 'demo';
    const adminEmail = process.argv[4] || 'admin@demo.com';
    const adminPassword = process.argv[5] || 'Admin@123';
    const adminName = process.argv[6] || 'Admin User';

    // Check if subdomain already exists
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      console.log('❌ Error: Subdomain already exists');
      process.exit(1);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      console.log('❌ Error: Email already exists');
      process.exit(1);
    }

    // Generate unique tenant ID
    const tenantId = `tenant_${subdomain}_${Date.now()}`;

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create tenant
    const tenant = await Tenant.create({
      tenantId,
      schoolName,
      subdomain: subdomain.toLowerCase(),
      subscriptionPlan: 'trial',
      subscriptionStatus: 'trialing',
      trialEndsAt,
      primaryContact: {
        name: adminName,
        email: adminEmail
      },
      status: 'active',
      limits: {
        maxStudents: 50,
        maxStaff: 10,
        maxStorage: 1024,
        features: {
          sms: false,
          advancedReporting: false,
          apiAccess: false,
          whiteLabel: false,
          prioritySupport: false
        }
      }
    });

    console.log('✅ Tenant created:', {
      tenantId: tenant.tenantId,
      schoolName: tenant.schoolName,
      subdomain: tenant.subdomain,
      url: tenant.url
    });

    // Create subscription record
    const subscription = await Subscription.create({
      tenantId,
      plan: 'trial',
      interval: 'trial',
      amount: 0,
      currency: 'NGN',
      status: 'trialing',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
      trialStart: new Date(),
      trialEnd: trialEndsAt
    });

    console.log('✅ Subscription created:', {
      plan: subscription.plan,
      status: subscription.status,
      trialEnds: subscription.trialEnd
    });

    // Create proprietor user
    const user = await User.create({
      tenantId,
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'proprietor'
    });

    console.log('✅ Admin user created:', {
      name: user.name,
      email: user.email,
      role: user.role
    });

    console.log('\n🎉 School setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`School Name: ${schoolName}`);
    console.log(`Subdomain: ${subdomain}`);
    console.log(`URL: https://${subdomain}.schoolsaas.com`);
    console.log(`Admin Email: ${adminEmail}`);
    console.log(`Admin Password: ${adminPassword}`);
    console.log(`Trial Ends: ${trialEndsAt.toLocaleDateString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tenant:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  console.log('🚀 Creating new tenant...\n');
  
  // Show usage if no arguments
  if (process.argv.length < 3) {
    console.log('Usage: node scripts/createTenant.js <schoolName> <subdomain> <adminEmail> <adminPassword> <adminName>');
    console.log('\nExample:');
    console.log('node scripts/createTenant.js "Greenwood School" greenwood admin@greenwood.com Admin@123 "John Doe"');
    console.log('\nOr run with defaults:');
    console.log('node scripts/createTenant.js\n');
  }
  
  createTenant();
}

module.exports = createTenant;
