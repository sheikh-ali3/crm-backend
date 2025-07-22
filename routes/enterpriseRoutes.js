const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { checkPermission } = require('../middleware/roleMiddleware');
const customerController = require('../controllers/customerController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/logos');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get enterprise info for the authenticated admin
router.get('/info', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return enterprise info
    res.json({
      name: user.enterprise?.companyName || '',
      industry: user.enterprise?.industry || '',
      business: user.enterprise?.businessType || '',
      website: user.enterprise?.website || '',
      logo: user.enterprise?.logo || '',
      address: user.enterprise?.address || '',
      mailingAddress: user.enterprise?.mailingAddress || '',
      city: user.enterprise?.city || '',
      country: user.enterprise?.country || '',
      zipCode: user.enterprise?.zipCode || '',
      phone: user.enterprise?.phoneNumber || '',
      email: user.enterprise?.companyEmail || ''
    });
  } catch (error) {
    console.error('Error fetching enterprise info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update company info
router.put('/update-company', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    const { name, industry, business, website, existingLogo } = req.body;
    
    // Get the user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize enterprise object if it doesn't exist
    if (!user.enterprise) {
      user.enterprise = {};
    }
    
    // Update company info
    user.enterprise.companyName = name || user.enterprise.companyName;
    user.enterprise.industry = industry || user.enterprise.industry;
    user.enterprise.businessType = business || user.enterprise.businessType;
    user.enterprise.website = website || user.enterprise.website;
    
    // Handle logo upload
    if (req.file) {
      // If there was a previous logo, delete it
      if (user.enterprise.logo && user.enterprise.logo.startsWith('/uploads/')) {
        const oldLogoPath = path.join(__dirname, '..', user.enterprise.logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      
      // Set new logo path
      user.enterprise.logo = `/uploads/logos/${req.file.filename}`;
    } else if (existingLogo) {
      // Keep existing logo
      user.enterprise.logo = existingLogo;
    }
    
    // Save user
    await user.save();
    
    // Return updated info
    res.json({
      name: user.enterprise.companyName || '',
      industry: user.enterprise.industry || '',
      business: user.enterprise.businessType || '',
      website: user.enterprise.website || '',
      logo: user.enterprise.logo || ''
    });
  } catch (error) {
    console.error('Error updating company info:', error);
    // Include the specific error message and stack in the response for debugging
    res.status(500).json({ message: 'Server error', error: error.message, stack: error.stack });
  }
});

// Update contact info
router.put('/update-contact', authenticateToken, async (req, res) => {
  try {
    const { address, mailingAddress, city, country, zipCode, phone, email } = req.body;
    
    // Get the user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize enterprise object if it doesn't exist
    if (!user.enterprise) {
      user.enterprise = {};
    }
    
    // Update contact info
    user.enterprise.address = address || user.enterprise.address;
    user.enterprise.mailingAddress = mailingAddress || user.enterprise.mailingAddress;
    user.enterprise.city = city || user.enterprise.city;
    user.enterprise.country = country || user.enterprise.country;
    user.enterprise.zipCode = zipCode || user.enterprise.zipCode;
    user.enterprise.phoneNumber = phone || user.enterprise.phoneNumber;
    user.enterprise.companyEmail = email || user.enterprise.companyEmail;
    
    // Save user
    await user.save();
    
    // Return updated info
    res.json({
      address: user.enterprise.address || '',
      mailingAddress: user.enterprise.mailingAddress || '',
      city: user.enterprise.city || '',
      country: user.enterprise.country || '',
      zipCode: user.enterprise.zipCode || '',
      phone: user.enterprise.phoneNumber || '',
      email: user.enterprise.companyEmail || ''
    });
  } catch (error) {
    console.error('Error updating contact info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update enterprise by ID (for SuperAdmin)
router.put('/update/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, profile, enterprise, password } = req.body;
    
    console.log(`Updating enterprise with ID: ${id}`);
    
    // Find the admin user
    const admin = await User.findById(id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Create update object
    const updateData = {};
    
    // Update email if provided
    if (email) {
      // Check if email is already in use by another user
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      updateData.email = email;
    }
    
    // Update profile if provided
    if (profile) {
      updateData.profile = {
        ...admin.profile,
        ...profile
      };
    }
    
    // Update enterprise data if provided
    if (enterprise) {
      // Check if enterpriseId is being changed and if it already exists
      if (enterprise.enterpriseId && enterprise.enterpriseId !== admin.enterprise?.enterpriseId) {
        const existingEnterprise = await User.findOne({ 
          'enterprise.enterpriseId': enterprise.enterpriseId, 
          _id: { $ne: id } 
        });
        
        if (existingEnterprise) {
          return res.status(400).json({ message: 'Enterprise ID already exists' });
        }
      }
      
      updateData.enterprise = {
        ...admin.enterprise,
        ...enterprise
      };
    }
    
    // Update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    // Update the admin
    const updatedAdmin = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedAdmin) {
      return res.status(404).json({ message: 'Failed to update admin' });
    }
    
    console.log('Admin updated successfully:', { 
      id: updatedAdmin._id, 
      email: updatedAdmin.email,
      enterprise: updatedAdmin.enterprise?.companyName
    });
    
    res.json({
      message: 'Enterprise updated successfully',
      admin: updatedAdmin
    });
  } catch (error) {
    console.error('Error updating enterprise:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate key error. This field must be unique.' });
    }
    
    res.status(500).json({ message: 'Failed to update enterprise', error: error.message });
  }
});

// CRM Lead management for enterprise (admin/sub-user)
router.post('/crm/leads', authenticateToken, checkPermission('leads','add'), customerController.createCustomer);
router.get('/crm/leads', authenticateToken, checkPermission('leads','view'), customerController.getAllCustomers);
router.get('/crm/leads/:id', authenticateToken, checkPermission('leads','view'), customerController.getCustomerById);
router.put('/crm/leads/:id', authenticateToken, checkPermission('leads','edit'), customerController.updateCustomer);
router.delete('/crm/leads/:id', authenticateToken, checkPermission('leads','delete'), customerController.deleteCustomer);

module.exports = router; 