const Product = require('../models/productModel');
const User = require('../models/User');
const crypto = require('crypto');

// Generate a unique access link token
const generateAccessLink = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Create a new product
const createProduct = async (req, res) => {
  try {
    const { productId, name, description, icon, category, features, pricing, displayInMenu, menuOrder } = req.body;
    
    // Check if product with same ID already exists
    const existingProduct = await Product.findOne({ productId });
    if (existingProduct) {
      return res.status(400).json({ message: 'A product with this ID already exists' });
    }
    
    // Generate unique access link
    const accessLink = generateAccessLink();
    
    const product = new Product({
      productId,
      name,
      description,
      icon: icon || '📋',
      category: category || null, // Will be set by pre-save hook if null
      features: features || [],
      pricing: pricing || { isFree: true },
      createdBy: req.user.id,
      accessLink,
      displayInMenu: displayInMenu !== undefined ? displayInMenu : true,
      menuOrder: menuOrder || 100
    });
    
    await product.save();
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${accessLink}`;
    
    res.status(201).json({ 
      product,
      accessUrl
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// Get all products - with optional filtering
const getAllProducts = async (req, res) => {
  try {
    const { active, category } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by active status if provided
    if (active !== undefined) {
      query.active = active === 'true';
    }
    
    // Filter by category if provided
    if (category) {
      query.category = category;
    }
    
    const products = await Product.find(query).sort({ menuOrder: 1, createdAt: -1 });
    
    // Format the response
    const formattedProducts = products.map(product => {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
      
      return {
        ...product.toObject(),
        accessUrl
      };
    });
    
    res.json(formattedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

// Get a single product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
    
    res.json({
      ...product.toObject(),
      accessUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

// Update a product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, category, features, pricing, active, displayInMenu, menuOrder } = req.body;
    
    // Find the product by ID or productId
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (icon) product.icon = icon;
    if (category) product.category = category;
    if (features) product.features = features;
    if (pricing) product.pricing = pricing;
    if (active !== undefined) product.active = active;
    if (displayInMenu !== undefined) product.displayInMenu = displayInMenu;
    if (menuOrder !== undefined) product.menuOrder = menuOrder;
    
    product.updatedAt = Date.now();
    
    await product.save();
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
    
    res.json({
      ...product.toObject(),
      accessUrl
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

// Delete a product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the product by ID or productId
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if product is in use by any admin
    const adminCount = await User.countDocuments({
      'productAccess.productId': product.productId,
      'productAccess.hasAccess': true
    });
    
    if (adminCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete product that is being used by ${adminCount} admin(s)`,
        adminCount
      });
    }
    
    await Product.findByIdAndDelete(product._id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

// Regenerate product access link
const regenerateAccessLink = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the product by ID or productId
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Generate new access link
    const newAccessLink = generateAccessLink();
    product.accessLink = newAccessLink;
    product.updatedAt = Date.now();
    
    await product.save();
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${newAccessLink}`;
    
    res.json({
      ...product.toObject(),
      accessUrl
    });
  } catch (error) {
    console.error('Error regenerating access link:', error);
    res.status(500).json({ message: 'Failed to regenerate access link', error: error.message });
  }
};

// Get product by access link
const getProductByAccessLink = async (req, res) => {
  try {
    const { accessLink } = req.params;
    
    const product = await Product.findOne({ accessLink, active: true });
    
    if (!product) {
      return res.status(404).json({ message: 'Invalid or expired access link' });
    }
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
    
    res.json({
      ...product.toObject(),
      accessUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

// Grant product access to an admin
const grantProductAccess = async (req, res) => {
  try {
    const { adminId, productId } = req.params;
    
    // Verify admin exists
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify product exists
    const product = await Product.findOne({ 
      $or: [
        { _id: productId },
        { productId: productId }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Generate access token and link
    const accessToken = crypto.randomBytes(16).toString('hex');
    const accessLink = crypto.randomBytes(8).toString('hex');
    
    // Check if admin already has access to this product
    const existingAccess = admin.productAccess.find(p => 
      p.productId === product.productId);
    
    if (existingAccess) {
      // Update existing access
      existingAccess.hasAccess = true;
      existingAccess.revokedAt = null;
      existingAccess.revokedBy = null;
      existingAccess.accessToken = accessToken;
      existingAccess.accessLink = accessLink;
      existingAccess.updatedAt = Date.now();
      
      // If grantedAt is more than 30 days ago, update it
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (!existingAccess.grantedAt || existingAccess.grantedAt < thirtyDaysAgo) {
        existingAccess.grantedAt = Date.now();
        existingAccess.grantedBy = req.user.id;
      }
    } else {
      // Add new access
      admin.productAccess.push({
        productId: product.productId,
        hasAccess: true,
        grantedAt: Date.now(),
        grantedBy: req.user.id,
        accessToken,
        accessLink,
        updatedAt: Date.now()
      });
    }
    
    // Also update the corresponding permission field
    if (product.productId === 'crm') admin.permissions.crmAccess = true;
    if (product.productId === 'hrm') admin.permissions.hrmAccess = true;
    if (product.productId === 'job-portal') admin.permissions.jobPortalAccess = true;
    if (product.productId === 'job-board') admin.permissions.jobBoardAccess = true;
    if (product.productId === 'project-management') admin.permissions.projectManagementAccess = true;
    
    await admin.save();
    
    // Update product usage statistics
    product.usage.totalEnterprises += 1;
    product.usage.activeEnterprises += 1;
    await product.save();
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Find the newly updated product access
    const updatedAccess = admin.productAccess.find(p => p.productId === product.productId);
    updatedAccess.accessUrl = `${baseUrl}/products/${product.productId}/access/${updatedAccess.accessLink}`;
    
    await admin.save();
    
    res.json({
      message: `Access to ${product.name} granted successfully`,
      admin: {
        id: admin._id,
        email: admin.email,
        productAccess: admin.productAccess
      }
    });
  } catch (error) {
    console.error('Error granting product access:', error);
    res.status(500).json({ message: 'Failed to grant product access', error: error.message });
  }
};

// Revoke product access from an admin
const revokeProductAccess = async (req, res) => {
  try {
    const { adminId, productId } = req.params;
    
    // Verify admin exists
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify product exists
    const product = await Product.findOne({ 
      $or: [
        { _id: productId },
        { productId: productId }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find product access
    const accessIndex = admin.productAccess.findIndex(p => 
      p.productId === product.productId);
    
    if (accessIndex === -1) {
      return res.status(400).json({ message: 'Admin does not have access to this product' });
    }
    
    // Update access
    admin.productAccess[accessIndex].hasAccess = false;
    admin.productAccess[accessIndex].revokedAt = Date.now();
    admin.productAccess[accessIndex].revokedBy = req.user.id;
    admin.productAccess[accessIndex].updatedAt = Date.now();
    
    // Also update the corresponding permission field
    if (product.productId === 'crm') admin.permissions.crmAccess = false;
    if (product.productId === 'hrm') admin.permissions.hrmAccess = false;
    if (product.productId === 'job-portal') admin.permissions.jobPortalAccess = false;
    if (product.productId === 'job-board') admin.permissions.jobBoardAccess = false;
    if (product.productId === 'project-management') admin.permissions.projectManagementAccess = false;
    
    await admin.save();
    
    // Update product usage statistics
    if (product.usage.activeEnterprises > 0) {
      product.usage.activeEnterprises -= 1;
      await product.save();
    }
    
    res.json({
      message: `Access to ${product.name} revoked successfully`,
      admin: {
        id: admin._id,
        email: admin.email,
        productAccess: admin.productAccess
      }
    });
  } catch (error) {
    console.error('Error revoking product access:', error);
    res.status(500).json({ message: 'Failed to revoke product access', error: error.message });
  }
};

// Get product usage analytics
const getProductAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the product
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get all admins with access to this product
    const admins = await User.find({ 
      role: 'admin',
      'productAccess.productId': product.productId,
      'productAccess.hasAccess': true
    }).select('email profile enterprise productAccess');
    
    // Extract analytics data
    const analytics = {
      productId: product.productId,
      name: product.name,
      totalEnterprises: product.usage.totalEnterprises,
      activeEnterprises: product.usage.activeEnterprises,
      enterprises: admins.map(admin => ({
        id: admin._id,
        email: admin.email,
        name: admin.profile.fullName,
        company: admin.enterprise.companyName,
        accessDetails: admin.productAccess.find(p => p.productId === product.productId)
      }))
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error getting product analytics:', error);
    res.status(500).json({ message: 'Failed to get product analytics', error: error.message });
  }
};

// Get products an admin has access to
const getAdminProducts = async (req, res) => {
  try {
    const { adminId } = req.params;
    
    // Verify admin exists
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Get all products
    const allProducts = await Product.find({ active: true });
    
    // Format product access information
    const products = allProducts.map(product => {
      const access = admin.productAccess.find(p => p.productId === product.productId);
      const hasAccess = access && access.hasAccess;
      
      return {
        id: product._id,
        productId: product.productId,
        name: product.name,
        description: product.description,
        icon: product.icon,
        category: product.category,
        hasAccess,
        accessDetails: hasAccess ? access : null
      };
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error getting admin products:', error);
    res.status(500).json({ message: 'Failed to get admin products', error: error.message });
  }
};

// CRM Product management for enterprise (placeholders, can be customized for enterprise scope)
const createCrmProduct = async (req, res) => {
  try {
    const { productId, name, description, icon, category, features, pricing, displayInMenu, menuOrder } = req.body;
    
    // Check if product with same ID already exists
    const existingProduct = await Product.findOne({ productId });
    if (existingProduct) {
      return res.status(400).json({ message: 'A product with this ID already exists' });
    }
    
    // Generate unique access link
    const accessLink = generateAccessLink();
    
    const product = new Product({
      productId,
      name,
      description,
      icon: icon || '📋',
      category: category || null, // Will be set by pre-save hook if null
      features: features || [],
      pricing: pricing || { isFree: true },
      createdBy: req.user.id,
      accessLink,
      displayInMenu: displayInMenu !== undefined ? displayInMenu : true,
      menuOrder: menuOrder || 100
    });
    
    await product.save();
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${accessLink}`;
    
    res.status(201).json({ 
      product,
      accessUrl
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

const getCrmProducts = async (req, res) => {
  try {
    const { active, category } = req.query;
    const user = req.user;
    const enterpriseId = user.enterprise?.enterpriseId;
    let enterpriseUsers = [];
    if (enterpriseId) {
      // Fetch all admins in the same enterprise
      enterpriseUsers = await User.find({ 'enterprise.enterpriseId': enterpriseId, role: 'admin' }, '_id');
    }
    const enterpriseUserIds = enterpriseUsers.map(u => u._id.toString());
    // Query for products created by enterprise admins
    const enterpriseQuery = {
      createdBy: { $in: enterpriseUserIds },
    };
    if (active !== undefined) enterpriseQuery.active = active === 'true';
    if (category) enterpriseQuery.category = category;
    // Query for products created by superadmin
    const superadminUsers = await User.find({ role: 'superadmin' }, '_id');
    const superadminUserIds = superadminUsers.map(u => u._id.toString());
    const superadminQuery = {
      createdBy: { $in: superadminUserIds },
    };
    if (active !== undefined) superadminQuery.active = active === 'true';
    if (category) superadminQuery.category = category;
    // Fetch products
    const [enterpriseProducts, superadminProducts] = await Promise.all([
      Product.find(enterpriseQuery).sort({ menuOrder: 1, createdAt: -1 }),
      Product.find(superadminQuery).sort({ menuOrder: 1, createdAt: -1 })
    ]);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const format = (product, editable) => ({
      ...product.toObject(),
      accessUrl: `${baseUrl}/products/access/${product.accessLink}`,
      editable
    });
    res.json({
      enterpriseProducts: enterpriseProducts.map(p => format(p, true)),
      superadminProducts: superadminProducts.map(p => format(p, false))
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

const getCrmProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
    
    res.json({
      ...product.toObject(),
      accessUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

const updateCrmProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, category, features, pricing, active, displayInMenu, menuOrder } = req.body;
    
    // Find the product by ID or productId
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (icon) product.icon = icon;
    if (category) product.category = category;
    if (features) product.features = features;
    if (pricing) product.pricing = pricing;
    if (active !== undefined) product.active = active;
    if (displayInMenu !== undefined) product.displayInMenu = displayInMenu;
    if (menuOrder !== undefined) product.menuOrder = menuOrder;
    
    product.updatedAt = Date.now();
    
    await product.save();
    
    // Generate access URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
    
    res.json({
      ...product.toObject(),
      accessUrl
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

const deleteCrmProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the product by ID or productId
    const product = await Product.findOne({ 
      $or: [
        { _id: id },
        { productId: id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if product is in use by any admin
    const adminCount = await User.countDocuments({
      'productAccess.productId': product.productId,
      'productAccess.hasAccess': true
    });
    
    if (adminCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete product that is being used by ${adminCount} admin(s)`,
        adminCount
      });
    }
    
    await Product.findByIdAndDelete(product._id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

// Get all products accessible to the user's enterprise
const getEnterpriseProducts = async (req, res) => {
  try {
    const user = req.user;
    // Only use the current user's productAccess
    const productIds = (user.productAccess || [])
      .filter(pa => pa.hasAccess)
      .map(pa => pa.productId);
    if (!productIds.length) {
      return res.json([]);
    }
    // Fetch products by productId
    const products = await Product.find({ productId: { $in: productIds }, active: true });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formattedProducts = products.map(product => {
      const accessUrl = `${baseUrl}/products/access/${product.accessLink}`;
      return {
        ...product.toObject(),
        accessUrl
      };
    });
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error in getEnterpriseProducts:', error);
    res.status(500).json({ message: 'Failed to fetch enterprise products', error: error.message });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  regenerateAccessLink,
  getProductByAccessLink,
  grantProductAccess,
  revokeProductAccess,
  getProductAnalytics,
  getAdminProducts,
  createCrmProduct,
  getCrmProducts,
  getCrmProductById,
  updateCrmProduct,
  deleteCrmProduct,
  getEnterpriseProducts
};
