const mongoose = require('mongoose');

const enterpriseRoleSchema = new mongoose.Schema({
  enterpriseId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  permissions: {
    // Example: { products: { view: true, add: true, edit: false, delete: false }, leads: { ... } }
    type: Object,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('EnterpriseRole', enterpriseRoleSchema); 