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

// Create additional admins and customers
async function createMoreData() {
  try {
    console.log('\nCreating additional data...');
    
    // Create 5 more admins
    const adminData = [
      {
        email: 'admin1@example.com',
        password: 'admin123',
        role: 'admin',
        permissions: { crmAccess: true },
        profile: {
          fullName: 'Sarah Johnson',
          department: 'Sales',
          phone: '555-111-2222',
          status: 'active'
        }
      },
      {
        email: 'admin2@example.com',
        password: 'admin123',
        role: 'admin',
        permissions: { crmAccess: true },
        profile: {
          fullName: 'Michael Brown',
          department: 'Marketing',
          phone: '555-222-3333',
          status: 'active'
        }
      },
      {
        email: 'admin3@example.com',
        password: 'admin123',
        role: 'admin',
        permissions: { crmAccess: false },
        profile: {
          fullName: 'Emily Davis',
          department: 'Support',
          phone: '555-333-4444',
          status: 'active'
        }
      },
      {
        email: 'admin4@example.com',
        password: 'admin123',
        role: 'admin',
        permissions: { crmAccess: true },
        profile: {
          fullName: 'David Wilson',
          department: 'Operations',
          phone: '555-444-5555',
          status: 'active'
        }
      },
      {
        email: 'admin5@example.com',
        password: 'admin123',
        role: 'admin',
        permissions: { crmAccess: false },
        profile: {
          fullName: 'Lisa Anderson',
          department: 'Finance',
          phone: '555-555-6666',
          status: 'active'
        }
      }
    ];

    const createdAdmins = [];
    for (const admin of adminData) {
      const existingAdmin = await User.findOne({ email: admin.email });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        const newAdmin = await User.create({
          ...admin,
          password: hashedPassword
        });
        createdAdmins.push(newAdmin);
        console.log(`- Created admin: ${newAdmin.email}`);
      }
    }

    // Create more customers
    const customerData = [
      {
        name: 'Tech Solutions Inc',
        email: 'tech@example.com',
        phone: '555-666-7777',
        company: 'Tech Solutions',
        status: 'customer',
        notes: 'Enterprise client',
        source: 'website',
        potentialValue: 25000,
        conversionProbability: 'high',
        lastContact: new Date()
      },
      {
        name: 'Global Marketing',
        email: 'global@example.com',
        phone: '555-777-8888',
        company: 'Global Marketing Group',
        status: 'lead',
        notes: 'Interested in marketing automation',
        source: 'referral',
        potentialValue: 15000,
        conversionProbability: 'medium',
        lastContact: new Date()
      },
      {
        name: 'Innovative Systems',
        email: 'innovative@example.com',
        phone: '555-888-9999',
        company: 'Innovative Systems',
        status: 'customer',
        notes: 'Regular client, needs support',
        source: 'event',
        potentialValue: 20000,
        conversionProbability: 'high',
        lastContact: new Date()
      },
      {
        name: 'Digital Solutions',
        email: 'digital@example.com',
        phone: '555-999-0000',
        company: 'Digital Solutions Ltd',
        status: 'lead',
        notes: 'New lead, needs follow-up',
        source: 'social',
        potentialValue: 10000,
        conversionProbability: 'medium',
        lastContact: new Date()
      },
      {
        name: 'Enterprise Systems',
        email: 'enterprise@example.com',
        phone: '555-000-1111',
        company: 'Enterprise Systems Corp',
        status: 'customer',
        notes: 'VIP client, high priority',
        source: 'website',
        potentialValue: 30000,
        conversionProbability: 'high',
        lastContact: new Date()
      }
    ];

    for (const customer of customerData) {
      const existingCustomer = await Customer.findOne({ email: customer.email });
      if (!existingCustomer) {
        // Assign to a random admin
        const randomAdmin = createdAdmins[Math.floor(Math.random() * createdAdmins.length)];
        const newCustomer = await Customer.create({
          ...customer,
          assignedTo: randomAdmin._id
        });
        console.log(`- Created customer: ${newCustomer.name}`);

        // Add activities
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
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            isImportant: true
          }
        ];

        for (const activity of activities) {
          await Activity.create({
            ...activity,
            customerId: newCustomer._id,
            createdBy: randomAdmin._id,
            assignedTo: randomAdmin._id
          });
          console.log(`  - Added activity: ${activity.subject}`);
        }

        // Add deals for customers
        if (newCustomer.status === 'customer') {
          newCustomer.deals = [
            {
              title: 'Annual Subscription',
              value: customer.potentialValue,
              status: 'won',
              closingDate: new Date()
            },
            {
              title: 'Premium Upgrade',
              value: customer.potentialValue * 1.5,
              status: 'pending',
              closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          ];
          await newCustomer.save();
          console.log(`  - Added deals for ${newCustomer.name}`);
        }
      }
    }

    console.log('\nAdditional data creation completed successfully!');
    
  } catch (error) {
    console.error('Error creating additional data:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
async function main() {
  console.log('=========================');
  console.log(' ADDITIONAL DATA CREATION');
  console.log('=========================');
  
  const connected = await connectToDb();
  if (connected) {
    await createMoreData();
  }
  process.exit(0);
}

main(); 