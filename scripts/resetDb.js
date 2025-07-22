/**
 * Database Reset Script
 * WARNING: This will DELETE ALL DATA in the database
 * 
 * Usage: node scripts/resetDb.js [--confirm]
 * The --confirm flag is required to actually perform the reset operation
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');
const Customer = require('../models/customer');

// Check for confirmation flag
const args = process.argv.slice(2);
const hasConfirm = args.includes('--confirm');

// Setup readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Reset database function
async function resetDatabase() {
  try {
    // Drop all collections
    console.log('\nDropping collections...');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const collection of collections) {
      console.log(`- Dropping ${collection.name}...`);
      await mongoose.connection.db.dropCollection(collection.name);
    }
    
    console.log('All collections dropped successfully!');
    
    // Re-create default users
    console.log('\nCreating default users...');
    
    // Create super admin
    const superadmin = await User.create({
      email: 'superadmin@example.com',
      password: await bcrypt.hash('superadmin123', 10),
      role: 'superadmin',
      profile: {
        fullName: 'Super Admin',
        department: 'Management',
        status: 'active'
      }
    });
    console.log('- Created Super Admin:', superadmin.email);
    
    // Create test admin
    const admin = await User.create({
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
    console.log('- Created Test Admin:', admin.email);
    
    console.log('\nDatabase reset completed successfully!');
    console.log('\nYou can now login with:');
    console.log('- SuperAdmin: superadmin@example.com / superadmin123');
    console.log('- Admin: admin@example.com / adminpassword');
    
  } catch (error) {
    console.error('Error during database reset:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Main function
async function main() {
  console.log('=========================');
  console.log(' DATABASE RESET UTILITY');
  console.log('=========================');
  console.log('\n⚠️  WARNING: This will DELETE ALL DATA in your database!');
  console.log('Database:', process.env.MONGO_URI);
  
  if (!hasConfirm) {
    rl.question('\nAre you sure you want to reset the database? This cannot be undone! (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const connected = await connectToDb();
        if (connected) {
          await resetDatabase();
        }
        rl.close();
      } else {
        console.log('Database reset cancelled.');
        rl.close();
      }
    });
  } else {
    console.log('\nConfirmation flag detected. Proceeding with database reset...');
    const connected = await connectToDb();
    if (connected) {
      await resetDatabase();
    }
    process.exit(0);
  }
}

// Run the script
main(); 