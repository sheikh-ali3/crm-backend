const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Service = require('../models/serviceModel');
const Quotation = require('../models/quotationModel');
const User = require('../models/User');
const Notification = require('../models/notification');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// MongoDB connection string
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
}

// Connect to MongoDB
async function connectToDb() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to database:', mongoose.connection.name);
    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    return false;
  }
}

// Sample services data
const servicesData = [
  {
    name: 'Web Development',
    description: 'Professional web development services including frontend and backend development, responsive design, and CMS integration.',
    price: 2500,
    category: 'IT',
    icon: '🌐',
    features: [
      { name: 'Responsive Design', included: true },
      { name: 'CMS Integration', included: true },
      { name: 'SEO Optimization', included: false }
    ],
    duration: { value: 30, unit: 'days' },
    active: true
  },
  {
    name: 'Mobile App Development',
    description: 'End-to-end mobile application development for iOS and Android platforms using React Native or native technologies.',
    price: 3500,
    category: 'IT',
    icon: '📱',
    features: [
      { name: 'Cross-platform Support', included: true },
      { name: 'API Integration', included: true },
      { name: 'Push Notifications', included: true }
    ],
    duration: { value: 45, unit: 'days' },
    active: true
  },
  {
    name: 'UI/UX Design',
    description: 'User interface and experience design services focused on creating intuitive, user-friendly digital products.',
    price: 1800,
    category: 'Design',
    icon: '🎨',
    features: [
      { name: 'User Research', included: true },
      { name: 'Wireframing', included: true },
      { name: 'Prototyping', included: true }
    ],
    duration: { value: 15, unit: 'days' },
    active: true
  },
  {
    name: 'SEO Services',
    description: 'Search engine optimization services to improve website visibility and organic traffic.',
    price: 1200,
    category: 'Marketing',
    icon: '📊',
    features: [
      { name: 'Keyword Research', included: true },
      { name: 'On-page Optimization', included: true },
      { name: 'Monthly Reporting', included: true }
    ],
    duration: { value: 3, unit: 'months' },
    active: true
  },
  {
    name: 'Cloud Consulting',
    description: 'Expert consulting services for cloud migration, architecture design, and optimization.',
    price: 2800,
    category: 'Consulting',
    icon: '☁️',
    features: [
      { name: 'Architecture Assessment', included: true },
      { name: 'Migration Planning', included: true },
      { name: 'Cost Optimization', included: true }
    ],
    duration: { value: 1, unit: 'months' },
    active: false
  }
];

// Seed services data
async function seedServices() {
  try {
    // Check if services already exist
    const servicesCount = await Service.countDocuments();
    if (servicesCount > 0) {
      console.log(`Services collection already has ${servicesCount} documents. Skipping seeding.`);
      return [];
    }
    
    console.log('Seeding services data...');
    const createdServices = await Service.insertMany(servicesData);
    console.log(`✅ Successfully seeded ${createdServices.length} services`);
    return createdServices;
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    return [];
  }
}

// Seed quotations data
async function seedQuotations(services) {
  try {
    // Check if quotations already exist
    const quotationsCount = await Quotation.countDocuments();
    if (quotationsCount > 0) {
      console.log(`Quotations collection already has ${quotationsCount} documents. Skipping seeding.`);
      return;
    }
    
    // Get admin users
    const admins = await User.find({ role: 'admin' }).limit(2);
    if (admins.length === 0) {
      console.log('No admin users found. Cannot create quotations.');
      return;
    }
    
    // Create sample quotations
    const quotationsData = [
      {
        serviceId: services[0]._id,
        adminId: admins[0]._id,
        status: 'pending',
        requestDetails: 'Need a corporate website with 5 pages',
        enterpriseDetails: { companyName: 'Acme Corp', contactPerson: 'John Doe' },
        requestedPrice: 5000
      },
      {
        serviceId: services[1]._id,
        adminId: admins[admins.length > 1 ? 1 : 0]._id,
        status: 'approved',
        requestDetails: 'iOS and Android app for our business',
        enterpriseDetails: { companyName: 'Beta Industries', contactPerson: 'Jane Smith' },
        requestedPrice: 7500,
        finalPrice: 8000,
        proposedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      {
        serviceId: services[2]._id,
        adminId: admins[0]._id,
        status: 'rejected',
        requestDetails: 'Complete redesign of our platform',
        enterpriseDetails: { companyName: 'Global Tech', contactPerson: 'Mike Johnson' },
        requestedPrice: 12000,
        rejectionReason: 'Budget constraints'
      },
      {
        serviceId: services[3]._id,
        adminId: admins[admins.length > 1 ? 1 : 0]._id,
        status: 'completed',
        requestDetails: 'SEO optimization for our e-commerce site',
        enterpriseDetails: { companyName: 'Delta Services', contactPerson: 'Sarah Williams' },
        requestedPrice: 8500,
        finalPrice: 8500,
        completedDate: new Date()
      }
    ];
    
    console.log('Seeding quotations data...');
    const createdQuotations = await Quotation.insertMany(quotationsData);
    console.log(`✅ Successfully seeded ${createdQuotations.length} quotations`);

    // Create sample notifications
    console.log('Creating sample notifications...');
    try {
      // Check if notifications collection exists
      const notificationsExist = await Notification.countDocuments();
      
      if (notificationsExist === 0) {
        // Create sample notifications for superadmin
        const superadminNotifications = [
          {
            userId: superadmin._id,
            message: 'Welcome to the CRM System. As a SuperAdmin, you can manage all aspects of the system.',
            title: 'Welcome',
            type: 'info',
            read: false,
            createdAt: new Date()
          },
          {
            userId: superadmin._id,
            message: 'A new quotation request has been submitted by Enterprise A.',
            title: 'New Quotation Request',
            type: 'info',
            read: false,
            relatedTo: {
              model: 'Quotation',
              id: quotationsData[0]._id
            },
            link: '/superadmin/services?tab=quotations',
            createdAt: new Date(Date.now() - 3600000) // 1 hour ago
          },
          {
            userId: superadmin._id,
            message: 'Enterprise B has requested a quotation for Mobile App Development.',
            title: 'New Quotation Request',
            type: 'info',
            read: true,
            relatedTo: {
              model: 'Quotation',
              id: quotationsData[1]._id
            },
            link: '/superadmin/services?tab=quotations',
            createdAt: new Date(Date.now() - 86400000) // 1 day ago
          }
        ];
        
        // Create sample notifications for admins
        const adminNotifications = [];
        
        for (const admin of admins) {
          // Find quotations for this admin
          const adminQuotations = quotationsData.filter(q => 
            q.adminId.toString() === admin._id.toString()
          );
          
          if (adminQuotations.length > 0) {
            // Create a notification for each quotation
            for (const quotation of adminQuotations) {
              adminNotifications.push({
                userId: admin._id,
                message: `Your quotation for ${quotation.serviceId.name || 'a service'} has been ${quotation.status}.`,
                title: `Quotation ${quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}`,
                type: quotation.status === 'approved' ? 'success' : 
                      quotation.status === 'rejected' ? 'error' : 'info',
                read: false,
                relatedTo: {
                  model: 'Quotation',
                  id: quotation._id
                },
                link: '/admin/services?tab=quotations',
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 259200000)) // Random time in last 3 days
              });
            }
            
            // Add a welcome notification
            adminNotifications.push({
              userId: admin._id,
              message: `Welcome to the CRM System, ${admin.profile?.fullName || admin.email}. You can manage your enterprise services here.`,
              title: 'Welcome',
              type: 'info',
              read: true,
              createdAt: new Date(Date.now() - 604800000) // 1 week ago
            });
          }
        }
        
        // Combine all notifications
        const allNotifications = [...superadminNotifications, ...adminNotifications];
        
        // Insert notifications
        if (allNotifications.length > 0) {
          await Notification.insertMany(allNotifications);
          console.log(`Created ${allNotifications.length} sample notifications`);
        }
      } else {
        console.log(`Skipping notifications creation, ${notificationsExist} notifications already exist`);
      }
    } catch (notificationError) {
      console.error('Error creating sample notifications:', notificationError);
      // Don't fail the seeding process if notifications can't be created
    }
  } catch (error) {
    console.error('❌ Error seeding quotations:', error);
  }
}

// Main function to run the seeding process
async function seedData() {
  const connected = await connectToDb();
  if (!connected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }
  
  try {
    // Seed services first
    const services = await seedServices();
    
    // Seed quotations if services were created
    if (services.length > 0) {
      await seedQuotations(services);
    }
    
    console.log('✅ Data seeding completed successfully');
  } catch (error) {
    console.error('❌ Error during data seeding:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seeding process
seedData(); 