const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DealSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Deal title is required'],
    trim: true
  },
  value: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    default: 'new'
  },
  expectedCloseDate: {
    type: Date
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

const CustomerSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  status: {
    type: String,
    enum: ['new', 'active', 'inactive', 'lead', 'opportunity', 'customer'],
    default: 'new'
  },
  source: {
    type: String,
    enum: ['direct', 'referral', 'web', 'social', 'event', 'other'],
    default: 'direct'
  },
  notes: {
    type: String,
    trim: true
  },
  potentialValue: {
    type: Number,
    default: 0
  },
  tags: [String],
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  deals: [DealSchema],
  interactions: [{
    type: {
      type: String,
      enum: ['call', 'email', 'meeting', 'note', 'other'],
      required: true
    },
    subject: String,
    details: String,
    date: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { 
  timestamps: true 
});

// Define virtual for full name
CustomerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Index for faster searches
CustomerSchema.index({ firstName: 'text', lastName: 'text', email: 'text', company: 'text' });
CustomerSchema.index({ assignedTo: 1 });
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ 'deals.status': 1 });

// Create the model
const Customer = mongoose.model('Customer', CustomerSchema);

module.exports = Customer; 