const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/commutesync';

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to MongoDB successfully');
    return false;
  } catch (err) {
    console.warn('Local MongoDB unavailable, starting in-memory database for development...');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('Connected to in-memory MongoDB');
    return true;
  }
}

module.exports = { connectDatabase };
