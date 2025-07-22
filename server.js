const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const websocketService = require('./services/websocketService');
const User = require('./models/User');
const { authenticateToken, authorizeRole, checkCrmAccess } = require('./middleware/authMiddleware');
const Customer = require('./models/customer');
const Activity = require('./models/activity');
const Ticket = require('./models/Ticket');
const Service = require('./models/serviceModel'); // Add missing Service import
const crypto = require('crypto');
const path = require('path');

// Import product routes
const productRoutes = require('./routes/productRoutes');

// Import product access routes
const productAccessRoutes = require('./routes/productAccessRoutes');

// Import product request routes
const productRequestRoutes = require('./routes/productRequestRoutes');

// Import SuperAdmin routes
const superAdminRoutes = require('./routes/superAdminRoutes');

// Import service routes
const serviceRoutes = require('./routes/serviceRoutes');

// Import notification routes
const notificationRoutes = require('./routes/notificationRoutes');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const quotationRoutes = require('./routes/quotations');
const invoiceRoutes = require('./routes/invoiceRoutes');
const enterpriseRoutes = require('./routes/enterpriseRoutes');
const ticketRoutes = require('./routes/tickets');
const complaintRoutes = require('./routes/complaintRoutes'); // Import complaint routes

// Load environment variables
dotenv.config();
console.log('Environment loaded');

// Debug log to check if connecting to MongoDB Atlas
const mongoUriDebug = process.env.MONGO_URI;
if (mongoUriDebug) {
  if (mongoUriDebug.includes('mongodb.net')) {
    console.log('🔍 MongoDB Atlas URI detected.');
  } else {
    console.log('⚠️ Not using MongoDB Atlas. URI:', mongoUriDebug);
  }
} else {
  console.log('❌ No MONGO_URI found in environment variables.');
}

// Connect to MongoDB with more robust error handling
const dbConnect = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set. Please set it in your .env file.');
    }
    console.log('Attempting MongoDB connection with URI:', mongoUri);
    
    // Add connection options for better reliability
    const connection = await mongoose.connect(mongoUri, {
      connectTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000,  // 45 seconds
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`Connected to database: ${connection.connection.name}`);
    console.log(`MongoDB version: ${connection.version}`);
    
    // Create indexes for better performance
    console.log('Setting up database indexes...');
    await User.createIndexes();
    await Customer.createIndexes();
    console.log('Database indexes setup complete');
    
    return connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    console.error('Connection string:', process.env.MONGO_URI || 'mongodb://localhost:27017/crm-system');
    
    // Don't exit the process, let the server start anyway
    console.log('Server will start, but database operations may fail');
    
    // More detailed error handling
    if (err.name === 'MongoNetworkError') {
      console.error('Network error - Is MongoDB running? Try: mongod --dbpath /data/db');
    } else if (err.name === 'MongoServerSelectionError') {
      console.error('Server selection error - Check if MongoDB is accessible at the URI');
    }
  }
};

// Connect to database
dbConnect();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
websocketService.initialize(server);

// Enable CORS with more permissive settings for development
app.use(cors({
  origin: '*', // Allow all origins during development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use the product routes
app.use('/api', productRoutes);

// Use product access routes
app.use('/products', productAccessRoutes);

// Use product request routes
app.use('/api/product-requests', productRequestRoutes);

// Use SuperAdmin routes
app.use('/superadmin', superAdminRoutes);

// Use Service routes
app.use('/api/services', serviceRoutes);

// Use notification routes
app.use('/api/notifications', notificationRoutes);

// Use auth routes
app.use('/api/auth', authRoutes);

// Use user routes
app.use('/api/users', userRoutes);

// Use quotation routes
app.use('/api/quotations', quotationRoutes);

// Use invoice routes
app.use('/api/invoices', invoiceRoutes);

// Use enterprise routes
app.use('/api/enterprise', enterpriseRoutes);

// Use ticket routes
app.use('/api/tickets', ticketRoutes);

// Use complaint routes
app.use('/api/complaints', complaintRoutes);

// Direct route for superadmin quotations to fix 500 error
app.get('/services/superadmin/quotations', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // Use MongoDB to fetch real quotations
    const Quotation = require('./models/quotationModel');
    const quotations = await Quotation.find()
      .populate('serviceId')
      .populate('adminId', 'email profile')
      .sort({ createdAt: -1 });
    
    res.status(200).json(quotations);
  } catch (error) {
    console.error('Error in direct quotations handler:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Direct route for superadmin service stats to fix 500 error
app.get('/services/superadmin/stats/summary', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // Use MongoDB to fetch real statistics
    const Service = require('./models/serviceModel');
    const Quotation = require('./models/quotationModel');
    
    // Get services count
    const totalServices = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ active: true });
    
    // Get quotations count
    const totalQuotations = await Quotation.countDocuments();
    const pendingQuotations = await Quotation.countDocuments({ status: 'pending' });
    const approvedQuotations = await Quotation.countDocuments({ status: 'approved' });
    const rejectedQuotations = await Quotation.countDocuments({ status: 'rejected' });
    const completedQuotations = await Quotation.countDocuments({ status: 'completed' });
    
    // Get services by category
    const servicesByCategory = await Service.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Format the category data
    const categoryData = {};
    servicesByCategory.forEach(item => {
      categoryData[item._id || 'Uncategorized'] = item.count;
    });
    
    // Compile statistics
    const stats = {
      totalServices,
      activeServices,
      totalQuotations,
      quotationsByStatus: {
        pending: pendingQuotations,
        approved: approvedQuotations,
        rejected: rejectedQuotations,
        completed: completedQuotations
      },
      servicesByCategory: categoryData
    };
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error in direct service stats handler:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Direct route for superadmin services to fix 500 error
app.get('/services/superadmin', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // Use MongoDB to fetch real services
    const Service = require('./models/serviceModel');
    const services = await Service.find().sort({ createdAt: -1 });
    
    res.status(200).json(services);
  } catch (error) {
    console.error('Error in direct services handler:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Direct route for creating services (SuperAdmin only)
app.post('/services/superadmin', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { name, description, price, category, icon, features, duration, active } = req.body;
    
    // Validate required fields
    if (!name || !description || price === undefined) {
      return res.status(400).json({ message: 'Name, description, and price are required' });
    }
    
    // Create service data object
    const serviceData = {
      name,
      description,
      price: parseFloat(price),
      category: category || 'General',
      icon: icon || '🔧',
      features: features || [],
      duration: duration || { unit: 'one-time' },
      active: active !== undefined ? active : true,
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    let savedService;
    
    // Create service with current user as creator
    const Service = require('./models/serviceModel');
    const newService = new Service(serviceData);
    savedService = await newService.save();
    
    res.status(201).json({
      message: 'Service created successfully',
      service: savedService
    });
  } catch (error) {
    console.error('Service creation error:', error);
    res.status(500).json({ message: 'Failed to create service', error: error.message });
  }
});

// Direct route for updating services (SuperAdmin only)
app.put('/services/superadmin/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { name, description, price, category, icon, features, duration, active } = req.body;
    
    // Find service
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Update service
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      {
        name: name || service.name,
        description: description || service.description,
        price: price !== undefined ? parseFloat(price) : service.price,
        category: category || service.category,
        icon: icon || service.icon,
        features: features || service.features,
        duration: duration || service.duration,
        active: active !== undefined ? active : service.active,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      message: 'Service updated successfully',
      service: updatedService
    });
  } catch (error) {
    console.error('Service update error:', error);
    res.status(500).json({ message: 'Failed to update service', error: error.message });
  }
});

// Direct route for deleting services (SuperAdmin only)
app.delete('/services/superadmin/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // Find service
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // No quotations, safe to delete
    await Service.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Service deletion error:', error);
    res.status(500).json({ message: 'Failed to delete service', error: error.message });
  }
});

// API route prefix for frontend compatibility
app.use('/api/superadmin', superAdminRoutes);

// Improved subdomain middleware for both localhost and production
app.use((req, res, next) => {
  const host = req.headers.host;
  // Extract subdomain from host
  if (host && process.env.NODE_ENV === 'development') {
  console.log('Incoming request host:', host);
  }
  
  // Handle different host patterns
  if (host) {
    // Case 1: subdomain.localhost:PORT format (local development)
    if (host.includes('localhost')) {
      const parts = host.split('.');
      if (parts.length > 1 && parts[0] !== 'localhost') {
        req.subdomain = parts[0];
        if (process.env.NODE_ENV === 'development') {
        console.log('Local development subdomain detected:', req.subdomain);
        }
      }
    } 
    // Case 2: subdomain.domain.TLD format (production)
    else {
      const parts = host.split('.');
      if (parts.length > 2) {
        req.subdomain = parts[0];
        if (process.env.NODE_ENV === 'development') {
        console.log('Production subdomain detected:', req.subdomain);
        }
      }
    }
  }
  
  next();
});

// Initialize Super Admin if not exists
const initializeSuperAdmin = async () => {
  try {
    console.log('Checking for existing SuperAdmin...');
    const superAdmin = await User.findOne({ role: 'superadmin' });
    
    if (!superAdmin) {
      console.log('No SuperAdmin found. Checking environment variables to create one...');

      const superAdminEmail = process.env.SUPERADMIN_EMAIL;
      const superAdminPassword = process.env.SUPERADMIN_PASSWORD;

      if (superAdminEmail && superAdminPassword) {
        console.log('Creating default SuperAdmin account from environment variables...');
        
        // Create default super admin from environment variables
        const superadminData = {
          email: superAdminEmail,
          password: bcrypt.hashSync(superAdminPassword, 10),
          role: 'superadmin',
          profile: {
            fullName: 'Super Admin',
            department: 'Management',
            status: 'active'
          }
        };
        
        const newSuperAdmin = await User.create(superadminData);
        console.log('🔑 Default SuperAdmin created successfully with ID:', newSuperAdmin._id);
        console.log('SuperAdmin email:', newSuperAdmin.email);
      } else {
        console.warn('⚠️ SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables are not set.');
        console.warn('⚠️ Cannot create a default SuperAdmin account. Please set these variables in your .env file.');
      }
    } else {
      console.log('✅ SuperAdmin account already exists:', superAdmin.email);
    }

    // The hardcoded test admin has been removed to improve security.
    // If you need a test admin, please create it through the application's UI
    // or by creating a secure seeding script.
    
  } catch (error) {
    console.error('❌ Error initializing users:', error);
    
    // More detailed error handling
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
      console.error('Database connection error - Unable to initialize users');
    } else if (error.code === 11000) {
      console.error('Duplicate key error - User already exists');
    } else {
      console.error('Unknown error during user initialization');
    }
  }
};

initializeSuperAdmin();

// Sample customer database (for testing purposes)
const customers = [];

// Create Admin Route (Super Admin only)
app.post('/superadmin/create-admin', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { email, password, profile, permissions, subdomain } = req.body;
    console.log('Creating new admin:', { email, permissions, subdomain });

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Check if subdomain already exists
    if (subdomain) {
      const subdomainExists = await User.findOne({ subdomain });
      if (subdomainExists) {
        return res.status(400).json({ message: 'Subdomain already in use' });
      }
      
      // Validate subdomain format
      if (!/^[a-z0-9-]+$/.test(subdomain)) {
        return res.status(400).json({ 
          message: 'Subdomain can only contain lowercase letters, numbers, and hyphens' 
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new admin with all permissions
    const newAdmin = await User.create({
      email,
      password: hashedPassword,
      role: 'admin',
      subdomain,
      permissions: {
        crmAccess: permissions?.crmAccess || false,
        hrmsAccess: permissions?.hrmsAccess || false,
        jobPortalAccess: permissions?.jobPortalAccess || false,
        jobBoardAccess: permissions?.jobBoardAccess || false,
        projectManagementAccess: permissions?.projectManagementAccess || false
      },
      profile: {
        ...profile,
        status: 'active'
      }
    });

    console.log('Admin created successfully:', { 
      email, 
      subdomain, 
      permissions: newAdmin.permissions 
    });
    
    // Generate login link based on subdomain
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    let loginLink;
    
    if (subdomain) {
      // For development environment - local testing
      if (baseUrl.includes('localhost')) {
        loginLink = `http://${subdomain}.localhost:3000`;
      } else {
        // For production, construct proper subdomain URL
        loginLink = `${baseUrl.replace('://', `://${subdomain}.`)}`;
      }
    } else {
      loginLink = `${baseUrl}/admin/login?id=${newAdmin._id}`;
    }

    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
        profile: newAdmin.profile,
        permissions: newAdmin.permissions,
        subdomain: newAdmin.subdomain
      },
      loginLink
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Get All Admins Route (Super Admin only)
app.get('/superadmin/admins', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password')
      .lean();
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get Single Admin Route (Super Admin only)
app.get('/superadmin/admins/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const admin = await User.findOne({ 
      _id: req.params.id, 
      role: 'admin' 
    }).select('-password');

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json(admin);
  } catch (error) {
    console.error('Error fetching admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update Admin Route (Super Admin only)
app.put('/superadmin/admins/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // If updating password, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    const admin = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    console.log('Admin updated successfully:', { 
      id: admin._id, 
      email: admin.email,
      permissions: admin.permissions 
    });
    
    res.json({
      message: 'Admin updated successfully',
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        profile: admin.profile,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle CRM Access Route (Super Admin only)
app.put('/superadmin/admins/:id/toggle-crm-access', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { crmAccess } = req.body;
    
    // Update the admin permissions
    const admin = await User.findByIdAndUpdate(
      id,
      { $set: { 'permissions.crmAccess': crmAccess } },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    console.log('CRM access updated successfully:', { 
      id: admin._id, 
      email: admin.email,
      permissions: admin.permissions 
    });
    
    res.json({
      success: true,
      message: `CRM access ${crmAccess ? 'granted' : 'revoked'} successfully`,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Error toggling CRM access:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update CRM access'
    });
  }
});

// Delete Admin Route (Super Admin only)
app.delete('/superadmin/admins/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const admin = await User.findOneAndDelete({ 
      _id: req.params.id, 
      role: 'admin' 
    });

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Super Admin Login Route
app.post('/superadmin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Attempting superadmin login:', { email });

    if (!email || !password) {
      console.log('Login attempt with missing credentials');
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email, role: 'superadmin' });
    if (!user) {
      console.log('Superadmin not found:', { email });
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password for superadmin:', { email });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Generate JWT token with extended expiration (7 days)
    try {
      const token = jwt.sign(
        { 
          id: user._id, 
          email: user.email, 
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        },
        process.env.JWT_SECRET
      );

      console.log('Superadmin login successful:', { email, userId: user._id });
      res.json({
        message: 'Login successful',
        token,
        role: user.role,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      });
    } catch (jwtError) {
      console.error('JWT token generation error:', jwtError);
      res.status(500).json({ message: 'Authentication token generation failed' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Regular Login Route (for Admin and Users)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Attempting login with email:', email);

    // Check if we're on a subdomain
    let user;
    
    // Check if using mock database
    if (process.env.USE_MOCK_DB === 'true') {
      console.log('Using mock database for login');
      const mockDb = require('./utils/mockDb');
      
      if (req.subdomain) {
        // Find admin by subdomain in mock DB
        user = mockDb.findOne('users', { 
          subdomain: req.subdomain,
          role: 'admin'
    });

    if (!user) {
          console.log('Invalid subdomain in mock DB:', req.subdomain);
          return res.status(400).json({ 
            message: 'Invalid subdomain. This portal does not exist.' 
          });
        }
        
        // If email doesn't match this admin, reject
        if (user.email !== email) {
          console.log('Email mismatch for subdomain in mock DB');
          return res.status(400).json({ message: 'Invalid credentials' });
        }
      } else {
        // Regular login by email in mock DB
        user = mockDb.findOne('users', { email });
      }
      
      if (!user) {
        console.log('User not found in mock DB:', email);
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
      
    if (!isPasswordValid) {
        console.log('Invalid password in mock DB for:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
  
      // Generate token with full permissions data and full enterprise info
    const fullEnterprise = {
      enterpriseId: user.enterprise?.enterpriseId || '',
      companyName: user.enterprise?.companyName || '',
      logo: user.enterprise?.logo || '',
      address: user.enterprise?.address || '',
      mailingAddress: user.enterprise?.mailingAddress || '',
      city: user.enterprise?.city || '',
      country: user.enterprise?.country || '',
      zipCode: user.enterprise?.zipCode || '',
      phoneNumber: user.enterprise?.phoneNumber || '',
      companyEmail: user.enterprise?.companyEmail || '',
      loginLink: user.enterprise?.loginLink || '',
      industry: user.enterprise?.industry || '',
      businessType: user.enterprise?.businessType || ''
    };
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || {},
        profile: user.profile,
        enterprise: fullEnterprise
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

      console.log('Login successful (mock DB):', email);
      return res.json({
        message: 'Login successful',
        token,
        role: user.role,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          permissions: user.permissions || {},
          enterprise: fullEnterprise,
          subdomain: user.subdomain
        }
      });
    }
    
    // MongoDB path - only reached if mock DB is not enabled
    if (req.subdomain) {
      // Find admin by subdomain
      user = await User.findOne({ 
        subdomain: req.subdomain,
        role: 'admin'
      });

      if (!user) {
        return res.status(400).json({ 
          message: 'Invalid subdomain. This portal does not exist.' 
        });
      }
      
      // If email doesn't match this admin, reject
      if (user.email !== email) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
    } else {
      // Regular login by email
      user = await User.findOne({ email });
    }
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
  
    // Generate token with full permissions data and full enterprise info
    const fullEnterprise = {
      enterpriseId: user.enterprise?.enterpriseId || '',
      companyName: user.enterprise?.companyName || '',
      logo: user.enterprise?.logo || '',
      address: user.enterprise?.address || '',
      mailingAddress: user.enterprise?.mailingAddress || '',
      city: user.enterprise?.city || '',
      country: user.enterprise?.country || '',
      zipCode: user.enterprise?.zipCode || '',
      phoneNumber: user.enterprise?.phoneNumber || '',
      companyEmail: user.enterprise?.companyEmail || '',
      loginLink: user.enterprise?.loginLink || '',
      industry: user.enterprise?.industry || '',
      businessType: user.enterprise?.businessType || ''
    };
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || {},
        profile: user.profile,
        enterprise: fullEnterprise
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      role: user.role,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        permissions: user.permissions || {},
        enterprise: fullEnterprise,
        subdomain: user.subdomain
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Protected Routes
app.get('/superadmin', authenticateToken, authorizeRole('superadmin'), (req, res) => {
  res.json({ message: 'Welcome to the Super Admin Dashboard' });
});

app.get('/admin', authenticateToken, authorizeRole('admin'), (req, res) => {
  try {
    // Get user info from token
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userRole = req.user.role;
    
    // Log authentication success
    console.log(`Admin authenticated successfully: ${userEmail} (${userId})`);
    
    // Add permissions to the response if available
    const permissions = req.user.permissions || {
      crmAccess: true, // Default to true for admin
      hrmsAccess: true,
      jobPortalAccess: true,
      jobBoardAccess: true,
      projectManagementAccess: true
    };
    
    // Return detailed response with consistent profile structure
    res.json({ 
      message: 'Welcome to the Admin Dashboard',
      success: true,
      user: {
        id: userId,
        email: userEmail,
        role: userRole,
        permissions,
        profile: {
          fullName: 'Admin User',
          company: 'Admin Company',
          phone: '123-456-7890',
          status: 'active'
        }
      }
    });
  } catch (error) {
    console.error('Error in admin route:', error);
    res.status(500).json({
      message: 'Internal server error',
      success: false,
      error: 'server_error'
    });
  }
});

app.get('/user', authenticateToken, authorizeRole('user'), (req, res) => {
  res.json({ message: 'Welcome to the User Dashboard' });
});

// Admin CRM Routes
// GET all customers (filtered by role)
app.get('/crm/customers', authenticateToken, checkCrmAccess, async (req, res) => {
  try {
    // If admin, only show their assigned customers
    if (req.user.role === 'admin') {
      query.assignedTo = req.user.id;
    }
    
    const customers = await Customer.find(query)
      .populate('assignedTo', 'email profile.fullName')
      .sort({ createdAt: -1 });
      
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single customer (with permission check)
app.get('/crm/customers/:id', authenticateToken, checkCrmAccess, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('assignedTo', 'email profile.fullName');
      
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if admin has access to this customer
    if (req.user.role === 'admin' && customer.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this customer' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create customer (with assignment)
app.post('/crm/customers', authenticateToken, checkCrmAccess, async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      assignedTo: req.user.role === 'admin' ? req.user.id : req.body.assignedTo
    };
    
    const customer = await Customer.create(customerData);
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update customer (with permission check)
app.put('/crm/customers/:id', authenticateToken, checkCrmAccess, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if admin has access to this customer
    if (req.user.role === 'admin' && customer.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this customer' });
    }
    
    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('assignedTo', 'email profile.fullName');
    
    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete customer (with permission check)
app.delete('/crm/customers/:id', authenticateToken, checkCrmAccess, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if admin has access to this customer
    if (req.user.role === 'admin' && customer.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this customer' });
    }
    
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get CRM dashboard data (stats)
app.get('/crm/dashboard', authenticateToken, async (req, res) => {
  try {
    let stats = {};
    
    // If superadmin, get overall stats
    if (req.user.role === 'superadmin') {
      const customers = await Customer.find();
      
      stats = {
        totalCustomers: customers.length,
        customersByStatus: {
          lead: customers.filter(c => c.status === 'lead').length,
          customer: customers.filter(c => c.status === 'customer').length,
          inactive: customers.filter(c => c.status === 'inactive').length
        },
        totalDeals: customers.reduce((sum, c) => sum + (c.deals ? c.deals.length : 0), 0),
        dealsValue: customers.reduce((sum, c) => {
          if (!c.deals) return sum;
          return sum + c.deals.reduce((dealSum, deal) => dealSum + (deal.value || 0), 0);
        }, 0),
        recentActivity: await Customer.find()
          .sort({ updatedAt: -1 })
          .limit(5)
          .populate({
            path: 'assignedTo',
            select: 'email profile'
          })
      };
    } 
    // If admin, get their stats
    else if (req.user.role === 'admin') {
      const admin = await User.findById(req.user.id);
      if (!admin || !admin.permissions.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      const customers = await Customer.find({ assignedTo: req.user.id });
      
      stats = {
        totalCustomers: customers.length,
        customersByStatus: {
          lead: customers.filter(c => c.status === 'lead').length,
          customer: customers.filter(c => c.status === 'customer').length,
          inactive: customers.filter(c => c.status === 'inactive').length
        },
        totalDeals: customers.reduce((sum, c) => sum + (c.deals ? c.deals.length : 0), 0),
        dealsValue: customers.reduce((sum, c) => {
          if (!c.deals) return sum;
          return sum + c.deals.reduce((dealSum, deal) => dealSum + (deal.value || 0), 0);
        }, 0),
        recentActivity: await Customer.find({ assignedTo: req.user.id })
          .sort({ updatedAt: -1 })
          .limit(5)
      };
    } else {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching CRM dashboard data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// SuperAdmin CRM Overview
app.get('/superadmin/crm/overview', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id email profile');
    const overview = await Promise.all(
      admins.map(async (admin) => {
        const customers = await Customer.find({ assignedTo: admin._id });
        const deals = customers.reduce((acc, curr) => acc.concat(curr.deals), []);
        
        return {
          admin: {
            id: admin._id,
            email: admin.email,
            fullName: admin.profile.fullName
          },
          stats: {
            totalCustomers: customers.length,
            activeCustomers: customers.filter(c => c.status === 'customer').length,
            totalLeads: customers.filter(c => c.status === 'lead').length,
            totalDeals: deals.length,
            wonDeals: deals.filter(d => d.status === 'won').length,
            totalDealValue: deals.reduce((acc, curr) => acc + (curr.value || 0), 0)
          }
        };
      })
    );

    res.json(overview);
  } catch (error) {
    console.error('Error fetching CRM overview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin Routes
app.post('/admin/create-user', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { email, password, profile } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      password: hashedPassword,
      role: 'user',
      createdBy: req.user.id,
      profile: {
        ...profile,
        status: profile.status || 'active'
      }
    });

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        profile: newUser.profile
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get Users Route (Admin only)
app.get('/admin/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // If using real MongoDB
    const users = await User.find({ 
      createdBy: req.user.id,
      role: 'user'
    }).select('-password');
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update User Route (Admin only)
app.put('/admin/users/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { email, password, profile } = req.body;
    const userId = req.params.id;

    // Find user
    const user = await User.findOne({ 
      _id: userId,
      role: 'user',
      createdBy: req.user.id
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if new email already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      user.email = email;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    if (profile) {
      user.profile = {
        ...user.profile,
        ...profile
      };
    }

    await user.save();
    const updatedUser = await User.findById(user._id).select('-password');

    res.json({ 
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete User Route (Admin only)
app.delete('/admin/users/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findOneAndDelete({ 
      _id: userId,
      role: 'user',
      createdBy: req.user.id
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin Verification Route
app.get('/admin/verify', authenticateToken, async (req, res) => {
  console.log('Admin verification attempt from IP:', req.ip);
  try {
    if (!req.user) {
      console.log('No user data found during admin verification');
      return res.status(401).json({ 
        message: 'No user data found',
        success: false,
        error: 'authentication_failed'
      });
    }
    
    console.log('Admin verification for user ID:', req.user.id);

    // If using real MongoDB
    const user = await User.findOne({ 
      _id: req.user.id, 
      role: 'admin' 
    }).select('-password');

    if (!user) {
      console.log('Admin verification failed: user not found in MongoDB');
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.',
        success: false,
        error: 'unauthorized_role'
      });
    }

    console.log('Admin verification successful for MongoDB user:', user.email);
    res.json({ 
      message: 'Authenticated as admin', 
      user,
      success: true
    });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ 
      message: 'Server error during verification',
      success: false,
      error: 'server_error'
    });
  }
});

// SuperAdmin CRM Routes
// Get all customers across all admins
app.get('/superadmin/crm/customers', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate('assignedTo', 'email profile.fullName')
      .populate('deals')
      .lean();
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create customer and assign to a specific admin
app.post('/superadmin/crm/customers', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    console.log('Creating customer with data:', req.body);
    const { name, email, phone, company, status, assignedTo, notes } = req.body;
    
    // Validate required fields
    if (!name || !email || !assignedTo) {
      return res.status(400).json({ message: 'Name, email and assignedTo are required' });
    }
    
    // Check if admin exists
    const admin = await User.findOne({ _id: assignedTo, role: 'admin' });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid admin selected' });
    }
    
    // Create new customer
    const customer = new Customer({
      name,
      email,
      phone: phone || '',
      company: company || '',
      status: status || 'lead',
      assignedTo,
      notes: notes || '',
      lastContact: new Date()
    });
    
    const savedCustomer = await customer.save();
    
    // Populate the assignedTo field for the response
    await savedCustomer.populate({
      path: 'assignedTo',
      select: 'email profile'
    });
    
    console.log('Customer created successfully:', savedCustomer);
    res.status(201).json(savedCustomer);
  } catch (error) {
    // Check for duplicate key error (MongoDB error code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A customer with this email already exists' });
    }
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Update customer
app.put('/superadmin/crm/customers/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    console.log('Updating customer:', req.params.id, 'with data:', req.body);
    const { name, email, phone, company, status, assignedTo, notes } = req.body;
    
    // Validate required fields
    if (!name || !email || !assignedTo) {
      return res.status(400).json({ message: 'Name, email and assignedTo are required' });
    }
    
    // Find customer
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // If changing admin assignment, verify the admin exists
    if (assignedTo && assignedTo !== customer.assignedTo.toString()) {
      const admin = await User.findOne({ _id: assignedTo, role: 'admin' });
      if (!admin) {
        return res.status(400).json({ message: 'Invalid admin selected' });
      }
    }
    
    // Update fields
    customer.name = name;
    customer.email = email;
    customer.phone = phone || '';
    customer.company = company || '';
    customer.status = status;
    customer.assignedTo = assignedTo;
    customer.notes = notes || '';
    
    const updatedCustomer = await customer.save();
    
    // Populate the assignedTo field for the response
    await updatedCustomer.populate({
      path: 'assignedTo',
      select: 'email profile'
    });
    
    console.log('Customer updated successfully:', updatedCustomer);
    res.json(updatedCustomer);
  } catch (error) {
    // Check for duplicate key error (MongoDB error code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A customer with this email already exists' });
    }
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Delete customer
app.delete('/superadmin/crm/customers/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get customer statistics by admin
app.get('/superadmin/crm/stats', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id email profile');
    
    const stats = await Promise.all(
      admins.map(async (admin) => {
        const customers = await Customer.find({ assignedTo: admin._id });
        
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter(c => c.status === 'customer').length;
        const totalLeads = customers.filter(c => c.status === 'lead').length;
        const inactiveCustomers = customers.filter(c => c.status === 'inactive').length;
        
        return {
          admin: {
            id: admin._id,
            email: admin.email,
            name: admin.profile?.fullName || admin.email
          },
          stats: {
            totalCustomers,
            activeCustomers,
            totalLeads,
            inactiveCustomers
          }
        };
      })
    );
    
    // Calculate overall stats
    const overall = {
      totalCustomers: stats.reduce((sum, item) => sum + item.stats.totalCustomers, 0),
      activeCustomers: stats.reduce((sum, item) => sum + item.stats.activeCustomers, 0),
      totalLeads: stats.reduce((sum, item) => sum + item.stats.totalLeads, 0),
      inactiveCustomers: stats.reduce((sum, item) => sum + item.stats.inactiveCustomers, 0)
    };
    
    res.json({ overall, adminStats: stats });
  } catch (error) {
    console.error('Error fetching CRM stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get detailed customer activity for all admins
app.get('/superadmin/crm/activity', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // Get recent customers, sorted by last updated
    const recentCustomers = await Customer.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate({
        path: 'assignedTo',
        select: 'email profile'
      });
    
    // Format activity data
    const activity = recentCustomers.map(customer => ({
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      action: customer.createdAt.getTime() === customer.updatedAt.getTime() ? 'created' : 'updated',
      timestamp: customer.updatedAt,
      adminName: customer.assignedTo.profile?.fullName || customer.assignedTo.email,
      adminId: customer.assignedTo._id
    }));
    
    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Convert a lead to customer
app.post('/crm/leads/:id/convert', authenticateToken, async (req, res) => {
  try {
    // Check permissions
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    // Find the lead
    const lead = await Customer.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Check if lead is already a customer
    if (lead.status === 'customer') {
      return res.status(400).json({ message: 'This lead is already a customer' });
    }
    
    // If admin, check if lead is assigned to them
    if (req.user.role === 'admin' && lead.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only convert leads assigned to you' });
    }
    
    // Update lead to customer
    lead.status = 'customer';
    
    // If additional data is provided, update it
    if (req.body.notes) lead.notes = req.body.notes;
    
    // Add a deal if provided
    if (req.body.createDeal && req.body.dealTitle) {
      lead.deals.push({
        title: req.body.dealTitle,
        value: req.body.dealValue || lead.potentialValue || 0,
        status: 'pending',
        closingDate: req.body.closingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default to 30 days
      });
    }
    
    await lead.save();
    
    res.json({ message: 'Lead converted to customer successfully', customer: lead });
  } catch (error) {
    console.error('Error converting lead to customer:', error);
    res.status(500).json({ message: 'Failed to convert lead to customer' });
  }
});

// CRM Statistics Route
app.get('/crm/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Initialize stats object
    const stats = {
      customers: {
        total: 0,
        active: 0,
        inactive: 0,
        leads: 0
      },
      deals: {
        total: 0,
        pending: 0,
        won: 0,
        lost: 0,
        value: {
          total: 0,
          won: 0,
          pending: 0
        }
      },
      recent: {
        customers: [],
        deals: []
      }
    };
    
    // Build query based on user role
    let query = {};
    if (userRole === 'admin') {
      // Admin can only see their own data
      const user = await User.findById(userId);
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      query.assignedTo = userId;
    }
    
    // Get customer statistics
    const customers = await Customer.find(query)
      .populate('assignedTo', 'email profile.fullName')
      .sort({ createdAt: -1 })
      .limit(1000); // Add reasonable limit
      
    stats.customers.total = customers.length;
    stats.customers.active = customers.filter(c => c.status === 'customer').length;
    stats.customers.inactive = customers.filter(c => c.status === 'inactive').length;
    stats.customers.leads = customers.filter(c => c.status === 'lead').length;
    
    // Calculate deal statistics
    let totalDealValue = 0;
    let wonDealValue = 0;
    let pendingDealValue = 0;
    let totalDeals = 0;
    let wonDeals = 0;
    let lostDeals = 0;
    let pendingDeals = 0;
    
    customers.forEach(customer => {
      if (customer.deals && customer.deals.length > 0) {
        customer.deals.forEach(deal => {
          totalDeals++;
          totalDealValue += deal.value || 0;
          
          if (deal.status === 'won') {
            wonDeals++;
            wonDealValue += deal.value || 0;
          } else if (deal.status === 'lost') {
            lostDeals++;
          } else {
            pendingDeals++;
            pendingDealValue += deal.value || 0;
          }
        });
      }
    });
    
    stats.deals.total = totalDeals;
    stats.deals.won = wonDeals;
    stats.deals.lost = lostDeals;
    stats.deals.pending = pendingDeals;
    stats.deals.value.total = totalDealValue;
    stats.deals.value.won = wonDealValue;
    stats.deals.value.pending = pendingDealValue;
    
    // Get recent customers (last 5)
    stats.recent.customers = customers
      .slice(0, 5)
      .map(c => ({
        id: c._id,
        name: c.name,
        email: c.email,
        company: c.company,
        status: c.status,
        createdAt: c.createdAt,
        assignedTo: c.assignedTo
      }));
    
    // Get recent deals
    const recentDeals = [];
    customers.forEach(customer => {
      if (customer.deals && customer.deals.length > 0) {
        customer.deals.forEach(deal => {
          recentDeals.push({
            id: deal._id,
            title: deal.title,
            value: deal.value,
            status: deal.status,
            customerId: customer._id,
            customerName: customer.name,
            closingDate: deal.closingDate,
            createdAt: customer.createdAt
          });
        });
      }
    });
    
    // Sort and limit recent deals
    stats.recent.deals = recentDeals
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    res.json({
      success: true,
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting CRM statistics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve CRM statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Simple health check route that doesn't require auth
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'online', timestamp: new Date() });
});

// API status endpoint for authentication verification
app.get('/api/status', authenticateToken, (req, res) => {
  res.status(200).json({
    status: 'ok',
    authenticated: true,
    user: {
      id: req.user.id,
      role: req.user.role
    },
    timestamp: new Date()
  });
});

// ... existing code ...
app.get('/api/ping', (req, res) => res.json({ pong: true }));
// ... existing code ...

// --- Deal Management Routes ---

// Get all deals
app.get('/crm/deals', authenticateToken, async (req, res) => {
  try {
    // Verify user has CRM access
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
    }
    
    // Build query based on user role
    let query = {};
    if (req.user.role === 'admin') {
      query.assignedTo = req.user.id;
    }
    
    // Get customers with deals
    const customers = await Customer.find(query)
      .populate('assignedTo', 'email profile.fullName')
      .select('name email company status deals assignedTo');
    
    // Extract and format deals
    const deals = [];
    customers.forEach(customer => {
      if (customer.deals && customer.deals.length > 0) {
        customer.deals.forEach(deal => {
          deals.push({
            id: deal._id,
            title: deal.title,
            value: deal.value,
            status: deal.status,
            closingDate: deal.closingDate,
            customer: {
              id: customer._id,
              name: customer.name,
              email: customer.email,
              company: customer.company,
              status: customer.status
            },
            assignedTo: customer.assignedTo
          });
        });
      }
    });
    
    // Sort deals by closing date
    deals.sort((a, b) => {
      if (!a.closingDate) return 1;
      if (!b.closingDate) return -1;
      return new Date(a.closingDate) - new Date(b.closingDate);
    });
    
    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ message: 'Failed to fetch deals' });
  }
});

// Add a deal to a customer
app.post('/crm/customers/:customerId/deals', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { title, value, status, closingDate } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Deal title is required' });
    }
    
    // Find the customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only add deals to their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only add deals to your own customers' });
      }
    }
    
    // Create the new deal
    const newDeal = {
      title,
      value: value || 0,
      status: status || 'pending',
      closingDate: closingDate || new Date()
    };
    
    // Add the deal to the customer
    if (!customer.deals) {
      customer.deals = [];
    }
    customer.deals.push(newDeal);
    
    // If this is the first won deal and customer is a lead, convert to customer
    if (newDeal.status === 'won' && customer.status === 'lead') {
      customer.status = 'customer';
    }
    
    // Save the customer
    await customer.save();
    
    // Find the newly added deal (it's the last one in the array)
    const addedDeal = customer.deals[customer.deals.length - 1];
    
    res.status(201).json({
      message: 'Deal added successfully',
      deal: addedDeal
    });
  } catch (error) {
    console.error('Error adding deal:', error);
    res.status(500).json({ message: 'Failed to add deal' });
  }
});

// Update a deal
app.put('/crm/customers/:customerId/deals/:dealId', authenticateToken, async (req, res) => {
  try {
    const { customerId, dealId } = req.params;
    const { title, value, status, closingDate } = req.body;
    
    // Find the customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only update deals for their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only update deals for your own customers' });
      }
    }
    
    // Find the deal index
    const dealIndex = customer.deals.findIndex(d => d._id.toString() === dealId);
    if (dealIndex === -1) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Update the deal
    if (title) customer.deals[dealIndex].title = title;
    if (value !== undefined) customer.deals[dealIndex].value = value;
    if (status) customer.deals[dealIndex].status = status;
    if (closingDate) customer.deals[dealIndex].closingDate = closingDate;
    
    // If this deal is now won and customer is a lead, convert to customer
    if (status === 'won' && customer.status === 'lead') {
      customer.status = 'customer';
    }
    
    // Save the customer
    await customer.save();
    
    res.json({
      message: 'Deal updated successfully',
      deal: customer.deals[dealIndex]
    });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ message: 'Failed to update deal' });
  }
});

// Delete a deal
app.delete('/crm/customers/:customerId/deals/:dealId', authenticateToken, async (req, res) => {
  try {
    const { customerId, dealId } = req.params;
    
    // Find the customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only delete deals for their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only delete deals for your own customers' });
      }
    }
    
    // Find the deal index
    const dealIndex = customer.deals.findIndex(d => d._id.toString() === dealId);
    if (dealIndex === -1) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Remove the deal
    customer.deals.splice(dealIndex, 1);
    
    // Save the customer
    await customer.save();
    
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ message: 'Failed to delete deal' });
  }
});

// --- Activity Management Routes ---

// Get activities for a customer
app.get('/crm/customers/:customerId/activities', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status, type } = req.query;
    
    // Check if the customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only view activities for their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only view activities for your own customers' });
      }
    }
    
    // Build query
    let query = { customerId };
    if (status) query.status = status;
    if (type) query.type = type;
    
    // Get activities
    const activities = await Activity.find(query)
      .populate('createdBy', 'email profile.fullName')
      .populate('assignedTo', 'email profile.fullName')
      .sort({ dueDate: 1, createdAt: -1 });
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});

// Get all activities (for dashboard)
app.get('/crm/activities', authenticateToken, async (req, res) => {
  try {
    const { status, type, timeframe } = req.query;
    
    // Build query
    let query = {};
    
    // If admin, only show their assigned activities
    if (req.user.role === 'admin') {
      query.assignedTo = req.user.id;
    }
    
    if (status) query.status = status;
    if (type) query.type = type;
    
    // Handle timeframe filter
    if (timeframe) {
      const now = new Date();
      if (timeframe === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        query.dueDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (timeframe === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (6 - now.getDay())); // End of week (Saturday)
        endOfWeek.setHours(23, 59, 59, 999);
        
        query.dueDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (timeframe === 'overdue') {
        query.dueDate = { $lt: now };
        query.status = 'pending';
      }
    }
    
    // Get activities
    const activities = await Activity.find(query)
      .populate('customerId', 'name email company')
      .populate('createdBy', 'email profile.fullName')
      .populate('assignedTo', 'email profile.fullName')
      .sort({ dueDate: 1, createdAt: -1 });
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});

// Add an activity
app.post('/crm/customers/:customerId/activities', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { type, subject, description, status, dueDate, isImportant } = req.body;
    
    // Check if the customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only add activities for their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only add activities for your own customers' });
      }
    }
    
    // Create the activity
    const activity = await Activity.create({
      customerId,
      type,
      subject,
      description: description || '',
      status: status || 'pending',
      dueDate: dueDate || new Date(),
      createdBy: req.user.id,
      assignedTo: customer.assignedTo,
      isImportant: isImportant || false
    });
    
    // Update customer lastContact field
    customer.lastContact = new Date();
    await customer.save();
    
    res.status(201).json({
      message: 'Activity added successfully',
      activity
    });
  } catch (error) {
    console.error('Error adding activity:', error);
    res.status(500).json({ message: 'Failed to add activity' });
  }
});

// Update an activity
app.put('/crm/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { type, subject, description, status, dueDate, isImportant } = req.body;
    
    // Find the activity
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    
    // Get the customer to check permissions
    const customer = await Customer.findById(activity.customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only update activities for their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only update activities for your own customers' });
      }
    }
    
    // Update fields
    if (type) activity.type = type;
    if (subject) activity.subject = subject;
    if (description !== undefined) activity.description = description;
    if (status) {
      activity.status = status;
      if (status === 'completed' && !activity.completedDate) {
        activity.completedDate = new Date();
      }
    }
    if (dueDate) activity.dueDate = dueDate;
    if (isImportant !== undefined) activity.isImportant = isImportant;
    
    await activity.save();
    
    res.json({
      message: 'Activity updated successfully',
      activity
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ message: 'Failed to update activity' });
  }
});

// Delete an activity
app.delete('/crm/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    
    // Find the activity
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    
    // Get the customer to check permissions
    const customer = await Customer.findById(activity.customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check permissions
    if (req.user.role === 'admin') {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.permissions?.crmAccess) {
        return res.status(403).json({ message: 'You do not have access to CRM' });
      }
      
      // Admins can only delete activities for their own customers
      if (customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only delete activities for your own customers' });
      }
    }
    
    // Delete the activity
    await Activity.findByIdAndDelete(activityId);
    
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ message: 'Failed to delete activity' });
  }
});

// Get All Customers (Super Admin only)
app.get('/superadmin/customers', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate('assignedTo', 'email profile.fullName')
      .populate('deals')
      .lean();
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get All Activities (Super Admin only)
app.get('/superadmin/activities', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('customerId', 'name email')
      .populate('createdBy', 'email profile.fullName')
      .populate('assignedTo', 'email profile.fullName')
      .lean();
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get All Deals (Super Admin only)
app.get('/superadmin/deals', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const customers = await Customer.find({ 'deals.0': { $exists: true } })
      .select('name email deals')
      .lean();
    
    const deals = customers.reduce((acc, customer) => {
      const customerDeals = customer.deals.map(deal => ({
        ...deal,
        customerName: customer.name,
        customerEmail: customer.email
      }));
      return [...acc, ...customerDeals];
    }, []);
    
    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update Customer (Super Admin only)
app.put('/superadmin/customers/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const customer = await Customer.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'email profile.fullName');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete Customer (Super Admin only)
app.delete('/superadmin/customers/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Delete associated activities
    await Activity.deleteMany({ customerId: id });
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve React frontend static files in production
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\u2705 Server is running on port ${PORT}`);
  console.log('========================================');
  console.log('  🚀 Backend deployed successfully on Railway!');
  console.log('  Access your API at:');
  console.log(`  https://<your-railway-subdomain>.railway.app/`);
  console.log('========================================');
});

// testing changes
console.log('restarted the server after changes');

app.use((req, res) => {
  console.log('UNMATCHED APP ROUTE:', req.originalUrl);
  res.status(404).json({ message: 'Not found', path: req.originalUrl });
});

// Add a root route for Railway health check and success message
app.get('/', (req, res) => {
  res.send(`✅ Backend deployed successfully on Railway!\nAPI is running. 🚀`);
});