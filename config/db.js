const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

// For production, set MONGO_URI in a .env file and do not hardcode credentials.
// Example:
// MONGO_URI=mongodb+srv://instructorali123:ZLrhaYQgc6Ync@cluster0.xus1zye.mongodb.net/crm-system?retryWrites=true&w=majority&appName=Cluster0
module.exports = connectDB;
