const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['IT', 'Marketing', 'Design', 'Consulting', 'Support', 'Training', 'Other'],
    default: 'Other'
  },
  features: [{
    name: String,
    included: {
      type: Boolean,
      default: true
    }
  }],
  duration: {
    value: Number,
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months', 'years', 'one-time'],
      default: 'one-time'
    }
  },
  icon: {
    type: String,
    default: '🔧'
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service; 