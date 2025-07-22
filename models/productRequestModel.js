const mongoose = require('mongoose');

const productRequestSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  enterpriseName: {
    type: String,
    required: true
  },
  contactName: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    required: true
  },
  contactPhone: {
    type: String,
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  paymentMethod: {
    type: String,
    enum: ['bankTransfer', 'creditCard', 'other'],
    default: 'bankTransfer'
  },
  bankAccount: {
    type: String
  },
  additionalInfo: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  processedDate: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  }
}, { timestamps: true });

const ProductRequest = mongoose.model('ProductRequest', productRequestSchema);

module.exports = ProductRequest; 