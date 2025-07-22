const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoiceModel');
const User = require('../models/User');
const Service = require('../models/serviceModel');
const Quotation = require('../models/quotationModel');
const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../middleware/roleMiddleware');
const websocketService = require('../services/websocketService');

// Get all invoices - SuperAdmin only
router.get('/', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('adminId', 'email profile.fullName enterprise.companyName');
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get enterprise services with access
router.get('/enterprises/:enterpriseId/services', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    // Find the enterprise admin
    const admin = await User.findById(enterpriseId);
    if (!admin) {
      return res.status(404).json({ message: 'Enterprise not found' });
    }
    
    // Get services that the enterprise has access to
    const services = await Service.find({
      _id: { $in: admin.productAccess.map(access => access.productId) }
    });
    
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get enterprise approved quotations
router.get('/enterprises/:enterpriseId/quotations', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    
    // Find approved quotations for the enterprise
    const quotations = await Quotation.find({
      adminId: enterpriseId,
      status: 'approved'
    }).populate('serviceId', 'name description');
    
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get invoices for a specific admin or all admins in the user's enterprise
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'user' || req.user.role === 'admin') {
      const enterpriseId = req.user.enterprise?.enterpriseId;
      if (enterpriseId) {
        const admins = await User.find({ 'enterprise.enterpriseId': enterpriseId, role: 'admin' }, '_id');
        const adminIds = admins.map(a => a._id);
        query.adminId = { $in: adminIds };
      } else {
        // fallback: only show invoices for the user if no enterprise
        query.adminId = req.user.id;
      }
    }
    const invoices = await Invoice.find(query);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific invoice by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('adminId', 'email profile.fullName enterprise.companyName');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if user is authorized to view this invoice
    if (req.user.role !== 'superadmin' && invoice.adminId._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new invoice - Admin and SuperAdmin
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const {
      adminId,
      enterpriseDetails,
      items,
      dueDate,
      notes,
      billingPeriod
    } = req.body;

    // Validate enterprise exists
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Enterprise not found' });
    }

    // Validate items
    for (const item of items) {
      if (item.type === 'service') {
        const service = await Service.findById(item.itemId);
        if (!service) {
          return res.status(400).json({ message: `Service not found` });
        }
        // For superadmin, skip enterprise access check since they can create invoices for any service
        // The access check is only relevant for admin users creating their own invoices
      } else if (item.type === 'quotation') {
        const quotation = await Quotation.findById(item.itemId);
        if (!quotation) {
          return res.status(400).json({ message: `Quotation not found` });
        }
        if (quotation.status !== 'approved') {
          return res.status(400).json({ message: `Quotation ${item.name} is not approved` });
        }
        // Check if quotation belongs to the enterprise
        if (quotation.adminId.toString() !== adminId) {
          return res.status(403).json({ message: `Quotation ${item.name} does not belong to this enterprise` });
        }
        // Check if quotation is already used in another invoice
        const existingInvoice = await Invoice.findOne({
          'items.itemId': item.itemId,
          'items.type': 'quotation'
        });
        if (existingInvoice) {
          return res.status(400).json({ message: `Quotation ${item.name} is already used in another invoice` });
        }
      } else if (item.type === 'product') {
        const Product = require('../models/productModel');
        const product = await Product.findOne({
          $or: [
            { _id: item.itemId },
            { productId: item.itemId }
          ]
        });
        if (!product) {
          return res.status(400).json({ message: `Product not found` });
        }
        // For superadmin, skip enterprise access check since they can create invoices for any product
        // The access check is only relevant for admin users creating their own invoices
      }
    }

    // Calculate total amount from items
    const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${(invoiceCount + 1).toString().padStart(3, '0')}`;

    const newInvoice = new Invoice({
      invoiceNumber,
      adminId,
      enterpriseDetails,
      items,
      totalAmount,
      status: 'pending',
      issueDate: new Date(),
      dueDate,
      notes,
      billingPeriod
    });

    const savedInvoice = await newInvoice.save();

    // Notify the enterprise admin about the new invoice
    websocketService.notifyUser(adminId, 'invoice_created', savedInvoice);

    res.status(201).json(savedInvoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an invoice - SuperAdmin only
router.put('/:id', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      adminId,
      enterpriseDetails,
      items,
      dueDate,
      notes,
      billingPeriod
    } = req.body;

    // Validate enterprise exists
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Enterprise not found' });
    }

    // Validate items
    for (const item of items) {
      if (item.type === 'service') {
        const service = await Service.findById(item.itemId);
        if (!service) {
          return res.status(400).json({ message: `Service ${item.name} not found` });
        }
        // For superadmin, skip enterprise access check since they can create invoices for any service
        // The access check is only relevant for admin users creating their own invoices
      } else if (item.type === 'quotation') {
        const quotation = await Quotation.findById(item.itemId);
        if (!quotation) {
          return res.status(400).json({ message: `Quotation ${item.name} not found` });
        }
        if (quotation.status !== 'approved') {
          return res.status(400).json({ message: `Quotation ${item.name} is not approved` });
        }
        // Check if quotation belongs to the enterprise
        if (quotation.adminId.toString() !== adminId) {
          return res.status(403).json({ message: `Quotation ${item.name} does not belong to this enterprise` });
        }
        // Check if quotation is already used in another invoice (excluding current invoice)
        const existingInvoice = await Invoice.findOne({
          _id: { $ne: id },
          'items.itemId': item.itemId,
          'items.type': 'quotation'
        });
        if (existingInvoice) {
          return res.status(400).json({ message: `Quotation ${item.name} is already used in another invoice` });
        }
      } else if (item.type === 'product') {
        const Product = require('../models/productModel');
        const product = await Product.findOne({
          $or: [
            { _id: item.itemId },
            { productId: item.itemId }
          ]
        });
        if (!product) {
          return res.status(400).json({ message: `Product not found` });
        }
        // For superadmin, skip enterprise access check since they can create invoices for any product
        // The access check is only relevant for admin users creating their own invoices
      }
    }

    // Calculate total amount from items
    const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      {
        adminId,
        enterpriseDetails,
        items,
        totalAmount,
        dueDate,
        notes,
        billingPeriod
      },
      { new: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Notify the enterprise admin about the invoice update
    websocketService.notifyUser(adminId, 'invoice_updated', updatedInvoice);

    res.json(updatedInvoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete an invoice - SuperAdmin only
router.delete('/:id', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    // Notify the enterprise admin about the invoice deletion
    websocketService.notifyUser(invoice.adminId, 'invoice_deleted', { id: req.params.id });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update invoice status - Admin only
router.patch('/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if user is authorized to update this invoice
    if (invoice.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this invoice' });
    }

    // Only allow status updates to 'paid' or 'cancelled'
    if (!['paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === 'paid' && { paidDate: new Date() })
      },
      { new: true }
    );

    // Notify super admins about the status update
    websocketService.notifySuperAdmins('invoice_status_updated', updatedInvoice);

    res.json(updatedInvoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 