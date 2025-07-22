const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// MongoDB connection string
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}
console.log('Connection string:', mongoUri);

// Function to check if MongoDB is running
async function checkMongoDBStatus() {
  try {
    console.log('Checking MongoDB connection...');
    
    // Try to connect with a short timeout
    await mongoose.connect(mongoUri, {
      connectTimeoutMS: 3000, // 3 seconds timeout
      serverSelectionTimeoutMS: 3000
    });
    
    console.log('\n✅ MONGODB IS RUNNING');
    console.log(`Connected to database: ${mongoose.connection.name}`);
    console.log(`MongoDB version: ${mongoose.version}`);
    console.log(`Server: ${mongoose.connection.host}:${mongoose.connection.port}`);
    
    // Close the connection
    await mongoose.connection.close();
    return true;
  } catch (err) {
    console.error('\n❌ MONGODB CONNECTION ERROR');
    console.error('Failed to connect to MongoDB:');
    console.error(err.message);
    
    console.log('\nMONGODB IS NOT RUNNING OR NOT ACCESSIBLE');
    
    // Show instructions to start MongoDB
    console.log('\nTo start MongoDB:');
    
    if (os.platform() === 'win32') {
      console.log('1. Open Command Prompt as Administrator');
      console.log('2. Run: net start MongoDB');
      console.log('   OR');
      console.log('3. Start MongoDB from Services (services.msc)');
    } else if (os.platform() === 'darwin') {
      console.log('1. Run: brew services start mongodb-community');
    } else {
      console.log('1. Run: sudo systemctl start mongod');
    }
    
    console.log('\nAlternatively, you can:');
    console.log('1. Install MongoDB from https://www.mongodb.com/try/download/community');
    console.log('2. Use MongoDB Atlas cloud service: https://www.mongodb.com/cloud/atlas');
    console.log('3. Set USE_MOCK_DB=true in .env file to use mock database instead');
    
    return false;
  }
}

// Execute the check
checkMongoDBStatus()
  .then(isRunning => {
    if (isRunning) {
      console.log('\nMongoDB is ready for use with the CRM system.');
      console.log('You can now start the backend server with: npm start');
    } else {
      console.log('\nPlease start MongoDB before running the CRM system.');
    }
  })
  .catch(err => {
    console.error('Error during MongoDB check:', err);
  }); 