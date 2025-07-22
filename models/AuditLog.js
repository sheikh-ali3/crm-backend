const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  enterpriseId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  target: {
    type: String,
    required: true
  },
  targetId: {
    type: String
  },
  details: {
    type: Object
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

auditLogSchema.index({ enterpriseId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema); 