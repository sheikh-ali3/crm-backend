const mongoose = require('mongoose');

// TODO: Fill in your Atlas connection string below:
const MONGO_URI = 'mongodb+srv://instructorali123:ZLrhaYQgc6Ync@cluster0.xus1zye.mongodb.net/crm-system?retryWrites=true&w=majority&appName=Cluster0'; // <-- Updated URI

// TODO: Fill in your admin email and company name below:
const ADMIN_EMAIL = 'tech@example.com'; // <-- Use this email exactly!
const ENTERPRISE_ID = 'ent-001'; // (or any unique string)
const COMPANY_NAME = 'Your Company Name'; // (put your real company name)

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function run() {
  await mongoose.connect(MONGO_URI);

  // Print current db and collection
  console.log('Connected to DB:', mongoose.connection.name);
  console.log('Looking for user with email:', ADMIN_EMAIL);

  // List all users with that email
  const users = await User.find({ email: ADMIN_EMAIL });
  console.log('Found users:', users);

  if (users.length === 0) {
    console.error('Admin user not found!');
    process.exit(1);
  }

  // If you have multiple, pick the one with role: "admin"
  const user = users.find(u => u.role === 'admin');
  if (!user) {
    console.error('No user with role \"admin\" and that email!');
    process.exit(1);
  }

  user.enterprise = user.enterprise || {};
  user.enterprise.enterpriseId = ENTERPRISE_ID;
  user.enterprise.companyName = COMPANY_NAME;
  user.permissions = user.permissions || {};
  user.permissions.crmAccess = true;

  await user.save();
  console.log('Admin user updated successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
}); 