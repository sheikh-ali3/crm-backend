const User = require('../models/User');
const Product = require('../models/productModel');

/**
 * Middleware to track product usage metrics
 * @param {string} productId - The ID of the product being accessed
 */
const trackProductUsage = (productId) => {
  return async (req, res, next) => {
    try {
      // Only track if a user is authenticated
      if (!req.user || !req.user.id) {
        return next();
      }

      const userId = req.user.id;
      const today = new Date();
      const currentDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

      // Find the user and the specific product access entry
      const user = await User.findById(userId);
      
      if (!user) {
        // If no user found, continue without tracking
        return next();
      }

      // Find the product access entry for this product
      const productAccessIndex = user.productAccess.findIndex(
        p => p.productId === productId && p.hasAccess === true
      );

      if (productAccessIndex === -1) {
        // User doesn't have access to this product, continue without tracking
        return next();
      }

      // Update the lastAccessed timestamp and increment access count
      user.productAccess[productAccessIndex].lastAccessed = new Date();
      user.productAccess[productAccessIndex].accessCount += 1;

      // Initialize usage summary if it doesn't exist
      if (!user.productAccess[productAccessIndex].usageSummary) {
        user.productAccess[productAccessIndex].usageSummary = {
          dailyActiveUsers: {},
          monthlyActiveUsers: {},
          totalActions: 0
        };
      }

      // Track daily active user
      user.productAccess[productAccessIndex].usageSummary.dailyActiveUsers[currentDate] = true;
      
      // Track monthly active user
      user.productAccess[productAccessIndex].usageSummary.monthlyActiveUsers[currentMonth] = true;
      
      // Increment total actions
      user.productAccess[productAccessIndex].usageSummary.totalActions += 1;

      // Save the user document
      await user.save();

      // Also update the product's usage stats
      await Product.findOneAndUpdate(
        { productId: productId },
        { 
          $inc: { 'usage.accessCount': 1 },
          $addToSet: { 'usage.activeEnterprises': user.enterprise?.companyId }
        },
        { new: true }
      );

      next();
    } catch (error) {
      console.error('Error tracking product usage:', error);
      // Continue to the next middleware even if tracking fails
      next();
    }
  };
};

module.exports = trackProductUsage; 