const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '📋'
  },
  category: {
    type: String,
    enum: ['crm', 'hrm', 'job-portal', 'job-board', 'project-management', 'other'],
    default: 'other'
  },
  features: [{
    name: String,
    description: String,
    isEnabled: {
      type: Boolean,
      default: true
    }
  }],
  pricing: {
    isFree: {
      type: Boolean,
      default: false
    },
    price: {
      type: Number,
      default: 0
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'one-time'],
      default: 'monthly'
    }
  },
  usage: {
    totalEnterprises: {
      type: Number,
      default: 0
    },
    activeEnterprises: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  accessLink: {
    type: String,
    unique: true
  },
  displayInMenu: {
    type: Boolean,
    default: true
  },
  menuOrder: {
    type: Number,
    default: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Pre-save hook to set category based on productId if not explicitly set
productSchema.pre('save', function(next) {
  if (!this.category || this.category === 'other') {
    // Automatically categorize based on productId
    if (this.productId === 'crm') this.category = 'crm';
    else if (this.productId === 'hrm') this.category = 'hrm';
    else if (this.productId === 'job-portal') this.category = 'job-portal';
    else if (this.productId === 'job-board') this.category = 'job-board';
    else if (this.productId === 'project-management') this.category = 'project-management';
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
