const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Ticket = require('../models/Ticket');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');
const websocketService = require('../services/websocketService');
const User = require('../models/User');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/tickets/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    files: 5 // Maximum 5 files per ticket
  }
});

// Create a new ticket (Both admin and regular users)
router.post('/', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    // Defensive: Always use the authenticated user's role
    if (!req.user || !req.user.id) {
      console.error('No authenticated user found in ticket creation');
      return res.status(401).json({ message: 'Authentication required to create a ticket.' });
    }
    // Log user info for debugging
    console.log('Creating ticket for user ID:', req.user.id, 'role:', req.user.role);

    // Log the incoming request
    console.log('Received ticket creation request:', {
      body: req.body,
      files: req.files ? req.files.length : 0,
      user: req.user ? { id: req.user.id, role: req.user.role } : null
    });

    // Validate required fields
    const requiredFields = ['name', 'email', 'subject', 'department', 'relatedTo', 'message'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Process file attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      path: file.path,
      mimetype: file.mimetype
    })) : [];

    // Get user's enterprise information
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(400).json({ message: 'User not found' });
    }

    // For regular users, find their enterprise admin
    // For admins, they can specify a different adminId if needed
    let adminId;
    let enterpriseId;
    
    if (req.user.role === 'user') {
      // Check if user has enterprise information
      if (!currentUser.enterprise || !currentUser.enterprise.enterpriseId) {
        // Try to find enterprise admin by createdBy field
        if (currentUser.createdBy) {
          const creator = await User.findById(currentUser.createdBy);
          if (creator && creator.enterprise && creator.enterprise.enterpriseId) {
            enterpriseId = creator.enterprise.enterpriseId;
            // Find the enterprise admin for this enterprise
            const enterpriseAdmin = await User.findOne({
              role: 'admin',
              'enterprise.enterpriseId': enterpriseId
            });
            
            if (enterpriseAdmin) {
              adminId = enterpriseAdmin._id;
            } else {
              return res.status(400).json({ message: 'No enterprise admin found for this user. Please contact your administrator.' });
            }
          } else {
            return res.status(400).json({ message: 'User enterprise information not found. Please contact your administrator to set up your account properly.' });
          }
        } else {
          return res.status(400).json({ message: 'User enterprise information not found. Please contact your administrator to set up your account properly.' });
        }
      } else {
        enterpriseId = currentUser.enterprise.enterpriseId;
        // Find the enterprise admin for this user
        const enterpriseAdmin = await User.findOne({
          role: 'admin',
          'enterprise.enterpriseId': enterpriseId
        });
        
        if (!enterpriseAdmin) {
          return res.status(400).json({ message: 'No enterprise admin found for this user. Please contact your administrator.' });
        }
        
        adminId = enterpriseAdmin._id;
      }
    } else {
      // For admins, use their own ID or specified adminId
      adminId = req.body.adminId || req.user.id;
      enterpriseId = currentUser.enterprise?.enterpriseId || '';
    }

    // Defensive: Ignore any isAdminTicket/forwardedToSuperAdmin from frontend
    let ticketData = {
      name: req.body.name,
      email: req.body.email,
      subject: req.body.subject,
      department: req.body.department,
      relatedTo: req.body.relatedTo,
      message: req.body.message,
      attachments: attachments,
      submittedBy: req.user.id,
      status: 'Open',
      priority: req.body.priority || 'Medium',
      category: req.body.category || 'Other',
      enterpriseId: enterpriseId
    };

    // Defensive: Always set ticket type based on authenticated user's role
    // Extra: Only allow admin tickets if explicitly requested (e.g., from admin dashboard)
    let isAdminTicket = false;
    let forwardedToSuperAdmin = false;
    let adminIdToSet = adminId;

    // Check for explicit admin ticket creation (e.g., from admin dashboard)
    // You can use a custom header or a field in the request body, e.g., req.body.forceAdminTicket
    const forceAdminTicket = req.body.forceAdminTicket === true || req.headers['x-force-admin-ticket'] === 'true';
    console.log('Ticket creation source:', {
      userId: req.user.id,
      role: req.user.role,
      forceAdminTicket,
      path: req.originalUrl
    });

    if (req.user.role === 'admin' && forceAdminTicket) {
      isAdminTicket = true;
      forwardedToSuperAdmin = true;
      adminIdToSet = null;
    } else {
      isAdminTicket = false;
      forwardedToSuperAdmin = false;
      // For user or admin acting as user, assign to adminId
    }

    ticketData.isAdminTicket = isAdminTicket;
    ticketData.forwardedToSuperAdmin = forwardedToSuperAdmin;
    ticketData.adminId = adminIdToSet;

    const ticket = new Ticket(ticketData);

    // Save ticket
    const savedTicket = await ticket.save();
    console.log('Ticket saved successfully:', savedTicket._id, 'submittedBy:', savedTicket.submittedBy);
    
    // Populate user details
    await savedTicket.populate([
      { path: 'adminId', select: 'email profile.fullName' },
      { path: 'submittedBy', select: 'email profile.fullName' }
    ]);

    // Emit WebSocket event for new ticket
    websocketService.notifyEnterpriseAdmins('ticket_created', savedTicket);
    websocketService.notifyUser(savedTicket.submittedBy._id, 'ticket_created_by_user', savedTicket);
    
    console.log('Ticket populated with user details');
    res.status(201).json(savedTicket);
  } catch (error) {
    console.error('Error creating ticket:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      console.log('Validation error details:', error.errors);
      return res.status(400).json({
        message: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    
    if (error.name === 'MongoError' && error.code === 11000) {
      console.log('Duplicate ticket number error');
      return res.status(400).json({
        message: 'Duplicate ticket number. Please try again.'
      });
    }

    res.status(500).json({
      message: 'Error creating ticket',
      error: error.message
    });
  }
});

// Get all tickets (Superadmin only) - Only forwarded tickets
router.get('/', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    console.log('GET /api/tickets called by user:', req.user);
    const tickets = await Ticket.find({ forwardedToSuperAdmin: true })
      .populate('adminId', 'email profile.fullName enterprise.companyName')
      .populate('submittedBy', 'email profile.fullName enterprise.companyName')
      .populate('forwardedBy', 'email profile.fullName enterprise.companyName')
      .sort({ createdAt: -1 });
    console.log('Forwarded tickets found:', tickets.length);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tickets for enterprise admin (tickets assigned to them)
router.get('/admin', authenticateToken, authorizeRole('admin', 'superadmin'), async (req, res) => {
  try {
    console.log('GET /api/tickets/admin called by user:', req.user);
    
    if (req.user.role === 'superadmin') {
      // Super admin can see all tickets
      const tickets = await Ticket.find()
        .populate('submittedBy', 'email profile.fullName enterprise.companyName')
        .populate('adminId', 'email profile.fullName enterprise.companyName')
        .sort({ createdAt: -1 });
      return res.json(tickets);
    }
    
    // Get the current admin's enterpriseId
    const currentAdmin = await User.findById(req.user.id);
    if (!currentAdmin || !currentAdmin.enterprise || !currentAdmin.enterprise.enterpriseId) {
      return res.status(403).json({ message: 'Enterprise information not found for this admin.' });
    }
    const enterpriseId = currentAdmin.enterprise.enterpriseId;

    // Find tickets assigned to this admin or other admins in the same enterprise
    const tickets = await Ticket.find({ 
      $or: [
        { adminId: req.user.id },
        { enterpriseId: enterpriseId }
      ]
    })
      .populate('submittedBy', 'email profile.fullName enterprise.companyName')
      .populate('adminId', 'email profile.fullName enterprise.companyName')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching admin tickets:', {
      user: req.user,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: error.message });
  }
});

// Get tickets for regular users (tickets they submitted)
router.get('/user', authenticateToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error('No authenticated user found in ticket fetch');
      return res.status(401).json({ message: 'Authentication required to fetch tickets.' });
    }
    console.log('GET /api/tickets/user called by user:', req.user.id);
    const tickets = await Ticket.find({ submittedBy: req.user.id, isAdminTicket: false })
      .populate('adminId', 'email profile.fullName enterprise.companyName')
      .populate('submittedBy', 'email profile.fullName enterprise.companyName')
      .sort({ createdAt: -1 });
    console.log('Tickets found for user:', req.user.id, 'Count:', tickets.length);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching user tickets:', {
      user: req.user,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: error.message });
  }
});

// Update a ticket by ID (Superadmin and Admin can update)
router.put('/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message, role } = req.body;
    const userRoleFromToken = req.user.role;

    console.log('Updating ticket: Request received', { 
      ticketId: id, 
      statusFromReq: status, 
      messageFromReq: message, 
      roleFromReqBody: role, 
      userRoleFromAuthToken: userRoleFromToken,
      authenticatedUserId: req.user.id,
      fullRequestBody: req.body,
      fullUserObject: req.user
    });

    if (!id) {
      return res.status(400).json({ message: 'Ticket ID is required' });
    }

    // Validate message if provided
    if (message && typeof message !== 'string') {
      return res.status(400).json({ message: 'Message must be a string' });
    }

    // Validate status if provided
    if (status && !['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const ticket = await Ticket.findById(id);
    console.log('Found ticket:', ticket ? ticket._id : 'not found');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Permission check for admin
    if (req.user.role === 'admin') {
      if (ticket.isAdminTicket || String(ticket.adminId) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Admins can only update tickets assigned to them from users.' });
      }
    }

    // Update status if provided
    if (status) {
      ticket.status = status;
    }

    // Add response if message is provided
    if (message && message.trim() !== '') {
      try {
        // Ensure all existing responses have a role field
        if (ticket.responses && ticket.responses.length > 0) {
          ticket.responses = ticket.responses.map(response => ({
            ...response.toObject(),
            role: response.role || userRoleFromToken
          }));
        }

        const newResponse = {
          message: message.trim(),
          role: role,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        console.log('Adding new response object:', newResponse);
        
        // Initialize responses array if it doesn't exist
        if (!ticket.responses) {
          ticket.responses = [];
        }
        
        ticket.responses.push(newResponse);
        console.log('Response added to ticket');

        // Create notification for the ticket submitter
        try {
          if (!ticket.submittedBy) {
            console.error('Ticket has no submittedBy field:', ticket);
            throw new Error('Ticket has no submittedBy field');
          }

          const notificationData = {
            userId: ticket.submittedBy,
            message: `New response added to your ticket: ${ticket.subject}`,
            type: 'info',
            title: 'Ticket Response',
            relatedTo: {
              model: 'Ticket',
              id: ticket._id
            }
          };
          
          console.log('Creating notification with data:', notificationData);
          await notificationController.createNotification(notificationData);
          console.log('Notification created successfully');
        } catch (notifyErr) {
          console.error('Failed to create notification for ticket response:', {
            error: notifyErr.message,
            stack: notifyErr.stack,
            ticket: ticket._id
          });
          // Don't fail the request if notification fails
        }
      } catch (responseErr) {
        console.error('Error adding response:', {
          error: responseErr.message,
          stack: responseErr.stack,
          ticket: ticket._id
        });
        return res.status(400).json({ 
          message: 'Error adding response',
          error: responseErr.message 
        });
      }
    }

    try {
      console.log('Saving ticket with responses:', {
        ticketId: ticket._id,
        responseCount: ticket.responses.length
      });
      
      const updatedTicket = await ticket.save();
      console.log('Ticket saved successfully:', updatedTicket._id);

      // Populate updated ticket to return full details
      await updatedTicket.populate([
        { path: 'adminId', select: 'email profile.fullName' },
        { path: 'submittedBy', select: 'email profile.fullName enterprise.companyName' }
      ]);
      console.log('Ticket populated successfully');

      // Emit WebSocket event for updated ticket
      try {
        websocketService.notifyEnterpriseAdmins('ticket_updated', updatedTicket);
        if (updatedTicket.submittedBy && updatedTicket.submittedBy._id) {
          websocketService.notifyUser(updatedTicket.submittedBy._id, 'ticket_updated_for_user', updatedTicket);
        }
        console.log('WebSocket notifications sent');
      } catch (wsError) {
        console.error('WebSocket notification error:', {
          error: wsError.message,
          stack: wsError.stack
        });
        // Don't fail the request if WebSocket notification fails
      }

      res.json(updatedTicket);
    } catch (saveErr) {
      console.error('Error saving ticket:', {
        error: saveErr.message,
        stack: saveErr.stack,
        ticket: ticket._id
      });
      return res.status(500).json({ 
        message: 'Error saving ticket',
        error: saveErr.message 
      });
    }
  } catch (error) {
    console.error('Error updating ticket:', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      user: req.user
    });
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Update only the status of a ticket (Admin and Superadmin)
router.put('/:id/status', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) {
      return res.status(400).json({ message: 'Ticket ID is required' });
    }
    if (!status || !['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing status value' });
    }
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    // Only allow admin to update tickets assigned to them
    if (req.user.role === 'admin') {
      if (ticket.isAdminTicket || String(ticket.adminId) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Admins can only update tickets assigned to them from users.' });
      }
    }
    ticket.status = status;
    await ticket.save();
    res.json({ status: ticket.status });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ message: 'Error updating ticket status', error: error.message });
  }
});

// Add response to ticket (Superadmin only)
router.post('/:ticketId/responses', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.responses.push({
      message: req.body.message
    });

    await ticket.save();

    // Create notification for the admin who created the ticket
    try {
      await notificationController.createNotification({
        userId: ticket.adminId,
        message: `Superadmin responded to your ticket: ${ticket.subject}`,
        type: 'info',
        title: 'Ticket Response',
        relatedTo: { model: 'Ticket', id: ticket._id }
      });
    } catch (notifyErr) {
      console.error('Failed to create notification for ticket response:', notifyErr);
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update response (Superadmin only)
router.put('/:ticketId/responses/:responseId', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const response = ticket.responses.id(req.params.responseId);
    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }

    response.message = req.body.message;
    response.updatedAt = Date.now();

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Error updating response:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete response (Superadmin only)
router.delete('/:ticketId/responses/:responseId', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.responses.pull(req.params.responseId);
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Error deleting response:', error);
    res.status(400).json({ message: error.message });
  }
});

// Forward ticket to super admin (Enterprise admin only)
router.post('/:id/forward', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if ticket belongs to this admin's enterprise
    const currentAdmin = await User.findById(req.user.id);
    if (ticket.enterpriseId !== currentAdmin.enterprise.enterpriseId) {
      return res.status(403).json({ message: 'You can only forward tickets from your enterprise' });
    }

    // Update ticket to forward to super admin
    ticket.forwardedToSuperAdmin = true;
    ticket.forwardedAt = new Date();
    ticket.forwardedBy = req.user.id;

    await ticket.save();

    // Populate the ticket with necessary fields for notifications
    await ticket.populate([
      { path: 'submittedBy', select: 'email profile.fullName' },
      { path: 'forwardedBy', select: 'email profile.fullName enterprise.companyName' }
    ]);

    // Create notification for super admin
    try {
      // Find the super admin user to get their actual ID
      const superAdmin = await User.findOne({ role: 'superadmin' });
      if (superAdmin) {
        await notificationController.createNotification({
          userId: superAdmin._id, // Use actual super admin user ID
          message: `Ticket ${ticket.ticketNo} forwarded from ${currentAdmin.enterprise.companyName}`,
          type: 'info',
          title: 'Ticket Forwarded',
          relatedTo: { model: 'Ticket', id: ticket._id }
        });
      }
    } catch (notifyErr) {
      console.error('Failed to create notification for forwarded ticket:', notifyErr);
    }

    // Emit WebSocket event for ticket forwarding
    try {
      websocketService.notifyEnterpriseAdmins('ticket_forwarded', ticket);
      // Notify super admins about the forwarded ticket
      websocketService.notifySuperAdmins('ticket_forwarded', ticket);
      // Notify the ticket submitter about the forwarding
      if (ticket.submittedBy && ticket.submittedBy._id) {
        websocketService.notifyUser(ticket.submittedBy._id, 'ticket_forwarded_to_superadmin', ticket);
      }
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError);
      // Don't fail the request if WebSocket notification fails
    }

    res.json({ 
      message: 'Ticket forwarded to super admin successfully',
      ticket: ticket
    });
  } catch (error) {
    console.error('Error forwarding ticket:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a ticket by ID (Superadmin and Admin can delete)
router.delete('/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      console.log('[DELETE /api/tickets/:id] Ticket not found for id:', req.params.id);
      return res.status(404).json({ message: 'Ticket not found' });
    }
    // Permission check for admin only
    if (req.user.role === 'admin') {
      const adminIdRaw = ticket.adminId;
      const adminIdStr = adminIdRaw ? String(adminIdRaw) : 'undefined';
      const userIdStr = String(req.user.id);
      const isAdminTicket = ticket.isAdminTicket;
      const isForwarded = ticket.forwardedToSuperAdmin;
      const adminIdType = typeof adminIdRaw;
      const userIdType = typeof req.user.id;
      const canDelete = !isAdminTicket && !isForwarded && adminIdStr === userIdStr;
      console.log('[DELETE /api/tickets/:id] Debug:', {
        ticketId: ticket._id,
        adminIdRaw,
        adminIdStr,
        adminIdType,
        userIdStr,
        userIdType,
        isAdminTicket,
        isForwarded,
        canDelete
      });
      if (isAdminTicket) {
        console.log('[DELETE /api/tickets/:id] Denied: isAdminTicket is true');
        return res.status(403).json({ message: 'Admins cannot delete tickets created by admins.' });
      }
      if (isForwarded) {
        console.log('[DELETE /api/tickets/:id] Denied: forwardedToSuperAdmin is true');
        return res.status(403).json({ message: 'Admins cannot delete tickets forwarded to super admin.' });
      }
      if (adminIdStr !== userIdStr) {
        console.log('[DELETE /api/tickets/:id] Denied: adminId does not match req.user.id');
        return res.status(403).json({ message: 'Admins can only delete tickets assigned to them.' });
      }
    }
    await ticket.deleteOne();
    console.log('[DELETE /api/tickets/:id] Ticket deleted successfully:', ticket._id);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get ticket statistics
router.get('/stats', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    // For super admin, only count forwarded tickets
    const query = { forwardedToSuperAdmin: true };
    
    const total = await Ticket.countDocuments(query);
    const byStatus = {
      open: await Ticket.countDocuments({ ...query, status: 'Open' }),
      inProgress: await Ticket.countDocuments({ ...query, status: 'In Progress' }),
      resolved: await Ticket.countDocuments({ ...query, status: 'Resolved' }),
      closed: await Ticket.countDocuments({ ...query, status: 'Closed' })
    };
    const byPriority = {
      critical: await Ticket.countDocuments({ ...query, priority: 'Critical' }),
      high: await Ticket.countDocuments({ ...query, priority: 'High' }),
      medium: await Ticket.countDocuments({ ...query, priority: 'Medium' }),
      low: await Ticket.countDocuments({ ...query, priority: 'Low' })
    };

    res.json({
      total,
      byStatus,
      byPriority
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tickets assigned to this admin (from users)
router.get('/admin/assigned', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const tickets = await Ticket.find({
      adminId: req.user.id,
      isAdminTicket: false
    })
      .populate('submittedBy', 'email profile.fullName enterprise.companyName')
      .populate('adminId', 'email profile.fullName enterprise.companyName')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets assigned to admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tickets created by this admin (to superadmin)
router.get('/admin/created', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const tickets = await Ticket.find({
      submittedBy: req.user.id,
      isAdminTicket: true
    })
      .populate('adminId', 'email profile.fullName enterprise.companyName')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets created by admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add response to ticket (User follow-up)
router.post('/:ticketId/messages', authenticateToken, authorizeRole('user'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    // Only the user who submitted the ticket can add a message
    if (String(ticket.submittedBy) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only add messages to your own tickets.' });
    }
    ticket.responses.push({
      message: req.body.message,
      role: 'user',
      createdAt: new Date()
    });
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Error adding user message:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get forwarded tickets (user tickets assigned to this admin, now forwarded to superadmin)
router.get('/admin/forwarded', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const tickets = await Ticket.find({
      adminId: req.user.id,
      isAdminTicket: false,
      forwardedToSuperAdmin: true
    })
      .populate('submittedBy', 'email profile.fullName enterprise.companyName')
      .populate('adminId', 'email profile.fullName enterprise.companyName')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching forwarded tickets:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 