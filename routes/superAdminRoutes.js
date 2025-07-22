const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/customer');
const Activity = require('../models/activity');
const Product = require('../models/productModel');
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRole, checkCrmAccess } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const authController = require('../controllers/authController');

// Generate a unique access link token based on enterprise data
const generateAccessLink = (enterpriseName = '') => {
  const randomToken = crypto.randomBytes(8).toString('hex');
  
  if (enterpriseName) {
    // Convert enterprise name to URL-friendly slug
    let slug = enterpriseName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
      .substring(0, 30);             // Limit length
      
    // Ensure slug is not empty
    if (slug.length < 2) {
      slug = 'e';
    }
    
    return `${slug}-${randomToken}`;
  }
  
  return randomToken;
};

/**
 * ADMIN MANAGEMENT ROUTES
 */

// Get all admins
router.get('/admins', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password');
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single admin by ID
router.get('/admins/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
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

// Create new admin (Enterprise)
router.post('/create-admin', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { email, password, profile, permissions, enterprise, productAccess } = req.body;
    console.log('Creating new admin:', { email, permissions, enterprise: enterprise?.companyName });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Check if enterpriseId already exists
    if (enterprise?.enterpriseId) {
      const existingEnterprise = await User.findOne({ 'enterprise.enterpriseId': enterprise.enterpriseId });
      if (existingEnterprise) {
        return res.status(400).json({ message: 'Enterprise ID already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the admin with all provided data
    const newAdmin = await User.create({
      email,
      password: hashedPassword,
      role: 'admin',
      permissions: {
        crmAccess: permissions?.crmAccess || false,
        leads: { view: true, add: true, edit: true, delete: true }
      },
      profile: {
        ...profile,
        status: 'active'
      },
      enterprise: enterprise || {},
      productAccess: permissions?.crmAccess ? 
        [...(productAccess || []), { productId: 'crm', grantedAt: new Date() }] : 
        (productAccess || [])
    });

    console.log('Admin created successfully:', { 
      email, 
      permissions: newAdmin.permissions,
      enterpriseId: newAdmin.enterprise?.enterpriseId,
      companyName: newAdmin.enterprise?.companyName
    });

    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
        profile: newAdmin.profile,
        permissions: newAdmin.permissions,
        enterprise: newAdmin.enterprise,
        productAccess: newAdmin.productAccess
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    
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
    
    res.status(500).json({ message: 'Failed to create admin' });
  }
});

// Update admin
router.put('/admins/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('Updating admin:', { id, updateData });

    // Check if enterpriseId is being updated and if it already exists
    if (updateData.enterprise?.enterpriseId) {
      console.log('Checking enterprise ID:', updateData.enterprise.enterpriseId, 'for admin:', id);
      
      // Get current admin to check if enterpriseId is actually being changed
      const currentAdmin = await User.findById(id);
      if (!currentAdmin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      const currentEnterpriseId = currentAdmin.enterprise?.enterpriseId;
      const newEnterpriseId = updateData.enterprise.enterpriseId;
      
      console.log('Enterprise ID comparison:', {
        current: currentEnterpriseId,
        new: newEnterpriseId,
        isChanging: currentEnterpriseId !== newEnterpriseId
      });
      
      // Only validate if the enterprise ID is actually being changed
      if (currentEnterpriseId !== newEnterpriseId) {
        const existingEnterprise = await User.findOne({ 
          'enterprise.enterpriseId': newEnterpriseId, 
          _id: { $ne: id } 
        });
        
        if (existingEnterprise) {
          console.log('Enterprise ID conflict found:', {
            requestedId: newEnterpriseId,
            existingAdmin: existingEnterprise._id,
            existingEmail: existingEnterprise.email
          });
          return res.status(400).json({ message: 'Enterprise ID already exists' });
        }
      }
    }
    
    // Ensure permissions object exists and is properly structured
    if (updateData.permissions) {
      updateData.permissions = {
        crmAccess: Boolean(updateData.permissions.crmAccess),
        hrmAccess: Boolean(updateData.permissions.hrmAccess),
        jobPortalAccess: Boolean(updateData.permissions.jobPortalAccess),
        jobBoardAccess: Boolean(updateData.permissions.jobBoardAccess),
        projectManagementAccess: Boolean(updateData.permissions.projectManagementAccess),
        users: updateData.permissions.users || { add: false }
      };
    }
    
    // If updating password, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Handle product access updates
    if (updateData.productAccess) {
      console.log('Updating product access:', updateData.productAccess);
      
      // Ensure each product access item has the required fields
      const processedProductAccess = updateData.productAccess.map(item => ({
        productId: item.productId,
        hasAccess: item.hasAccess !== undefined ? item.hasAccess : true,
        grantedAt: item.grantedAt || new Date(),
        accessCount: item.accessCount || 0,
        usageSummary: item.usageSummary || {
          dailyActiveUsers: 0,
          monthlyActiveUsers: 0,
          totalActions: 0
        },
        updatedAt: new Date()
      }));
      
      updateData.productAccess = processedProductAccess;
      
      // Update permissions based on product access
      if (updateData.permissions) {
        updateData.permissions.crmAccess = processedProductAccess.some(p => p.productId === 'crm' && p.hasAccess);
        updateData.permissions.hrmAccess = processedProductAccess.some(p => p.productId === 'hrm' && p.hasAccess);
        updateData.permissions.jobPortalAccess = processedProductAccess.some(p => p.productId === 'job-portal' && p.hasAccess);
        updateData.permissions.jobBoardAccess = processedProductAccess.some(p => p.productId === 'job-board' && p.hasAccess);
        updateData.permissions.projectManagementAccess = processedProductAccess.some(p => p.productId === 'project-management' && p.hasAccess);
      }
    } else if (updateData.permissions) {
      // If permissions are being updated but no productAccess array, sync productAccess with permissions
      console.log('Syncing product access with permissions:', updateData.permissions);
      
      // Get current admin to access current product access data
      const currentAdmin = await User.findById(id);
      if (!currentAdmin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      let currentProductAccess = currentAdmin.productAccess || [];
      
      // Handle CRM access
      if (updateData.permissions.crmAccess && !currentProductAccess.some(p => p.productId === 'crm')) {
        currentProductAccess.push({
          productId: 'crm',
          hasAccess: true,
          grantedAt: new Date(),
          accessCount: 0,
          usageSummary: { dailyActiveUsers: 0, monthlyActiveUsers: 0, totalActions: 0 },
          updatedAt: new Date()
        });
      } else if (!updateData.permissions.crmAccess) {
        currentProductAccess = currentProductAccess.filter(p => p.productId !== 'crm');
      }
      
      // Handle HRM access
      if (updateData.permissions.hrmAccess && !currentProductAccess.some(p => p.productId === 'hrm')) {
        currentProductAccess.push({
          productId: 'hrm',
          hasAccess: true,
          grantedAt: new Date(),
          accessCount: 0,
          usageSummary: { dailyActiveUsers: 0, monthlyActiveUsers: 0, totalActions: 0 },
          updatedAt: new Date()
        });
      } else if (!updateData.permissions.hrmAccess) {
        currentProductAccess = currentProductAccess.filter(p => p.productId !== 'hrm');
      }
      
      // Handle Job Portal access
      if (updateData.permissions.jobPortalAccess && !currentProductAccess.some(p => p.productId === 'job-portal')) {
        currentProductAccess.push({
          productId: 'job-portal',
          hasAccess: true,
          grantedAt: new Date(),
          accessCount: 0,
          usageSummary: { dailyActiveUsers: 0, monthlyActiveUsers: 0, totalActions: 0 },
          updatedAt: new Date()
        });
      } else if (!updateData.permissions.jobPortalAccess) {
        currentProductAccess = currentProductAccess.filter(p => p.productId !== 'job-portal');
      }
      
      // Handle Job Board access
      if (updateData.permissions.jobBoardAccess && !currentProductAccess.some(p => p.productId === 'job-board')) {
        currentProductAccess.push({
          productId: 'job-board',
          hasAccess: true,
          grantedAt: new Date(),
          accessCount: 0,
          usageSummary: { dailyActiveUsers: 0, monthlyActiveUsers: 0, totalActions: 0 },
          updatedAt: new Date()
        });
      } else if (!updateData.permissions.jobBoardAccess) {
        currentProductAccess = currentProductAccess.filter(p => p.productId !== 'job-board');
      }
      
      // Handle Project Management access
      if (updateData.permissions.projectManagementAccess && !currentProductAccess.some(p => p.productId === 'project-management')) {
        currentProductAccess.push({
          productId: 'project-management',
          hasAccess: true,
          grantedAt: new Date(),
          accessCount: 0,
          usageSummary: { dailyActiveUsers: 0, monthlyActiveUsers: 0, totalActions: 0 },
          updatedAt: new Date()
        });
      } else if (!updateData.permissions.projectManagementAccess) {
        currentProductAccess = currentProductAccess.filter(p => p.productId !== 'project-management');
      }
      
      updateData.productAccess = currentProductAccess;
      console.log('Updated product access based on permissions:', currentProductAccess.map(p => p.productId));
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
      permissions: admin.permissions,
      enterprise: admin.enterprise?.companyName,
      productAccess: admin.productAccess?.map(p => p.productId)
    });
    
    res.json({
      message: 'Admin updated successfully',
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
        profile: admin.profile,
        permissions: admin.permissions,
        enterprise: admin.enterprise,
        productAccess: admin.productAccess,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Toggle CRM Access
router.put('/admins/:id/toggle-crm-access', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { crmAccess } = req.body;
    
    console.log(`Toggling CRM access for admin ${id} to: ${crmAccess}`);
    
    // Ensure the value is a boolean
    const accessValue = Boolean(crmAccess);
    
    // Get current admin to modify both permissions and productAccess
    const currentAdmin = await User.findById(id);
    if (!currentAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Update data to change
    const updateData = {
      'permissions.crmAccess': accessValue
    };
    
    // Update productAccess for CRM
    let currentProductAccess = currentAdmin.productAccess || [];
    
    if (accessValue && !currentProductAccess.some(p => p.productId === 'crm')) {
      // Add CRM to productAccess if granting access
      currentProductAccess.push({ productId: 'crm', grantedAt: new Date() });
    } else if (!accessValue) {
      // Remove CRM from productAccess if revoking
      currentProductAccess = currentProductAccess.filter(p => p.productId !== 'crm');
    }
    
    updateData.productAccess = currentProductAccess;
    
    // Update the admin permissions and productAccess
    const admin = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log('CRM access updated successfully:', { 
      id: admin._id, 
      email: admin.email,
      permissions: admin.permissions, 
      productAccess: admin.productAccess.map(p => p.productId)
    });
    
    res.json({
      success: true,
      message: `CRM access ${accessValue ? 'granted' : 'revoked'} successfully`,
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        productAccess: admin.productAccess
      }
    });
  } catch (error) {
    console.error('Error toggling CRM access:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update CRM access',
      error: error.message
    });
  }
});

// Grant product access
router.put('/admins/:id/products/:productId/grant', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id, productId } = req.params;
    
    console.log(`Granting ${productId} access for admin ${id}`);
    
    // Get current admin
    const currentAdmin = await User.findById(id);
    if (!currentAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Prepare update data
    const updateData = {};
    
    // Update productAccess
    let currentProductAccess = currentAdmin.productAccess || [];
    const existingProductIndex = currentProductAccess.findIndex(p => p.productId === productId);
    
    // Generate access token and link for the product
    const accessToken = crypto.randomBytes(16).toString('hex');
    const enterpriseName = currentAdmin.enterprise?.companyName || currentAdmin.profile?.fullName || '';
    const accessLink = generateAccessLink(enterpriseName);
    
    // Get enterprise name from admin record
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const productPath = `/products/access/${accessLink}`;
    
    // Format as subdomain when in production
    const isProduction = process.env.NODE_ENV === 'production';
    const accessUrl = isProduction 
      ? `https://${accessLink}.${baseUrl.replace(/^https?:\/\//, '')}`
      : `${baseUrl}${productPath}`;
    
    if (existingProductIndex >= 0) {
      // Update existing product access
      currentProductAccess[existingProductIndex].hasAccess = true;
      currentProductAccess[existingProductIndex].accessToken = accessToken;
      currentProductAccess[existingProductIndex].accessLink = accessLink;
      currentProductAccess[existingProductIndex].accessUrl = accessUrl;
      currentProductAccess[existingProductIndex].updatedAt = new Date();
    } else {
      // Add new product access
      currentProductAccess.push({
        productId,
        hasAccess: true,
        grantedAt: new Date(),
        accessToken,
        accessLink,
        accessUrl
      });
    }
    
    // Handle special case for CRM product
    if (productId === 'crm') {
      updateData['permissions.crmAccess'] = true;
    }
    
    // Set the updated product access
    updateData.productAccess = currentProductAccess;
    
    // Update the admin with new access
    const admin = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log(`${productId} access granted successfully:`, { 
      id: admin._id, 
      email: admin.email,
      productAccess: admin.productAccess.map(p => p.productId)
    });
    
    res.json({
      success: true,
      message: `Access to ${productId} granted successfully`,
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        enterprise: admin.enterprise,
        productAccess: admin.productAccess
      }
    });
  } catch (error) {
    console.error(`Error granting product access:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to grant product access',
      error: error.message
    });
  }
});

// Revoke product access
router.put('/admins/:id/products/:productId/revoke', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id, productId } = req.params;
    
    console.log(`Revoking ${productId} access for admin ${id}`);
    
    // Get current admin
    const currentAdmin = await User.findById(id);
    if (!currentAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Prepare update data
    const updateData = {};
    
    // Update productAccess
    let currentProductAccess = currentAdmin.productAccess || [];
    const existingProductIndex = currentProductAccess.findIndex(p => p.productId === productId);
    
    if (existingProductIndex >= 0) {
      // Update existing access to revoke access but keep the record
      currentProductAccess[existingProductIndex].hasAccess = false;
      currentProductAccess[existingProductIndex].revokedAt = new Date();
    }
    
    // Handle special case for CRM product
    if (productId === 'crm') {
      updateData['permissions.crmAccess'] = false;
    }
    
    // Set the updated product access
    updateData.productAccess = currentProductAccess;
    
    // Update the admin with revoked access
    const admin = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log(`${productId} access revoked successfully:`, { 
      id: admin._id, 
      email: admin.email,
      productAccess: admin.productAccess.map(p => `${p.productId}:${p.hasAccess}`)
    });
    
    res.json({
      success: true,
      message: `Access to ${productId} revoked successfully`,
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        enterprise: admin.enterprise,
        productAccess: admin.productAccess
      }
    });
  } catch (error) {
    console.error(`Error revoking product access:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to revoke product access',
      error: error.message
    });
  }
});

// Regenerate product access link
router.put('/admins/:id/products/:productId/regenerate', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id, productId } = req.params;
    
    console.log(`Regenerating access link for ${productId} for admin ${id}`);
    
    // Get current admin
    const currentAdmin = await User.findById(id);
    if (!currentAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Check if the admin has access to this product
    let currentProductAccess = currentAdmin.productAccess || [];
    const existingProductIndex = currentProductAccess.findIndex(p => p.productId === productId);
    
    if (existingProductIndex < 0 || !currentProductAccess[existingProductIndex].hasAccess) {
      return res.status(400).json({ 
        message: `Admin does not have access to ${productId}. Grant access first before regenerating.`
      });
    }
    
    // Generate new access token and link
    const accessToken = crypto.randomBytes(16).toString('hex');
    const enterpriseName = currentAdmin.enterprise?.companyName || currentAdmin.profile?.fullName || '';
    const accessLink = generateAccessLink(enterpriseName);
    
    // Get enterprise name from admin record
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const productPath = `/products/access/${accessLink}`;
    
    // Format as subdomain when in production
    const isProduction = process.env.NODE_ENV === 'production';
    const accessUrl = isProduction 
      ? `https://${accessLink}.${baseUrl.replace(/^https?:\/\//, '')}`
      : `${baseUrl}${productPath}`;
    
    // Update the access link
    currentProductAccess[existingProductIndex].accessToken = accessToken;
    currentProductAccess[existingProductIndex].accessLink = accessLink;
    currentProductAccess[existingProductIndex].accessUrl = accessUrl;
    currentProductAccess[existingProductIndex].updatedAt = new Date();
    
    // Update the admin with new access link
    const admin = await User.findByIdAndUpdate(
      id,
      { $set: { productAccess: currentProductAccess } },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log(`${productId} access link regenerated successfully:`, { 
      id: admin._id, 
      email: admin.email
    });
    
    res.json({
      success: true,
      message: `Access link for ${productId} regenerated successfully`,
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        enterprise: admin.enterprise,
        productAccess: admin.productAccess
      }
    });
  } catch (error) {
    console.error(`Error regenerating product access link:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to regenerate product access link',
      error: error.message
    });
  }
});

// Delete admin
router.delete('/admins/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
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

/**
 * PRODUCT MANAGEMENT ROUTES
 */

// Product CRUD operations
router.post('/products', authenticateToken, authorizeRole('superadmin'), productController.createProduct);
router.get('/products', authenticateToken, authorizeRole('superadmin'), productController.getAllProducts);
router.get('/products/:id', authenticateToken, authorizeRole('superadmin'), productController.getProductById);
router.put('/products/:id', authenticateToken, authorizeRole('superadmin'), productController.updateProduct);
router.delete('/products/:id', authenticateToken, authorizeRole('superadmin'), productController.deleteProduct);
router.post('/products/:id/regenerate-link', authenticateToken, authorizeRole('superadmin'), productController.regenerateAccessLink);

// Admin product access management
router.post('/admins/:adminId/products/:productId/grant', authenticateToken, authorizeRole('superadmin'), productController.grantProductAccess);
router.post('/admins/:adminId/products/:productId/revoke', authenticateToken, authorizeRole('superadmin'), productController.revokeProductAccess);
router.get('/admins/:adminId/products', authenticateToken, authorizeRole('superadmin'), productController.getAdminProducts);

// Product analytics
router.get('/products/:id/analytics', authenticateToken, authorizeRole('superadmin'), productController.getProductAnalytics);

/**
 * CRM OVERVIEW ROUTES
 */

// Get CRM overview for SuperAdmin dashboard
router.get('/crm/overview', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // Get all admins with CRM access
    const admins = await User.find({
      role: 'admin',
      'permissions.crmAccess': true
    }).select('_id email profile enterprise');
    
    // Get overview data for each admin
    const overview = await Promise.all(
      admins.map(async (admin) => {
        // Count customers assigned to this admin
        const customerCount = await Customer.countDocuments({ assignedTo: admin._id });
        
        // Count deals for customers assigned to this admin
        const customers = await Customer.find({ assignedTo: admin._id });
        const dealCount = customers.reduce((total, cust) => {
          return total + (cust.deals ? cust.deals.length : 0);
        }, 0);
        
        // Calculate total deal value
        const dealValue = customers.reduce((total, cust) => {
          if (!cust.deals) return total;
          return total + cust.deals.reduce((sum, deal) => {
            return sum + (deal.value || 0);
          }, 0);
        }, 0);
        
        // Get recent activity for this admin
        const recentActivity = await Activity.find({
          'user.id': admin._id
        }).sort({ timestamp: -1 }).limit(5);
        
        return {
          admin: {
            id: admin._id,
            email: admin.email,
            name: admin.profile?.fullName || admin.email,
            enterprise: admin.enterprise?.companyName
          },
          stats: {
            totalCustomers: customerCount,
            totalDeals: dealCount,
            totalValue: dealValue
          },
          recentActivity
        };
      })
    );
    
    res.json(overview);
  } catch (error) {
    console.error('Error fetching CRM overview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Grant/revoke product access for enterprise
router.post('/grant-product-access', authenticateToken, authController.grantEnterpriseProductAccess);
router.post('/revoke-product-access', authenticateToken, authController.revokeEnterpriseProductAccess);

// Export router
module.exports = router; 