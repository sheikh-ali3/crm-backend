const mongoose = require('mongoose');
const Service = require('../models/serviceModel');
const User = require('../models/User');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is not set. Please set it in your .env file.');
}
// Connect to MongoDB
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createTestServices() {
  try {
    console.log('Creating test services...');

    // Find a superadmin user to use as createdBy
    const superadmin = await User.findOne({ role: 'superadmin' });
    if (!superadmin) {
      console.log('No superadmin found. Creating one...');
      const newSuperadmin = new User({
        email: 'superadmin@test.com',
        password: 'password123',
        role: 'superadmin',
        profile: {
          fullName: 'Test SuperAdmin'
        }
      });
      await newSuperadmin.save();
      console.log('Created superadmin:', newSuperadmin._id);
    }

    const createdBy = superadmin?._id || (await User.findOne({ role: 'superadmin' }))._id;

    // Create test services
    const testServices = [
      {
        name: 'Web Development',
        description: 'Custom web application development services',
        price: 5000,
        category: 'IT',
        icon: '💻',
        createdBy: createdBy
      },
      {
        name: 'Mobile App Development',
        description: 'iOS and Android mobile application development',
        price: 8000,
        category: 'IT',
        icon: '📱',
        createdBy: createdBy
      },
      {
        name: 'Digital Marketing',
        description: 'Comprehensive digital marketing services',
        price: 3000,
        category: 'Marketing',
        icon: '📈',
        createdBy: createdBy
      },
      {
        name: 'UI/UX Design',
        description: 'User interface and user experience design',
        price: 2500,
        category: 'Design',
        icon: '🎨',
        createdBy: createdBy
      },
      {
        name: 'IT Consulting',
        description: 'Technology consulting and strategy services',
        price: 1500,
        category: 'Consulting',
        icon: '🔧',
        createdBy: createdBy
      }
    ];

    // Check if services already exist
    const existingServices = await Service.find({});
    if (existingServices.length > 0) {
      console.log(`Found ${existingServices.length} existing services. Skipping creation.`);
      console.log('Existing services:');
      existingServices.forEach(service => {
        console.log(`- ${service.name}: $${service.price}`);
      });
      return;
    }

    // Create services
    for (const serviceData of testServices) {
      const service = new Service(serviceData);
      await service.save();
      console.log(`Created service: ${service.name} - $${service.price}`);
    }

    console.log('✅ Test services created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test services:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestServices(); 