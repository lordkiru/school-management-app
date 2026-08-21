require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const stats = await mongoose.connection.db.stats();
    console.log('Database:', mongoose.connection.db.databaseName);
    console.log('Data size:', (stats.dataSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('Storage size:', (stats.storageSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('Index size:', (stats.indexSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('Total (data+index):', ((stats.dataSize + stats.indexSize) / 1024 / 1024).toFixed(2), 'MB');
    console.log('Collections:', stats.collections);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}
check();
