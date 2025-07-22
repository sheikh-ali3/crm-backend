const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  console.log('[AUTH] Incoming token:', token);
  if (!token) {
    console.log('[AUTH] No token provided, returning 401');
    return res.sendStatus(401);
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', async (err, decoded) => {
      if (err) {
        console.error('JWT verification error:', err);
        return res.status(403).json({ message: 'Invalid or expired token', error: err.message });
      }
      try {
        // Fetch the full user from the database
        const user = await User.findById(decoded.id);
        console.log('Decoded JWT:', decoded);
        if (!user) {
          console.log('No user found for decoded id:', decoded.id);
          return res.status(403).json({ message: 'User not found' });
        }
        console.log('Authenticated user in middleware:', user);
        req.user = user;
        next();
      } catch (dbErr) {
        console.error('Error fetching user from DB:', dbErr);
        return res.status(500).json({ message: 'Server error', error: dbErr.message });
      }
    });
  } catch (err) {
    console.log('[AUTH] JWT verification error:', err, 'returning 403');
    return res.sendStatus(403);
  }
};

// Middleware to check user role
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    // Check if the user's role is included in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. ${roles.join(' or ')} role required.` 
      });
    }
    
    next();
  };
};

// Middleware to check CRM access for admins
const checkCrmAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    // SuperAdmin always has access
    if (req.user.role === 'superadmin') {
      return next();
    }
    // For admin or user, check permissions or productAccess
    if (req.user.role === 'admin' || req.user.role === 'user') {
      const user = await User.findById(req.user.id);
      // Check legacy permissions
      if (user && user.permissions && user.permissions.crmAccess) {
        return next();
      }
      // Check productAccess for CRM
      if (user && Array.isArray(user.productAccess)) {
        const hasCrmProductAccess = user.productAccess.some(
          (pa) => pa.productId === 'crm' && pa.hasAccess === true
        );
        if (hasCrmProductAccess) {
          return next();
        }
      }
      return res.status(403).json({ message: 'You do not have access to the CRM.' });
    }
    // Default: deny
    return res.status(403).json({ message: 'You do not have access to the CRM.' });
  } catch (error) {
    console.error('CRM access check error:', error);
    res.status(500).json({ message: 'Internal server error checking CRM access.' });
  }
};

module.exports = { authenticateToken, authorizeRole, checkCrmAccess };
