const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  enterpriseDetails: {
    companyName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  items: [{
    type: {
      type: String,
      enum: ['service', 'quotation', 'product'],
      required: true
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: {
    type: Date
  },
  notes: {
    type: String
  },
  billingPeriod: {
    type: String,
    enum: ['one time', 'monthly', 'fortnight', 'yearly', '6 months', '3 months'],
    default: 'one time'
  }
}, { timestamps: true });

// Add index for faster queries
invoiceSchema.index({ adminId: 1, status: 1 });
invoiceSchema.index({ 'items.itemId': 1, 'items.type': 1 });

// Method to generate invoice number
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Find the last invoice number for this month
  const lastInvoice = await this.findOne({
    invoiceNumber: { $regex: `INV-${year}${month}-` }
  }).sort({ invoiceNumber: -1 });
  
  let nextNumber = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split('-');
    nextNumber = parseInt(parts[2]) + 1;
  }
  
  return `INV-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice; 