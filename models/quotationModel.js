const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  requestDetails: {
    type: String,
    required: true
  },
  enterpriseDetails: {
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String
  },
  requestedPrice: {
    type: Number,
    min: 0
  },
  finalPrice: {
    type: Number,
    min: 0
  },
  customRequirements: {
    type: String
  },
  additionalNotes: {
    type: String
  },
  superadminNotes: {
    type: String
  },
  proposedDeliveryDate: {
    type: Date
  },
  approvedDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  completedDate: {
    type: Date
  }
}, { timestamps: true });

const Quotation = mongoose.model('Quotation', quotationSchema);

module.exports = Quotation; 