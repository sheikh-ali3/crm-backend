const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  title: {
    type: String,
    default: 'Notification'
  },
  read: {
    type: Boolean,
    default: false
  },
  link: {
    type: String
  },
  relatedTo: {
    model: {
      type: String,
      enum: ['Quotation', 'Service', 'Invoice', 'User', 'Ticket']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster querying by user and read status
notificationSchema.index({ userId: 1, read: 1 });
// Index for sorting by creation date
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 