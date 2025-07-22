const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketSchema = new Schema({
  ticketNo: {
    type: String,
    unique: true
  },
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  enterpriseId: {
    type: String,
    required: true
  },
  forwardedToSuperAdmin: {
    type: Boolean,
    default: false
  },
  forwardedAt: {
    type: Date
  },
  forwardedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  relatedTo: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  category: {
    type: String,
    enum: ['Technical', 'Billing', 'Product', 'Service', 'Other'],
    default: 'Other'
  },
  relatedProducts: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  relatedServices: [{
    type: String
  }],
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expectedCompletionDate: {
    type: Date
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    text: String,
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    postedAt: {
      type: Date,
      default: Date.now
    }
  }],
  responses: [{
    message: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'superadmin', 'user']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isAdminTicket: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true
});

// Generate ticket number before saving
TicketSchema.pre('validate', function(next) {
  if (!this.ticketNo) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    this.ticketNo = `TKT-${year}-${month}-${randomNum}`;
  }
  next();
});

// Update the updatedAt timestamp before saving
TicketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema); 