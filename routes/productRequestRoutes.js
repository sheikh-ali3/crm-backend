const express = require('express');
const router = express.Router();
const productRequestController = require('../controllers/productRequestController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Create a new product request (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), productRequestController.createProductRequest);

// Get all product requests (superadmin only)
router.get('/', authenticateToken, authorizeRole('superadmin'), productRequestController.getAllProductRequests);

// Get product requests for a specific enterprise (admin only)
router.get('/enterprise/:enterpriseId', authenticateToken, authorizeRole('admin'), productRequestController.getEnterpriseProductRequests);

// Update product request status (superadmin only)
router.put('/:requestId/status', authenticateToken, authorizeRole('superadmin'), productRequestController.updateProductRequestStatus);

module.exports = router; 