const Customer = require('../models/customer');
const Activity = require('../models/activity');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Helper to get CRM permissions from productAccess
function getCrmPermissions(user) {
  const crmAccess = (user.productAccess || []).find(pa => pa.productId === 'crm' && pa.hasAccess);
  return crmAccess?.permissions || {};
}

// Get all customers (filtered by user role and assigned admin)
const getAllCustomers = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      // Admins see all leads assigned to any user in their enterprise
      const User = require('../models/User');
      const enterpriseId = req.user.enterprise?.enterpriseId;
      let userIds = [req.user.id];
      if (enterpriseId) {
        const users = await User.find({ 'enterprise.enterpriseId': enterpriseId }, '_id');
        userIds = users.map(u => u._id.toString());
      }
      query.assignedTo = { $in: userIds };
    } else if (req.user.role === 'user') {
      // Check CRM view permission
      const crmPerms = getCrmPermissions(req.user);
      if (!crmPerms.view) {
        return res.status(403).json({ message: 'You do not have permission to view leads.' });
      }
      // Users see:
      // - leads assigned to their enterprise admins
      // - leads assigned to themselves
      // - leads they created themselves
      const enterpriseId = req.user.enterprise?.enterpriseId;
      if (enterpriseId) {
        const User = require('../models/User');
        const admins = await User.find({ 'enterprise.enterpriseId': enterpriseId, role: 'admin' }, '_id');
        const adminIds = admins.map(a => a._id);
        query.$or = [
          { assignedTo: { $in: adminIds } },
          { assignedTo: req.user.id },
          { createdBy: req.user.id }
        ];
      } else {
        // If no enterprise, just show leads assigned to or created by the user
        query.$or = [
          { assignedTo: req.user.id },
          { createdBy: req.user.id }
        ];
      }
    }
    const customers = await Customer.find(query)
      .populate('assignedTo', 'email profile.fullName')
      .sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch customers',
      error: error.message 
    });
  }
};

// Get single customer by ID (with permission check)
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('assignedTo', 'email profile.fullName');
      
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    // Users can only view if in their enterprise and have view permission
    if (req.user.role === 'user') {
      const crmPerms = getCrmPermissions(req.user);
      if (!crmPerms.view) {
        return res.status(403).json({ message: 'You do not have permission to view leads.' });
      }
      const enterpriseId = req.user.enterprise?.enterpriseId;
      if (enterpriseId && customer.assignedTo) {
        const User = require('../models/User');
        const admin = await User.findById(customer.assignedTo);
        if (!admin || admin.enterprise?.enterpriseId !== enterpriseId) {
          return res.status(403).json({ message: 'You do not have access to this customer' });
        }
      }
    }
    // Admins can only view their own
    if (req.user.role === 'admin' && customer.assignedTo && 
        customer.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this customer' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch customer',
      error: error.message 
    });
  }
};

// Create new customer
const createCustomer = async (req, res) => {
  try {
    // Only allow users to add leads if permission is set
    if (req.user.role === 'user') {
      const crmPerms = getCrmPermissions(req.user);
      if (!crmPerms.createLead) {
        return res.status(403).json({ message: 'You are not allowed to add leads. Please contact your enterprise admin.' });
      }
    }
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      address,
      status,
      source,
      notes,
      assignedTo,
    } = req.body;
    
    // Check if customer with same email already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer with this email already exists' });
    }
    
    // Build customer object
    const customerData = {
      firstName,
      lastName,
      email,
      phone,
      company,
      address,
      status: status || 'new',
      source: source || 'direct',
      notes,
      assignedTo: assignedTo || req.user.id,
      createdBy: req.user.id,
      lastActivity: new Date()
    };
    
    // Create customer in database
    const customer = await Customer.create(customerData);
    
    // Create activity log
    await Activity.create({
      type: 'customer_created',
      subject: 'Customer Created',
      customerId: customer._id,
      createdBy: req.user.id,
      assignedTo: assignedTo || req.user.id,
      description: `Created customer ${firstName} ${lastName}`
    });
    
    res.status(201).json({ 
      success: true,
      message: 'Customer created successfully',
      customer 
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to create customer',
      error: error.message 
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find the customer first to check permissions
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Users can only edit if assigned to them and have editLead permission
    if (req.user.role === 'user') {
      const crmPerms = getCrmPermissions(req.user);
      if (!crmPerms.editLead) {
        return res.status(403).json({ message: 'You do not have permission to edit leads.' });
      }
      if (customer.assignedTo && customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to update this customer' });
      }
    }
    // Admins can only edit their own
    if (req.user.role === 'admin' && customer.assignedTo && customer.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to update this customer' });
    }
    
    // Update the last activity timestamp
    updateData.lastActivity = new Date();
    
    // Update the customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id, 
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'email profile.fullName');
    
    // Create activity log
    await Activity.create({
      type: 'other',
      customerId: customer._id,
      subject: `Customer updated: ${customer.firstName} ${customer.lastName}`,
      description: `Updated customer ${customer.firstName} ${customer.lastName}`,
      createdBy: req.user.id,
      assignedTo: customer.assignedTo || req.user.id
    });
    
    res.json({ 
      success: true,
      message: 'Customer updated successfully',
      customer: updatedCustomer 
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to update customer',
      error: error.message 
    });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the customer first to check permissions
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Users can only delete if assigned to them and have deleteLead permission
    if (req.user.role === 'user') {
      const crmPerms = getCrmPermissions(req.user);
      if (!crmPerms.deleteLead) {
        return res.status(403).json({ message: 'You do not have permission to delete leads.' });
      }
      if (customer.assignedTo && customer.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to delete this customer' });
      }
    }
    // Admins can only delete their own
    if (req.user.role === 'admin' && customer.assignedTo && customer.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to delete this customer' });
    }
    
    // Delete the customer
    await Customer.findByIdAndDelete(id);
    
    // Create activity log
    await Activity.create({
      type: 'other',
      customerId: customer._id,
      subject: `Customer deleted: ${customer.firstName} ${customer.lastName}`,
      description: `Deleted customer ${customer.firstName} ${customer.lastName}`,
      createdBy: req.user.id,
      assignedTo: customer.assignedTo || req.user.id
    });
    
    res.json({ 
      success: true,
      message: 'Customer deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete customer',
      error: error.message 
    });
  }
};

// Get customer statistics
const getCustomerStats = async (req, res) => {
  try {
    let matchStage = {};
    
    // If admin, only include their assigned customers
    if (req.user.role === 'admin') {
      matchStage.assignedTo = new ObjectId(req.user.id);
    }
    
    const stats = await Customer.aggregate([
      { $match: matchStage },
      {
        $facet: {
          // Count by status
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { '_id': 1 } }
          ],
          // Count by source
          sourceCounts: [
            { $group: { _id: '$source', count: { $sum: 1 } } },
            { $sort: { '_id': 1 } }
          ],
          // Count by creation month/year
          timeline: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
          ],
          // Total customer count
          totalCount: [
            { $count: 'total' }
          ],
          // Count deals
          totalDeals: [
            { $match: { 'deals': { $exists: true, $not: { $size: 0 } } } },
            { $count: 'total' }
          ],
          // Sum deal values
          totalValue: [
            { $unwind: { path: '$deals', preserveNullAndEmptyArrays: false } },
            { $group: { _id: null, total: { $sum: '$deals.value' } } }
          ]
        }
      }
    ]);
    
    // Format the results
    const result = {
      totalCustomers: stats[0].totalCount[0]?.total || 0,
      totalDeals: stats[0].totalDeals[0]?.total || 0,
      totalValue: stats[0].totalValue[0]?.total || 0,
      byStatus: stats[0].statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      bySource: stats[0].sourceCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      timeline: stats[0].timeline.map(item => ({
        year: item._id.year,
        month: item._id.month,
        count: item.count
      }))
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching customer statistics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch customer statistics',
      error: error.message 
    });
  }
};

// Get recent customer activity
const getRecentActivity = async (req, res) => {
  try {
    let query = { 'entity.type': 'customer' };
    
    // If admin, only include activities related to their customers
    if (req.user.role === 'admin') {
      // First get IDs of customers assigned to this admin
      const customers = await Customer.find({ assignedTo: req.user.id }).select('_id');
      const customerIds = customers.map(c => c._id.toString());
      
      // Add customer filter to query
      query['entity.id'] = { $in: customerIds };
    }
    
    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .limit(20);
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching customer activity:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch customer activity',
      error: error.message 
    });
  }
};

// Add a deal to a customer
const addDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, value, status, expectedCloseDate, description } = req.body;
    
    // Find the customer first to check permissions
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if admin has access to update this customer
    if (req.user.role === 'admin' && 
        customer.assignedTo && 
        customer.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to add deals to this customer' });
    }
    
    // Create the new deal
    const newDeal = {
      title,
      value: parseFloat(value) || 0,
      status: status || 'new',
      expectedCloseDate,
      description,
      createdAt: new Date(),
      createdBy: req.user.id
    };
    
    // Add the deal to the customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { 
        $push: { deals: newDeal },
        $set: { lastActivity: new Date() }
      },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'email profile.fullName');
    
    // Create activity log
    await Activity.create({
      type: 'deal_added',
      user: {
        id: req.user.id,
        name: req.user.email
      },
      description: `Added new deal "${title}" to ${customer.firstName} ${customer.lastName}`,
      details: JSON.stringify(newDeal),
      entity: {
        type: 'customer',
        id: customer._id
      },
      timestamp: new Date()
    });
    
    res.json({ 
      success: true,
      message: 'Deal added successfully',
      customer: updatedCustomer 
    });
  } catch (error) {
    console.error('Error adding deal:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to add deal',
      error: error.message 
    });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
  getRecentActivity,
  addDeal
}; 