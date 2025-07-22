const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}
console.log('MongoDB Connection Test');
console.log('======================');
console.log('Testing connection to MongoDB...');
console.log('Connection string:', mongoUri);

// Connect to MongoDB
mongoose.connect(mongoUri, {
  connectTimeoutMS: 5000, // 5 seconds timeout
})
  .then(conn => {
    console.log('\n✅ SUCCESSFULLY CONNECTED TO MONGODB');
    console.log(`Connected to database: ${conn.connection.name}`);
    console.log(`MongoDB version: ${mongoose.version}`);
    console.log(`Server: ${conn.connection.host}:${conn.connection.port}`);
    
    // Get DB statistics
    return mongoose.connection.db.stats();
  })
  .then(stats => {
    console.log('\nDatabase Statistics:');
    console.log(`- Collections: ${stats.collections}`);
    console.log(`- Documents: ${stats.objects}`);
    console.log(`- DB Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    
    // List all collections
    return mongoose.connection.db.listCollections().toArray();
  })
  .then(collections => {
    console.log('\nCollections in database:');
    if (collections.length === 0) {
      console.log('No collections found. Database might be empty.');
    } else {
      collections.forEach(coll => {
        console.log(`- ${coll.name}`);
      });
    }
    
    console.log('\nConnection test completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ CONNECTION ERROR');
    console.error('Failed to connect to MongoDB:');
    console.error(err);
    
    if (err.name === 'MongoNetworkError') {
      console.error('\nPOSSIBLE SOLUTIONS:');
      console.error('1. Make sure MongoDB is running on your computer.');
      console.error('   You can start it with: mongod --dbpath /data/db');
      console.error('2. Check if the MongoDB URI in your .env file is correct.');
      console.error('3. If using MongoDB Atlas, check your network connection and IP whitelist.');
    }
    
    process.exit(1);
  }); 