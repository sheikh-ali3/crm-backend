require('dotenv').config();
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}
module.exports = mongoURI; 