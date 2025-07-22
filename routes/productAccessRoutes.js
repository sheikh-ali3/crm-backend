const express = require('express');
const router = express.Router();
const Product = require('../models/productModel');
const User = require('../models/User');
const trackProductUsage = require('../middleware/productUsageMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * @route   GET /products/access/:accessLink
 * @desc    Access a product via its access link
 * @access  Public (initial access), then validates admin has proper access
 */
router.get('/access/:accessLink', async (req, res) => {
  try {
    const { accessLink } = req.params;
    
    // Find the product with the given access link
    const product = await Product.findOne({ 
      accessLink, 
      active: true 
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid or expired access link' 
      });
    }

    // Return basic product info for initial validation
    return res.status(200).json({
      success: true,
      product: {
        productId: product.productId,
        name: product.name,
        description: product.description,
        category: product.category,
        icon: product.icon
      },
      message: 'Valid product access link. Please log in to access this product.'
    });
  } catch (error) {
    console.error('Error accessing product by link:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while validating product access' 
    });
  }
});

/**
 * @route   GET /products/verify/:productId
 * @desc    Verify admin has access to a product and record usage
 * @access  Private (requires auth token)
 */
router.get('/verify/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Find the user and verify they have access to this product
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user is admin with access to this product
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can access products' 
      });
    }

    // Find the product access entry
    const hasAccess = user.productAccess.some(
      p => p.productId === productId && p.hasAccess === true
    );

    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this product' 
      });
    }

    // Find the product to return its details
    const product = await Product.findOne({ productId });
    if (!product || !product.active) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found or inactive' 
      });
    }

    // Use the tracking middleware to record this access
    const trackingMiddleware = trackProductUsage(productId);
    await new Promise((resolve) => {
      trackingMiddleware(req, res, resolve);
    });

    // Return product details and access confirmed
    return res.status(200).json({
      success: true,
      product: {
        productId: product.productId,
        name: product.name,
        description: product.description,
        category: product.category,
        features: product.features,
        icon: product.icon
      },
      message: 'Access verified successfully'
    });
  } catch (error) {
    console.error('Error verifying product access:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while verifying product access' 
    });
  }
});

module.exports = router; 