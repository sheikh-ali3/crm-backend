const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'superadmin']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const complaintSchema = new mongoose.Schema({
  // ... existing fields ...
  responses: [responseSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Complaint', complaintSchema); 