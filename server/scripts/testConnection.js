require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB connection...\n');
console.log('Connection String:', process.env.MONGO_URI.replace(/:[^:@]+@/, ':****@'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('\n✅ MongoDB Connected Successfully!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    process.exit(0);
  })
  .catch((err) => {
    console.log('\n❌ MongoDB Connection Failed!');
    console.log('Error:', err.message);
    console.log('\n💡 Possible solutions:');
    console.log('1. Check if your MongoDB Atlas cluster is PAUSED');
    console.log('2. Go to https://cloud.mongodb.com and RESUME your cluster');
    console.log('3. Wait 1-2 minutes after resuming');
    console.log('4. Check your IP whitelist (0.0.0.0/0 should be there)');
    process.exit(1);
  });
