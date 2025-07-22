const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Customer = require('../models/customer');
const Activity = require('../models/activity');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

// Seed data function
async function seedData() {
  try {
    console.log('\nSeeding database with sample data...');
    
    // Create superadmin if not exists
    const superadmin = await User.findOne({ role: 'superadmin' });
    if (!superadmin) {
      const hashedPassword = await bcrypt.hash('superadmin123', 10);
      await User.create({
        email: 'superadmin@example.com',
        password: hashedPassword,
        role: 'superadmin',
        profile: {
          fullName: 'Super Admin',
          department: 'Management',
          status: 'active'
        }
      });
      console.log('- Created SuperAdmin: superadmin@example.com');
    }
    
    // Create test admin if not exists
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      await User.create({
        email: 'admin@example.com',
        password: hashedPassword,
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
      console.log('- Created Admin: admin@example.com');
    }
    
    // Create sample customers
    const customers = [
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        company: 'Tech Corp',
        status: 'customer',
        notes: 'Regular customer, interested in premium services',
        source: 'website',
        potentialValue: 5000,
        conversionProbability: 'high',
        lastContact: new Date()
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-987-6543',
        company: 'Marketing Inc',
        status: 'lead',
        notes: 'New lead, needs follow-up',
        source: 'referral',
        potentialValue: 3000,
        conversionProbability: 'medium',
        lastContact: new Date()
      },
      {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        phone: '555-456-7890',
        company: 'Finance Co',
        status: 'customer',
        notes: 'VIP customer, high priority',
        source: 'event',
        potentialValue: 10000,
        conversionProbability: 'high',
        lastContact: new Date()
      },
      {
        name: 'Alice Brown',
        email: 'alice@example.com',
        phone: '555-789-0123',
        company: 'Retail Solutions',
        status: 'lead',
        notes: 'Interested in enterprise package',
        source: 'social',
        potentialValue: 7500,
        conversionProbability: 'medium',
        lastContact: new Date()
      },
      {
        name: 'Charlie Wilson',
        email: 'charlie@example.com',
        phone: '555-234-5678',
        company: 'Healthcare Systems',
        status: 'customer',
        notes: 'Long-term client, needs support',
        source: 'website',
        potentialValue: 15000,
        conversionProbability: 'high',
        lastContact: new Date()
      }
    ];
    
    // Add customers to database
    for (const customerData of customers) {
      const existingCustomer = await Customer.findOne({ email: customerData.email });
      if (!existingCustomer) {
        const customer = await Customer.create({
          ...customerData,
          assignedTo: admin._id
        });
        console.log(`- Created customer: ${customer.name}`);
        
        // Add sample activities for each customer
        const activities = [
          {
            type: 'call',
            subject: 'Initial Contact',
            description: 'Made first contact with the customer',
            status: 'completed',
            dueDate: new Date(),
            isImportant: true
          },
          {
            type: 'meeting',
            subject: 'Product Demo',
            description: 'Scheduled product demonstration',
            status: 'pending',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            isImportant: true
          },
          {
            type: 'email',
            subject: 'Follow-up',
            description: 'Sent follow-up email with pricing details',
            status: 'completed',
            dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            isImportant: false
          }
        ];
        
        for (const activityData of activities) {
          await Activity.create({
            ...activityData,
            customerId: customer._id,
            createdBy: admin._id,
            assignedTo: admin._id
          });
          console.log(`  - Added activity: ${activityData.subject}`);
        }
        
        // Add sample deals for customers
        if (customer.status === 'customer') {
          customer.deals = [
            {
              title: 'Annual Subscription',
              value: customerData.potentialValue,
              status: 'won',
              closingDate: new Date()
            },
            {
              title: 'Premium Upgrade',
              value: customerData.potentialValue * 1.5,
              status: 'pending',
              closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            },
            {
              title: 'Additional Services',
              value: customerData.potentialValue * 0.5,
              status: 'lost',
              closingDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
            }
          ];
          await customer.save();
          console.log(`  - Added deals for ${customer.name}`);
        }
      }
    }
    
    console.log('\nDatabase seeding completed successfully!');
    console.log('\nYou can now login with:');
    console.log('- SuperAdmin: superadmin@example.com / superadmin123');
    console.log('- Admin: admin@example.com / adminpassword');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
async function main() {
  console.log('=========================');
  console.log(' DATABASE SEEDING UTILITY');
  console.log('=========================');
  
  const connected = await connectToDb();
  if (connected) {
    await seedData();
  }
  process.exit(0);
}

main(); 