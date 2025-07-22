const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/customer');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}
console.log(`Using database: ${mongoUri}`);

// Connect to MongoDB
async function connectToDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    return false;
  }
}

async function showStats() {
  try {
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const superadminCount = await User.countDocuments({ role: 'superadmin' });
    const customerCount = await Customer.countDocuments();
    const leadCount = await Customer.countDocuments({ status: 'lead' });
    
    console.log('\n=== Database Statistics ===');
    console.log(`Total Users: ${userCount}`);
    console.log(`- Superadmins: ${superadminCount}`);
    console.log(`- Admins: ${adminCount}`);
    console.log(`- Regular users: ${userCount - adminCount - superadminCount}`);
    console.log(`Total Customers: ${customerCount}`);
    console.log(`- Leads: ${leadCount}`);
    console.log(`- Active customers: ${customerCount - leadCount}`);
    console.log('===========================\n');
  } catch (error) {
    console.error('Error getting stats:', error.message);
  }
}

async function createDefaultSuperAdmin() {
  try {
    // Check if a superadmin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      console.log('A superadmin already exists in the database.');
      return;
    }
    
    // Create the default superadmin
    const password = 'superadmin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const superAdmin = new User({
      email: 'superadmin@example.com',
      password: hashedPassword,
      role: 'superadmin',
      profile: {
        fullName: 'Super Admin',
        phone: '+18005551234',
        department: 'Management',
        joinDate: new Date(),
        status: 'active'
      }
    });
    
    await superAdmin.save();
    console.log('✅ Default superadmin created successfully');
    console.log('Email: superadmin@example.com');
    console.log('Password: superadmin123');
  } catch (error) {
    console.error('Error creating superadmin:', error.message);
  }
}

// Process command-line arguments
async function main() {
  const args = process.argv.slice(2);
  
  // Connect to the database first
  const isConnected = await connectToDB();
  if (!isConnected) {
    console.error('Exiting due to database connection failure');
    process.exit(1);
  }
  
  // Default action is to show stats
  if (args.length === 0) {
    await showStats();
    process.exit(0);
  }
  
  // Process commands
  for (const arg of args) {
    switch (arg) {
      case '--stats':
        await showStats();
        break;
      case '--create-superadmin':
        await createDefaultSuperAdmin();
        break;
      default:
        console.log(`Unknown command: ${arg}`);
    }
  }
  
  // Close the connection
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
}); 