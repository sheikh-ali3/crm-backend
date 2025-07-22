// Script to seed products into the database
const mongoose = require('mongoose');
const Product = require('./models/productModel');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Generate a unique access link token
const generateAccessLink = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Sample products data
const sampleProducts = [
  {
    productId: 'crm-pro',
    name: 'CRM Professional',
    description: 'Complete customer relationship management solution',
    icon: '📊',
    active: true,
    accessLink: generateAccessLink(),
    createdBy: '000000000000000000000001' // Placeholder ID
  },
  {
    productId: 'hrms-basic',
    name: 'HRMS Basic',
    description: 'Human resources management system',
    icon: '👥',
    active: true,
    accessLink: generateAccessLink(),
    createdBy: '000000000000000000000001' // Placeholder ID
  },
  {
    productId: 'job-portal',
    name: 'Job Portal',
    description: 'Full-featured job posting and application platform',
    icon: '🔍',
    active: true,
    accessLink: generateAccessLink(),
    createdBy: '000000000000000000000001' // Placeholder ID
  }
];

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(async () => {
    console.log('MongoDB connected successfully');
    
    try {
      // Clear existing products
      await Product.deleteMany({});
      console.log('Deleted existing products');
      
      // Insert sample products
      await Product.insertMany(sampleProducts);
      console.log('Sample products added successfully');
      
      // List all products
      const products = await Product.find({});
      console.log('Current products:');
      console.log(products);
      
      mongoose.connection.close();
    } catch (error) {
      console.error('Error seeding products:', error);
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  }); 