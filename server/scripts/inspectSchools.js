require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const School = require('../models/School');

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB:', mongoose.connection.db.databaseName, '\n');

    const schools = await School.find({}).lean();
    console.log(`🏫 School documents (${schools.length} total):\n`);
    schools.forEach((s, i) => {
      console.log(`--- Document ${i + 1} ---`);
      console.log(JSON.stringify(s, null, 2));
      console.log('');
    });

    // Also show the index definition to understand the constraint
    const indexes = await School.collection.indexes();
    console.log('📋 Indexes on schools collection:');
    indexes.forEach(idx => console.log('  ', JSON.stringify(idx.key), idx.unique ? '(unique)' : ''));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

inspect();
