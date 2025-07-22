const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, password, profile } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      email,
      password,
      profile,
      role: 'admin', // Default role
      permissions: {
        crmAccess: false,
        leads: { view: true, add: true, edit: true, delete: true }
      }
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Create JWT token
    // Ensure all enterprise fields are present in the payload
    const fullEnterprise = {
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
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        enterprise: fullEnterprise
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          enterprise: fullEnterprise
        }});
      }
    );
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    // Ensure all enterprise fields are present in the payload
    const fullEnterprise = {
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
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        enterprise: fullEnterprise
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          enterprise: fullEnterprise
        }});
      }
    );
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
