const express = require('express');
const router = express.Router();
const Quotation = require('../models/quotationModel');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get all quotations
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'user' || req.user.role === 'admin') {
      const enterpriseId = req.user.enterprise?.enterpriseId;
      if (enterpriseId) {
        // Find all admins in the same enterprise
        const User = require('../models/User');
        const admins = await User.find({ 'enterprise.enterpriseId': enterpriseId, role: 'admin' }, '_id');
        const adminIds = admins.map(a => a._id);
        query.adminId = { $in: adminIds };
      }
    }
    const quotations = await Quotation.find(query)
      .populate('serviceId')
      .populate('adminId', 'email profile')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new quotation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { serviceId, requestDetails, requestedPrice, enterpriseDetails, customRequirements } = req.body;
    if (!serviceId || !requestDetails || !enterpriseDetails) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const quotation = new Quotation({
      serviceId,
      adminId: req.user.id,
      requestDetails,
      requestedPrice,
      enterpriseDetails,
      customRequirements,
      status: 'pending'
    });
    const newQuotation = await quotation.save();
    res.status(201).json(newQuotation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a quotation
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Update all relevant fields if present in the request body
    if (req.body.serviceId) quotation.serviceId = req.body.serviceId;
    if (req.body.requestDetails) quotation.requestDetails = req.body.requestDetails;
    if (req.body.requestedPrice) quotation.requestedPrice = req.body.requestedPrice;
    if (req.body.enterpriseDetails) quotation.enterpriseDetails = req.body.enterpriseDetails;
    if (req.body.status) quotation.status = req.body.status;
    if (req.body.finalPrice) quotation.finalPrice = req.body.finalPrice;
    if (req.body.superadminNotes) quotation.superadminNotes = req.body.superadminNotes;
    if (req.body.proposedDeliveryDate) quotation.proposedDeliveryDate = req.body.proposedDeliveryDate;
    if (req.body.rejectionReason) quotation.rejectionReason = req.body.rejectionReason;
    if (req.body.completedDate) quotation.completedDate = req.body.completedDate;

    const updatedQuotation = await quotation.save();
    res.json(updatedQuotation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a quotation
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    await Quotation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Quotation deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Superadmin: Update quotation status and related fields
router.put('/superadmin/:id/status', authenticateToken, async (req, res) => {
  try {
    // You may want to add a role check here for superadmin
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden: Superadmin only' });
    }
    const { status, finalPrice, superadminNotes, proposedDeliveryDate, rejectionReason } = req.body;
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    if (status) quotation.status = status;
    if (finalPrice !== undefined) quotation.finalPrice = finalPrice;
    if (superadminNotes) quotation.superadminNotes = superadminNotes;
    if (proposedDeliveryDate) quotation.proposedDeliveryDate = proposedDeliveryDate;
    if (rejectionReason) quotation.rejectionReason = rejectionReason;
    if (status === 'approved') quotation.approvedDate = new Date();
    if (status === 'completed') quotation.completedDate = new Date();
    await quotation.save();
    res.json(quotation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 