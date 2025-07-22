const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const users = [
  {
    email: 'superadmin@example.com',
    password: 'superadminpassword',
    role: 'superadmin',
    profile: {
      fullName: 'Super Admin',
      phone: '123-456-7890',
      department: 'Management',
      status: 'active'
    }
  },
  {
    email: 'admin1@example.com',
    password: 'admin123',
    role: 'admin',
    profile: {
      fullName: 'John Admin',
      phone: '123-456-7891',
      department: 'Sales',
      status: 'active'
    }
  },
  {
    email: 'admin2@example.com',
    password: 'admin456',
    role: 'admin',
    profile: {
      fullName: 'Jane Admin',
      phone: '123-456-7892',
      department: 'Marketing',
      status: 'active'
    }
  },
  {
    email: 'user1@example.com',
    password: 'user123',
    role: 'user',
    profile: {
      fullName: 'John User',
      phone: '123-456-7893',
      department: 'Support',
      status: 'active'
    }
  },
  {
    email: 'user2@example.com',
    password: 'user456',
    role: 'user',
    profile: {
      fullName: 'Jane User',
      phone: '123-456-7894',
      department: 'Sales',
      status: 'active'
    }
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Hash passwords and create users
    const hashedUsers = users.map(user => ({
      ...user,
      password: bcrypt.hashSync(user.password, 10)
    }));

    // Insert users
    await User.insertMany(hashedUsers);
    console.log('Database seeded successfully');

    // Log the created users (without passwords)
    const createdUsers = await User.find({}).select('-password');
    console.log('Created Users:', createdUsers);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase(); 