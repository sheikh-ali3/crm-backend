// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }

  return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

// Middleware to check if user is a superadmin
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'superadmin') {
    return next();
  }

  return res.status(403).json({ message: 'Access denied. SuperAdmin privileges required.' });
};

const EnterpriseRole = require('../models/EnterpriseRole');
const User = require('../models/User');

// Usage: checkPermission('products', 'edit')
function checkPermission(module, action) {
  return async (req, res, next) => {
    try {
      // Superadmin always allowed
      if (req.user.role === 'superadmin') return next();
      // Allow admins with crmAccess for product, user, and lead actions
      if (
        req.user.role === 'admin' &&
        req.user.permissions &&
        req.user.permissions.crmAccess === true &&
        (module === 'products' || module === 'users' || module === 'leads')
      ) {
        return next();
      }
      // Allow subusers with CRM product access to view/add products, services, and leads
      if (
        req.user.role === 'user' &&
        Array.isArray(req.user.productAccess) &&
        req.user.productAccess.some(pa => pa.productId === 'crm' && pa.hasAccess) &&
        (
          (module === 'products' && action === 'view') ||
          (module === 'services' && action === 'view') ||
          (module === 'leads' && (action === 'view' || action === 'add'))
        )
      ) {
        return next();
      }
      // Admins and users: check assigned role
      if (
        req.user.permissions &&
        req.user.permissions[module] &&
        req.user.permissions[module][action]
      ) {
        return next();
      }
      return res.status(403).json({ error: 'Permission denied' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { isAdmin, isSuperAdmin, checkPermission };
