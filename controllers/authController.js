const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const login = async (req, res) => {
  const { email, password } = req.body;
  
  // Check if user exists
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found');

  // Check if password is correct
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send('Invalid credentials');

  // Generate JWT token
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.json({ token });
};

// Grant product access to enterprise
const grantEnterpriseProductAccess = async (req, res) => {
  try {
    const { enterpriseId, productId } = req.body;
    const user = await User.findOneAndUpdate(
      { 'enterprise.enterpriseId': enterpriseId },
      { $push: { productAccess: { productId, hasAccess: true, grantedAt: new Date(), grantedBy: req.user._id } } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Revoke product access from enterprise
const revokeEnterpriseProductAccess = async (req, res) => {
  try {
    const { enterpriseId, productId } = req.body;
    const user = await User.findOneAndUpdate(
      { 'enterprise.enterpriseId': enterpriseId, 'productAccess.productId': productId },
      { $set: { 'productAccess.$.hasAccess': false, 'productAccess.$.revokedAt': new Date(), 'productAccess.$.revokedBy': req.user._id } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  grantEnterpriseProductAccess,
  revokeEnterpriseProductAccess
};
