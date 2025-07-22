const Service = require('../models/serviceModel');
const Quotation = require('../models/quotationModel');
const User = require('../models/User');
const mongoose = require('mongoose');
const notificationController = require('./notificationController');

// Get all services (for both SuperAdmin and Admins)
exports.getAllServices = async (req, res) => {
  try {
    let query = {};
    
    // For non-superadmin users, only show active services
    if (req.user.role !== 'superadmin') {
      query.active = true;
    }
    
    // Category filter
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    // If user or admin, filter by enterprise
    if (req.user.role === 'user' || req.user.role === 'admin') {
      const enterpriseId = req.user.enterprise?.enterpriseId;
      if (enterpriseId) {
        // Find all admins in the same enterprise
        const admins = await User.find({ 'enterprise.enterpriseId': enterpriseId, role: 'admin' }, '_id');
        const adminIds = admins.map(a => a._id);
        query.createdBy = { $in: adminIds };
      }
    }
    
    let services = [];
    
    services = await Service.find(query).sort({ createdAt: -1 }).populate('createdBy', 'role email enterprise');
    
    res.status(200).json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Failed to fetch services', error: error.message });
  }
};

// Get a single service by ID
exports.getServiceById = async (req, res) => {
  try {
    let service;
    
    service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Check if service is inactive and user is not superadmin
    if (!service.active && req.user.role !== 'superadmin') {
      return res.status(404).json({ message: 'Service not found or inactive' });
    }
    
    res.status(200).json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ message: 'Failed to fetch service', error: error.message });
  }
};

// Create a new service (SuperAdmin only)
exports.createService = async (req, res) => {
  try {
    const { name, description, price, category, icon, features, duration, active } = req.body;
    
    // Validate required fields
    if (!name || !description || price === undefined) {
      return res.status(400).json({ message: 'Name, description, and price are required' });
    }
    
    // Create service data object
    const serviceData = {
      name,
      description,
      price: parseFloat(price),
      category: category || 'General',
      icon: icon || '🔧',
      features: features || [],
      duration: duration || { unit: 'one-time' },
      active: active !== undefined ? active : true,
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    let savedService;
    
    // Create service with current user as creator
    const newService = new Service(serviceData);
    savedService = await newService.save();
    
    res.status(201).json({
      message: 'Service created successfully',
      service: savedService
    });
  } catch (error) {
    console.error('Service creation error:', error);
    res.status(500).json({ message: 'Failed to create service', error: error.message });
  }
};

// Update a service (SuperAdmin only)
exports.updateService = async (req, res) => {
  try {
    const { name, description, price, category, icon, features, duration, active } = req.body;
    
    let service;
    let updatedService;
    
    // Validate service existence
    service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Update service
    updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      {
        name: name || service.name,
        description: description || service.description,
        price: price !== undefined ? parseFloat(price) : service.price,
        category: category || service.category,
        icon: icon || service.icon,
        features: features || service.features,
        duration: duration || service.duration,
        active: active !== undefined ? active : service.active,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      message: 'Service updated successfully',
      service: updatedService
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ message: 'Failed to update service', error: error.message });
  }
};

// Delete a service (SuperAdmin only)
exports.deleteService = async (req, res) => {
  try {
    let service;
    let quotationCount = 0;
    
    service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Check if there are quotations for this service
    quotationCount = await Quotation.countDocuments({ serviceId: req.params.id });
    
    if (quotationCount > 0) {
      // If service has quotations, just mark it as inactive instead of deleting
      const updatedService = await Service.findByIdAndUpdate(
        req.params.id,
        { active: false, updatedAt: new Date() },
        { new: true }
      );
      
      return res.status(200).json({
        message: 'Service has existing quotations. Marked as inactive instead of deleting.',
        service: updatedService,
        quotationCount
      });
    }
    
    // No quotations, safe to delete
    await Service.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Failed to delete service', error: error.message });
  }
};

// Get quotation requests for a specific Admin
exports.getAdminQuotations = async (req, res) => {
  try {
    let quotations = [];

    // Get the current admin's enterpriseId
    const currentAdmin = await User.findById(req.user.id);
    if (!currentAdmin || !currentAdmin.enterprise || !currentAdmin.enterprise.enterpriseId) {
      return res.status(403).json({ message: 'Enterprise information not found for this admin.' });
    }
    const enterpriseId = currentAdmin.enterprise.enterpriseId;

    // Find all admins with the same enterpriseId
    const adminsInEnterprise = await User.find({
      role: 'admin',
      'enterprise.enterpriseId': enterpriseId
    }).select('_id');
    const adminIds = adminsInEnterprise.map(a => a._id);

    // Build query for all admins in this enterprise
    let query = { adminId: { $in: adminIds } };

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Get quotations from database with populated references
    quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .populate('serviceId', 'name price category');

    res.status(200).json(quotations);
  } catch (error) {
    console.error('Error fetching admin quotations:', error);
    res.status(500).json({ message: 'Failed to fetch quotations', error: error.message });
  }
};

// Request quotation for a service (Admin only)
exports.requestQuotation = async (req, res) => {
  try {
    const { requestDetails, customRequirements, requestedPrice, enterpriseDetails } = req.body;
    const serviceId = req.params.serviceId;
    
    let service;
    let savedQuotation;
    
    // Validate service existence
    service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Validate required fields
    if (!requestDetails) {
      return res.status(400).json({ message: 'Request details are required' });
    }
    
    // Create new quotation request
    const newQuotation = new Quotation({
      serviceId,
      adminId: req.user.id,
      requestDetails,
      customRequirements,
      requestedPrice: requestedPrice ? parseFloat(requestedPrice) : undefined,
      enterpriseDetails: enterpriseDetails || {
        companyName: req.user.enterprise?.companyName || '',
        contactPerson: req.user.profile?.fullName || '',
        email: req.user.email || '',
        phone: req.user.profile?.phone || ''
      },
      status: 'pending'
    });
    
    savedQuotation = await newQuotation.save();
    return res.status(201).json(savedQuotation);
  } catch (error) {
    console.error('Error requesting quotation:', error);
    res.status(500).json({ message: 'Failed to request quotation', error: error.message });
  }
};

// Get all quotation requests (SuperAdmin)
exports.getAllQuotations = async (req, res) => {
  try {
    let quotations = [];
    
    // Build query
    let query = {};
    
    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Get quotations from database with populated references
    quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .populate('serviceId', 'name price category')
      .populate('adminId', 'email profile');
    
    res.status(200).json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ message: 'Failed to fetch quotations', error: error.message });
  }
};

// Update quotation status (SuperAdmin only)
exports.updateQuotationStatus = async (req, res) => {
  try {
    console.log('=== UPDATE QUOTATION STATUS START ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const { status, finalPrice, superadminNotes, proposedDeliveryDate, rejectionReason } = req.body;
    const quotationId = req.params.id;
    
    // Validate quotation ID
    if (!quotationId) {
      console.log('ERROR: No quotation ID provided');
      return res.status(400).json({ message: 'Quotation ID is required' });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
      console.log('ERROR: Invalid quotation ID format:', quotationId);
      return res.status(400).json({ message: 'Invalid quotation ID format' });
    }
    
    console.log('Looking for quotation with ID:', quotationId);
    
    let quotation;
    
    // Find quotation in real DB
    try {
      quotation = await Quotation.findById(quotationId);
      console.log('Database query result:', quotation);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({ 
        message: 'Database error while finding quotation', 
        error: dbError.message 
      });
    }
    
    if (!quotation) {
      console.log('ERROR: Quotation not found in database');
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    console.log('Found quotation in database:', {
      _id: quotation._id,
      status: quotation.status,
      serviceId: quotation.serviceId,
      adminId: quotation.adminId
    });
    
    // Validate status transitions
    if (quotation.status === 'completed') {
      console.log('ERROR: Cannot modify completed quotation');
      return res.status(400).json({ message: 'Completed quotations cannot be modified' });
    }
    
    // Validate required fields based on status
    if (status === 'approved') {
      if (!finalPrice || finalPrice <= 0) {
        console.log('ERROR: Final price required for approval');
        return res.status(400).json({ 
          message: 'Final price is required and must be greater than 0 when approving a quotation' 
        });
      }
    }
    
    if (status === 'rejected') {
      if (!rejectionReason || rejectionReason.trim() === '') {
        console.log('ERROR: Rejection reason required');
        return res.status(400).json({ 
          message: 'Rejection reason is required when rejecting a quotation' 
        });
      }
    }
    
    // Prepare update data
    const updateData = {
      status: status || quotation.status,
      updatedAt: new Date()
    };
    
    // Handle finalPrice
    if (finalPrice !== undefined && finalPrice !== null && finalPrice !== '') {
      const parsedPrice = parseFloat(finalPrice);
      if (!isNaN(parsedPrice) && parsedPrice >= 0) {
        updateData.finalPrice = parsedPrice;
      }
    }
    
    // Handle other fields
    if (superadminNotes !== undefined) {
      updateData.superadminNotes = superadminNotes || '';
    }
    
    if (proposedDeliveryDate) {
      updateData.proposedDeliveryDate = new Date(proposedDeliveryDate);
    }
    
    if (rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    // Add status-specific fields
    if (status === 'approved') {
      updateData.approvedDate = new Date();
      if (!updateData.proposedDeliveryDate) {
        updateData.proposedDeliveryDate = new Date();
      }
    }
    
    if (status === 'rejected') {
      // rejectionReason already handled above
    }
    
    if (status === 'completed') {
      updateData.completedDate = new Date();
    }
    
    console.log('Update data prepared:', updateData);
    
    let updatedQuotation;
    
    // Update quotation
    try {
      updatedQuotation = await Quotation.findByIdAndUpdate(
        quotationId,
        updateData,
        { new: true, runValidators: true }
      ).populate('serviceId').populate('adminId', 'email profile');
      
      console.log('Database update result:', updatedQuotation);
    } catch (updateError) {
      console.error('Database update error:', updateError);
      return res.status(500).json({ 
        message: 'Database error while updating quotation', 
        error: updateError.message 
      });
    }
    
    if (!updatedQuotation) {
      console.log('ERROR: Failed to update quotation');
      return res.status(500).json({ message: 'Failed to update quotation' });
    }
    
    console.log('Quotation updated successfully:', updatedQuotation._id);
    
    // Create notification (optional - don't fail if this fails)
    try {
      if (quotation.adminId) {
        console.log('Creating notification for admin:', quotation.adminId);
        
        let serviceName = 'your requested service';
        const service = await Service.findById(quotation.serviceId);
        serviceName = service?.name || serviceName;
        
        let message = '';
        let notificationType = 'info';
        
        switch (status) {
          case 'approved':
            message = `Your quotation for ${serviceName} has been approved with a final price of $${finalPrice}`;
            notificationType = 'success';
            break;
          case 'rejected':
            message = `Your quotation for ${serviceName} has been rejected. Reason: ${rejectionReason}`;
            notificationType = 'error';
            break;
          case 'completed':
            message = `Your quotation for ${serviceName} has been marked as completed`;
            notificationType = 'success';
            break;
          default:
            message = `Your quotation for ${serviceName} has been updated to ${status}`;
        }
        
        await notificationController.createNotification({
          userId: quotation.adminId,
          message,
          title: `Quotation ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          type: notificationType,
          relatedTo: {
            model: 'Quotation',
            id: quotation._id
          },
          link: `/admin/services?tab=quotations`
        });
        
        console.log('Notification created successfully');
      }
    } catch (notificationError) {
      console.error('Error creating notification (non-fatal):', notificationError);
      // Don't fail the main operation if notification creation fails
    }
    
    console.log('=== UPDATE QUOTATION STATUS SUCCESS ===');
    
    res.status(200).json({
      message: 'Quotation updated successfully',
      quotation: updatedQuotation
    });
    
  } catch (error) {
    console.error('=== UPDATE QUOTATION STATUS ERROR ===');
    console.error('Error details:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Provide specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: Object.values(error.errors).map(err => err.message) 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid data format', 
        details: error.message 
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(500).json({ 
        message: 'Database error', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to update quotation', 
      error: error.message 
    });
  }
};

// Get service statistics
exports.getServiceStats = async (req, res) => {
  try {
    let stats = {};
    
    // Get services count
    const totalServices = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ active: true });
    
    // Get quotations count
    const totalQuotations = await Quotation.countDocuments();
    const pendingQuotations = await Quotation.countDocuments({ status: 'pending' });
    const approvedQuotations = await Quotation.countDocuments({ status: 'approved' });
    const rejectedQuotations = await Quotation.countDocuments({ status: 'rejected' });
    const completedQuotations = await Quotation.countDocuments({ status: 'completed' });
    
    // Get services by category
    const servicesByCategory = await Service.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Format the category data
    const categoryData = {};
    servicesByCategory.forEach(item => {
      categoryData[item._id || 'Uncategorized'] = item.count;
    });
    
    // Compile statistics
    stats = {
      totalServices,
      activeServices,
      totalQuotations,
      quotationsByStatus: {
        pending: pendingQuotations,
        approved: approvedQuotations,
        rejected: rejectedQuotations,
        completed: completedQuotations
      },
      servicesByCategory: categoryData
    };
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching service statistics:', error);
    
    // Return default stats structure on error
    res.status(200).json({
      totalServices: 0,
      activeServices: 0,
      totalQuotations: 0,
      quotationsByStatus: {
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0
      },
      servicesByCategory: {}
    });
  }
};

// Test endpoint to check quotation existence
exports.testQuotation = async (req, res) => {
  try {
    const quotationId = req.params.id;
    console.log('Testing quotation with ID:', quotationId);
    
    const quotation = await Quotation.findById(quotationId);
    console.log('Real DB test result:', quotation);
    
    if (quotation) {
      res.status(200).json({
        message: 'Quotation found in real DB',
        quotation: quotation
      });
    } else {
      const allQuotations = await Quotation.find({}).select('_id status');
      res.status(404).json({
        message: 'Quotation not found in real DB',
        availableQuotations: allQuotations
      });
    }
  } catch (error) {
    console.error('Test quotation error:', error);
    res.status(500).json({
      message: 'Error testing quotation',
      error: error.message
    });
  }
}; 