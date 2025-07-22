// Usage: node fixTicketSubmittedBy.js <userEmail> <correctUserId>
// Example: node fixTicketSubmittedBy.js test@byte.com 685590f851a7ef97e232f5c4

const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

const MONGO_URI= "mongodb+srv://instructorali123:ZLrhaYQgc6Ync@cluster0.xus1zye.mongodb.net/crm-system?retryWrites=true&w=majority&appName=Cluster0";

async function fixSubmittedBy(email, correctUserId) {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error('No user found with email:', email);
      process.exit(1);
    }
    if (user._id.toString() !== correctUserId) {
      console.warn('Warning: Provided userId does not match the user found by email. Using the user found by email.');
    }
    const result = await Ticket.updateMany(
      { email, submittedBy: { $ne: user._id } },
      { $set: { submittedBy: user._id } }
    );
    console.log(`Updated ${result.nModified || result.modifiedCount} tickets for email ${email} to submittedBy ${user._id}`);
  } catch (err) {
    console.error('Error updating tickets:', err);
  } finally {
    await mongoose.disconnect();
  }
}

const [,, userEmail, correctUserId] = process.argv;
if (!userEmail || !correctUserId) {
  console.error('Usage: node fixTicketSubmittedBy.js <userEmail> <correctUserId>');
  process.exit(1);
}

fixSubmittedBy(userEmail, correctUserId); 

// Debug: List all users with their emails
async function debugListUsers() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const users = await User.find({});
  users.forEach(u => console.log(u.email, u._id.toString()));
  await mongoose.disconnect();
}

// Uncomment to run this debug function
// debugListUsers(); 