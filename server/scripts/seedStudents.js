/**
 * Seed 1,200 complete student records across the five school sections.
 *
 * Usage:
 *   node scripts/seedStudents.js
 *   node scripts/seedStudents.js tenant_demo "Demo School" demo admin@demo.example.com Admin@123
 *   node scripts/seedStudents.js tenant_demo "Demo School" demo admin@demo.example.com Admin@123 --owner-only
 *
 * The script creates the tenant, proprietor account, subscription, school,
 * and classes if they do not already exist. It refuses to add duplicate seed
 * students to a tenant.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const School = require('../models/School');
const Class = require('../models/Class');
const Student = require('../models/Student');
const User = require('../models/User');

let [
  tenantId = 'tenant_demo_seed',
  schoolName = 'Demo School',
  subdomain = 'demo',
  adminEmail = 'admin@demo.example.com',
  adminPassword = 'Admin@123',
] = process.argv.slice(2);
const adminName = 'Demo Administrator';
const ownerOnly = process.argv.includes('--owner-only');

const classPlan = [
  { name: 'JSS1', level: 'JSS1', section: 'Secondary', count: 167 },
  { name: 'JSS2', level: 'JSS2', section: 'Secondary', count: 167 },
  { name: 'JSS3', level: 'JSS3', section: 'Secondary', count: 166 },
  { name: 'Primary 1', level: 'Primary 1', section: 'Primary', count: 67 },
  { name: 'Primary 2', level: 'Primary 2', section: 'Primary', count: 67 },
  { name: 'Primary 3', level: 'Primary 3', section: 'Primary', count: 67 },
  { name: 'Primary 4', level: 'Primary 4', section: 'Primary', count: 67 },
  { name: 'Primary 5', level: 'Primary 5', section: 'Primary', count: 66 },
  { name: 'Primary 6', level: 'Primary 6', section: 'Primary', count: 66 },
  { name: 'Nursery 1', level: 'Nursery 1', section: 'Nursery', count: 67 },
  { name: 'Nursery 2', level: 'Nursery 2', section: 'Nursery', count: 67 },
  { name: 'Nursery 3', level: 'Nursery 3', section: 'Nursery', count: 66 },
  { name: 'Kindergarten 1', level: 'Kindergarten 1', section: 'Kindergarten', count: 30 },
  { name: 'Kindergarten 2', level: 'Kindergarten 2', section: 'Kindergarten', count: 30 },
  { name: 'Creche', level: 'Creche', section: 'Creche', count: 40 },
];

const firstNames = [
  'Amina', 'Chinedu', 'Damilola', 'Efe', 'Fatima', 'Gideon', 'Hauwa', 'Ibrahim',
  'Joy', 'Kelechi', 'Lilian', 'Musa', 'Ngozi', 'Oluwaseun', 'Peace', 'Queen',
  'Rasheed', 'Samuel', 'Teni', 'Uche', 'Victor', 'Wura', 'Yusuf', 'Zainab',
];

const lastNames = [
  'Abdullahi', 'Adeyemi', 'Afolabi', 'Balogun', 'Bello', 'Chukwu', 'Danjuma',
  'Eze', 'Ibrahim', 'Ike', 'Lawal', 'Mohammed', 'Nwachukwu', 'Okafor',
  'Okoro', 'Oladele', 'Olowo', 'Oyelami', 'Sani', 'Thomas', 'Usman', 'Williams',
];

function makeDateOfBirth(section, index) {
  const ageRange = {
    Creche: [2, 3],
    Kindergarten: [4, 5],
    Nursery: [3, 6],
    Primary: [6, 11],
    Secondary: [11, 18],
  }[section];
  const [minAge, maxAge] = ageRange;
  const age = minAge + (index % (maxAge - minAge + 1));
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  date.setMonth(index % 12, (index % 26) + 1);
  return date;
}

async function ensureTenant() {
  let tenant = await Tenant.findOne({ tenantId });
  if (!tenant) {
    tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase().trim() });
    if (tenant) {
      tenantId = tenant.tenantId;
      console.log(`Found existing tenant by subdomain: ${tenant.tenantId}`);
    }
  }
  if (!tenant) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    tenant = await Tenant.create({
      tenantId,
      schoolName,
      subdomain: subdomain.toLowerCase(),
      subscriptionPlan: 'trial',
      subscriptionStatus: 'trialing',
      trialEndsAt,
      limits: {
        maxStudents: 1200,
        maxStaff: 100,
        maxStorage: 1024,
        features: {
          sms: true,
          advancedReporting: true,
          apiAccess: true,
          whiteLabel: true,
          prioritySupport: true,
        },
      },
      primaryContact: {
        name: 'Demo Administrator',
        email: `admin@${subdomain}.example.com`,
        phone: '+2348000000000',
      },
      status: 'active',
    });
    console.log(`Created tenant: ${tenant.tenantId}`);
  } else {
    console.log(`Using existing tenant: ${tenant.tenantId}`);
  }

  await School.findOneAndUpdate(
    { tenantId },
    { $setOnInsert: { tenantId, name: schoolName } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let owner = await User.findOne({ tenantId, role: 'proprietor' });
  if (!owner) {
    owner = await User.create({
      tenantId,
      name: adminName,
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword,
      role: 'proprietor',
    });
    console.log(`Created proprietor login: ${owner.email}`);
  } else {
    console.log(`Using existing proprietor login: ${owner.email}`);
  }

  await Tenant.updateOne({ tenantId }, { $set: { ownerId: owner._id } });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  await Subscription.findOneAndUpdate(
    { tenantId, status: 'trialing' },
    {
      $setOnInsert: {
        tenantId,
        plan: 'trial',
        interval: 'trial',
        amount: 0,
        currency: 'NGN',
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
        trialStart: new Date(),
        trialEnd,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seedStudents() {
  const existingCount = await Student.countDocuments({ tenantId });
  if (existingCount > 0) {
    throw new Error(
      `Tenant ${tenantId} already has ${existingCount} student(s). Clear the tenant first or choose another tenantId.`
    );
  }

  const classes = new Map();
  for (const plan of classPlan) {
    const classDoc = await Class.findOneAndUpdate(
      { tenantId, name: plan.name },
      { $setOnInsert: { tenantId, name: plan.name, level: plan.level, section: plan.section } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    classes.set(plan.name, classDoc);
  }

  const students = [];
  let studentNumber = 1;
  for (const plan of classPlan) {
    const classDoc = classes.get(plan.name);
    for (let index = 0; index < plan.count; index += 1) {
      const firstName = firstNames[(studentNumber - 1) % firstNames.length];
      const lastName = lastNames[Math.floor((studentNumber - 1) / firstNames.length) % lastNames.length];
      const gender = studentNumber % 2 === 0 ? 'Female' : 'Male';

      students.push({
        tenantId,
        name: `${firstName} ${lastName} ${studentNumber}`,
        classId: classDoc._id,
        admissionNumber: `SEED${String(studentNumber).padStart(4, '0')}`,
        publicAccessToken: crypto.randomBytes(32).toString('hex'),
        dateOfBirth: makeDateOfBirth(plan.section, studentNumber),
        gender,
        status: 'Active',
        walletBalance: 0,
        password: null,
        mustChangePassword: true,
        lastLoginAt: null,
      });
      studentNumber += 1;
    }
  }

  await Student.insertMany(students, { ordered: true });
  await Tenant.updateOne(
    { tenantId },
    { $set: { 'usage.currentStudents': students.length, 'limits.maxStudents': students.length } }
  );

  console.log(`Created ${students.length} students for ${schoolName}.`);
  for (const plan of classPlan) {
    console.log(`- ${plan.section}: ${plan.count} (${plan.name})`);
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to database: ${mongoose.connection.name}`);
  await ensureTenant();
  if (ownerOnly) {
    console.log('Owner account setup complete.');
    return;
  }
  await seedStudents();
}

main()
  .then(() => {
    console.log('Student seed complete.');
  })
  .catch((error) => {
    console.error(`Student seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
