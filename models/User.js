const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define productAccessSchema with permissions as Mixed
const productAccessSchema = new Schema({
  productId: {
    type: String,
    required: true
  },
  hasAccess: {
    type: Boolean,
    default: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  revokedAt: {
    type: Date
  },
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  accessToken: {
    type: String,
    sparse: true
  },
  accessLink: {
    type: String,
    sparse: true
  },
  accessUrl: {
    type: String,
    sparse: true
  },
  lastAccessed: {
    type: Date
  },
  accessCount: {
    type: Number,
    default: 0
  },
  usageSummary: {
    dailyActiveUsers: {
      type: Number,
      default: 0
    },
    monthlyActiveUsers: {
      type: Number,
      default: 0
    },
    totalActions: {
      type: Number,
      default: 0
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  permissions: {
    type: Schema.Types.Mixed,
    default: {}
  }
});

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true // Enforce unique emails at the schema level
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'user'], 
    default: 'user' 
  },
  permissions: {
    crmAccess: {
      type: Boolean,
      default: false
    },
    hrmAccess: {
      type: Boolean,
      default: false
    },
    jobPortalAccess: {
      type: Boolean,
      default: false
    },
    jobBoardAccess: {
      type: Boolean,
      default: false
    },
    projectManagementAccess: {
      type: Boolean,
      default: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.role === 'user'; // Only required for regular users
    }
  },
  profile: {
    fullName: { 
      type: String, 
      default: '' 
    },
    phone: { 
      type: String, 
      default: '' 
    },
    department: { 
      type: String, 
      default: '' 
    },
    joinDate: { 
      type: Date, 
      default: Date.now 
    },
    status: { 
      type: String, 
      enum: ['active', 'inactive'], 
      default: 'active' 
    }
  },
  // New enterprise fields for admin accounts
  enterprise: {
    enterpriseId: {
      type: String,
      trim: true,
      sparse: true
    },
    companyName: {
      type: String,
      trim: true
    },
    logo: {
      type: String, // URL to logo
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    mailingAddress: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    },
    zipCode: {
      type: String,
      default: ''
    },
    phoneNumber: {
      type: String,
      default: ''
    },
    companyEmail: {
      type: String,
      trim: true
    },
    loginLink: {
      type: String,
      default: ''
    },
    industry: {
      type: String,
      default: ''
    },
    businessType: {
      type: String,
      default: ''
    }
  },
  // Enhanced product access tracking
  productAccess: [productAccessSchema]
}, { 
  timestamps: true 
});

// Ensure a unique index on email for existing collections
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema); 