const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Get user notifications
router.get('/', notificationController.getUserNotifications);

// Mark notification as read
router.put('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete a notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Clear all notifications
router.delete('/', notificationController.clearAllNotifications);

module.exports = router; 