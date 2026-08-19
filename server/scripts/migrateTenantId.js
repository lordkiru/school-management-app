/**
 * Data Migration Script: Add tenantId to Existing Records
 * 
 * This script migrates existing data to support multi-tenancy by:
 * 1. Creating a default tenant for existing data
 * 2. Adding tenantId to all existing records
 * 3. Creating a default subscription
 * 
 * IMPORTANT: Backup your database before running this script!
 * 
 * Usage: node server/scripts/migrateTenantId.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Import models
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Score = require('../models/Score');
const Fee = require('../models/Fee');
const Parent = require('../models/Parent');
const School = require('../models/School');
const Session = require('../models/Session');
const Timetable = require('../models/Timetable');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');

const DEFAULT_TENANT_ID = 'tenant_default_legacy';

async function migrateTenantId() {
  try {
    console.log('🚀 Starting tenant migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Check if default tenant already exists
    let defaultTenant = await Tenant.findOne({ tenantId: DEFAULT_TENANT_ID });
    
    if (defaultTenant) {
      console.log('⚠️  Default tenant already exists. Using existing tenant.\n');
    } else {
      // Step 2: Create default tenant
      console.log('📝 Creating default tenant...');
      defaultTenant = new Tenant({
        tenantId: DEFAULT_TENANT_ID,
        name: 'Legacy School (Migrated)',
        subdomain: 'legacy',
        status: 'active',
      });
      await defaultTenant.save();
      console.log('✅ Default tenant created\n');

      // Step 3: Create default subscription
      console.log('📝 Creating default subscription...');
      const subscription = new Subscription({
        tenantId: DEFAULT_TENANT_ID,
        plan: 'professional',
        billingCycle: 'yearly',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      });
      await subscription.save();
      console.log('✅ Default subscription created\n');
    }

    // Step 4: Find a proprietor user to link as owner
    const proprietor = await User.findOne({ role: 'proprietor' });
    if (proprietor && !defaultTenant.ownerId) {
      defaultTenant.ownerId = proprietor._id;
      await defaultTenant.save();
      console.log('✅ Linked proprietor as tenant owner\n');
    }

    // Step 5: Migrate all collections
    const collections = [
      { model: User, name: 'Users' },
      { model: Student, name: 'Students' },
      { model: Class, name: 'Classes' },
      { model: Subject, name: 'Subjects' },
      { model: Score, name: 'Scores' },
      { model: Fee, name: 'Fees' },
      { model: Parent, name: 'Parents' },
      { model: School, name: 'Schools' },
      { model: Session, name: 'Sessions' },
      { model: Timetable, name: 'Timetables' },
      { model: AuditLog, name: 'AuditLogs' },
      { model: Counter, name: 'Counters' },
    ];

    console.log('📊 Migrating collections...\n');

    for (const { model, name } of collections) {
      try {
        // Count records without tenantId
        const count = await model.countDocuments({ tenantId: { $exists: false } });
        
        if (count === 0) {
          console.log(`✅ ${name}: No records to migrate (${count} records)`);
          continue;
        }

        // Update all records without tenantId
        const result = await model.updateMany(
          { tenantId: { $exists: false } },
          { $set: { tenantId: DEFAULT_TENANT_ID } }
        );

        console.log(`✅ ${name}: Migrated ${result.modifiedCount} records`);
      } catch (error) {
        console.error(`❌ ${name}: Migration failed - ${error.message}`);
      }
    }

    console.log('\n📊 Migration Summary:\n');

    // Print summary
    for (const { model, name } of collections) {
      const total = await model.countDocuments();
      const migrated = await model.countDocuments({ tenantId: DEFAULT_TENANT_ID });
      console.log(`   ${name}: ${migrated}/${total} records with tenantId`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify data integrity');
    console.log('   2. Test application functionality');
    console.log('   3. Update client application if needed');
    console.log('   4. Users will need to re-login to get new JWT tokens with tenantId\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
migrateTenantId();
