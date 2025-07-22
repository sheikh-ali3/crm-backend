const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const fixUserEnterprise = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://instructorali123:ZLrhaYQgc6Ync@cluster0.xus1zye.mongodb.net/crm-system?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');

    // Find all users with role 'user' that don't have enterprise information
    const usersWithoutEnterprise = await User.find({
      role: 'user',
      $or: [
        { enterprise: { $exists: false } },
        { 'enterprise.enterpriseId': { $exists: false } },
        { 'enterprise.enterpriseId': '' }
      ]
    });

    console.log(`Found ${usersWithoutEnterprise.length} users without enterprise information`);

    for (const user of usersWithoutEnterprise) {
      if (user.createdBy) {
        // Find the creator (admin) of this user
        const creator = await User.findById(user.createdBy);
        if (creator && creator.enterprise && creator.enterprise.enterpriseId) {
          // Update the user with the creator's enterprise information
          user.enterprise = {
            enterpriseId: creator.enterprise.enterpriseId,
            companyName: creator.enterprise.companyName || '',
            logo: creator.enterprise.logo || '',
            address: creator.enterprise.address || '',
            mailingAddress: creator.enterprise.mailingAddress || '',
            city: creator.enterprise.city || '',
            country: creator.enterprise.country || '',
            zipCode: creator.enterprise.zipCode || '',
            phoneNumber: creator.enterprise.phoneNumber || '',
            companyEmail: creator.enterprise.companyEmail || '',
            loginLink: creator.enterprise.loginLink || '',
            industry: creator.enterprise.industry || '',
            businessType: creator.enterprise.businessType || ''
          };
          
          await user.save();
          console.log(`Fixed enterprise information for user: ${user.email}`);
        } else {
          console.log(`Could not find creator or creator's enterprise for user: ${user.email}`);
        }
      } else {
        console.log(`User ${user.email} has no createdBy field`);
      }
    }

    console.log('Enterprise information fix completed');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing user enterprise information:', error);
    process.exit(1);
  }
};

fixUserEnterprise(); 