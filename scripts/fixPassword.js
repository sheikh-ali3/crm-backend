/**
 * Password Reset Script
 * This script updates passwords for existing superadmin and admin accounts
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import User model
const User = require('../models/User');

// Connect to MongoDB
async function connectToDb() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to database:', mongoose.connection.name);
    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    return false;
  }
}

// Fix passwords function
async function fixPasswords() {
  try {
    console.log('\nUpdating user passwords...');
    
    // Update super admin password
    const superadmin = await User.findOne({ role: 'superadmin' });
    if (superadmin) {
      const hashedPassword = await bcrypt.hash('superadmin123', 10);
      superadmin.password = hashedPassword;
      await superadmin.save();
      console.log(`- Updated SuperAdmin password for: ${superadmin.email}`);
    } else {
      console.log('- No SuperAdmin found. Creating one...');
      await User.create({
        email: 'superadmin@example.com',
        password: await bcrypt.hash('superadmin123', 10),
        role: 'superadmin',
        profile: {
          fullName: 'Super Admin',
          department: 'Management',
          status: 'active'
        }
      });
      console.log('- Created new SuperAdmin: superadmin@example.com');
    }
    
    // Update admin password
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      admin.password = hashedPassword;
      
      // Make sure admin has CRM access
      if (!admin.permissions) {
        admin.permissions = {};
      }
      admin.permissions.crmAccess = true;
      
      await admin.save();
      console.log(`- Updated Admin password for: ${admin.email}`);
    } else {
      console.log('- No Admin found. Creating one...');
      await User.create({
        email: 'admin@example.com',
        password: await bcrypt.hash('adminpassword', 10),
        role: 'admin',
        permissions: {
          crmAccess: true
        },
        profile: {
          fullName: 'Test Admin',
          department: 'IT',
          phone: '123-456-7890',
          status: 'active'
        }
      });
      console.log('- Created new Admin: admin@example.com');
    }
    
    console.log('\nPassword update completed successfully!');
    console.log('\nYou can now login with:');
    console.log('- SuperAdmin: superadmin@example.com / superadmin123');
    console.log('- Admin: admin@example.com / adminpassword');
    
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
async function main() {
  console.log('=========================');
  console.log(' PASSWORD RESET UTILITY');
  console.log('=========================');
  
  const connected = await connectToDb();
  if (connected) {
    await fixPasswords();
  }
  process.exit(0);
}

main(); 