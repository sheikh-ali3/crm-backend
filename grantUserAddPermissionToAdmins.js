require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const mongoURI = require('./config/mongoURI');

if (!mongoURI) {
  console.error('Error: mongoURI is not defined. Please check config/mongoURI.js or your .env file.');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(mongoURI)
.then(() => {
  console.log('MongoDB connected');
  return updateAdminPermissions();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

async function updateAdminPermissions() {
  try {
    // Use aggregation pipeline update to ensure permissions and permissions.users exist
    const result = await User.updateMany(
      { role: 'admin' },
      [
        {
          $set: {
            permissions: {
              $mergeObjects: [
                "$permissions",
                { users: { $mergeObjects: [ { $ifNull: [ "$permissions.users", {} ] }, { add: true } ] } }
              ]
            }
          }
        }
      ]
    );
    console.log(`Updated ${result.modifiedCount || result.nModified} admin users.`);
  } catch (err) {
    console.error('Error updating admin permissions:', err);
  } finally {
    mongoose.disconnect();
  }
} 