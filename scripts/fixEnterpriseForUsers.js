// Script to update all users' enterprise info from their admin
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('MONGO_URI environment variable is not set. Please set it in your .env file or export it before running this script.');
  process.exit(1);
}

async function updateUsersEnterprise() {
  await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Get all admins (role: 'admin')
  const admins = await User.find({ role: 'admin' });
  const adminMap = {};
  admins.forEach(admin => {
    adminMap[admin._id.toString()] = admin.enterprise || {};
  });

  // Get all users (role: 'user')
  const users = await User.find({ role: 'user' });
  let updatedCount = 0;
  for (const user of users) {
    let enterprise = {};
    if (user.createdBy && adminMap[user.createdBy.toString()]) {
      // Copy from admin
      const adminEnterprise = adminMap[user.createdBy.toString()];
      enterprise = {
        enterpriseId: adminEnterprise.enterpriseId || '',
        companyName: adminEnterprise.companyName || '',
        logo: adminEnterprise.logo || '',
        address: adminEnterprise.address || '',
        mailingAddress: adminEnterprise.mailingAddress || '',
        city: adminEnterprise.city || '',
        country: adminEnterprise.country || '',
        zipCode: adminEnterprise.zipCode || '',
        phoneNumber: adminEnterprise.phoneNumber || '',
        companyEmail: adminEnterprise.companyEmail || '',
        loginLink: adminEnterprise.loginLink || '',
        industry: adminEnterprise.industry || '',
        businessType: adminEnterprise.businessType || ''
      };
    }
    // Update user if needed
    await User.updateOne({ _id: user._id }, { $set: { enterprise } });
    updatedCount++;
  }

  // Optionally, update admins to ensure their own enterprise fields are complete
  for (const admin of admins) {
    const enterprise = {
      enterpriseId: admin.enterprise?.enterpriseId || '',
      companyName: admin.enterprise?.companyName || '',
      logo: admin.enterprise?.logo || '',
      address: admin.enterprise?.address || '',
      mailingAddress: admin.enterprise?.mailingAddress || '',
      city: admin.enterprise?.city || '',
      country: admin.enterprise?.country || '',
      zipCode: admin.enterprise?.zipCode || '',
      phoneNumber: admin.enterprise?.phoneNumber || '',
      companyEmail: admin.enterprise?.companyEmail || '',
      loginLink: admin.enterprise?.loginLink || '',
      industry: admin.enterprise?.industry || '',
      businessType: admin.enterprise?.businessType || ''
    };
    await User.updateOne({ _id: admin._id }, { $set: { enterprise } });
  }

  console.log(`Updated ${updatedCount} users and all admins with enterprise info.`);
  await mongoose.disconnect();
}

updateUsersEnterprise().catch(err => {
  console.error('Error updating users:', err);
  mongoose.disconnect();
}); 