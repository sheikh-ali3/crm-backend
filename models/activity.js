const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  type: {
    type: String,
    enum: ['note', 'call', 'email', 'meeting', 'task', 'other', 'customer_created'],
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  dueDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isImportant: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
activitySchema.index({ customerId: 1 });
activitySchema.index({ assignedTo: 1 });
activitySchema.index({ dueDate: 1 });
activitySchema.index({ type: 1 });
activitySchema.index({ status: 1 });

module.exports = mongoose.model('Activity', activitySchema); 