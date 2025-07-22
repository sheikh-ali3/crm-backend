const express = require('express');
const router = express.Router();
const Complaint = require('../models/complaintModel');
const auth = require('../middleware/authMiddleware').authenticateToken;

// Get responses for a ticket
router.get('/:id/responses', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    res.json(complaint.responses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching responses', error: error.message });
  }
});

// Add a response to a ticket
router.post('/:id/responses', auth, async (req, res) => {
  try {
    const { message, role } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    complaint.responses.push({
      message,
      role,
      createdAt: new Date()
    });

    await complaint.save();
    res.status(201).json(complaint.responses[complaint.responses.length - 1]);
  } catch (error) {
    res.status(500).json({ message: 'Error adding response', error: error.message });
  }
});

module.exports = router; 