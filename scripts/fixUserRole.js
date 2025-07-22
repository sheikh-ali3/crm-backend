// Usage: node fixUserRole.js <userId> <role>
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Use MONGO_URI from .env or fallback to provided string
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://instructorali123:ZLrhaYQgc6Ync@cluster0.xus1zye.mongodb.net/crm-system?retryWrites=true&w=majority&appName=Cluster0';

async function fixUserRole(userId, newRole) {
  try {
    await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
    const result = await User.updateOne(
      { _id: userId },
      { $set: { role: newRole } }
    );
    if (result.nModified === 1 || result.modifiedCount === 1) {
      console.log(`Successfully updated user ${userId} to role '${newRole}'.`);
    } else if (result.matchedCount === 1) {
      console.log(`User ${userId} already has role '${newRole}'.`);
    } else {
      console.log(`User with ID ${userId} not found.`);
    }
  } catch (err) {
    console.error('Error updating user role:', err);
  } finally {
    await mongoose.disconnect();
  }
}

const [,, userId, newRole] = process.argv;
if (!userId || !newRole) {
  console.error('Usage: node fixUserRole.js <userId> <role>');
  process.exit(1);
}
fixUserRole(userId, newRole); 