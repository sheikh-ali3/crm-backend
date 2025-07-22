const Notification = require('../models/notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// Create a new notification
exports.createNotification = async (notificationData) => {
  try {
    // Validate required fields
    if (!notificationData.userId || !notificationData.message) {
      throw new Error('UserId and message are required for notifications');
    }
    
    const newNotification = new Notification(notificationData);
    const savedNotification = await newNotification.save();
    
    console.log(`Created notification for user ${notificationData.userId}: ${notificationData.message}`);
    return savedNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Helper function to create notifications for multiple users
exports.createNotificationForMultipleUsers = async (userIds, notificationData) => {
  try {
    // Validate user IDs
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('Valid array of userIds is required');
    }
    
    // Validate notification data
    if (!notificationData.message) {
      throw new Error('Message is required for notifications');
    }
    
    // Create a notification for each user
    const notifications = userIds.map(userId => ({
      ...notificationData,
      userId
    }));
    
    const savedNotifications = await Notification.insertMany(notifications);
    console.log(`Created ${savedNotifications.length} notifications for ${userIds.length} users`);
    
    return savedNotifications;
  } catch (error) {
    console.error('Error creating notifications for multiple users:', error);
    throw error;
  }
};

// Get notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { limit = 10, offset = 0, includeRead = false } = req.query;
    
    // Query to filter notifications for the current user
    let query = { userId: req.user.id };
    
    // If includeRead is false, only return unread notifications
    if (includeRead !== 'true' && includeRead !== true) {
      query.read = false;
    }
    
    // Find notifications for the user
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalCount = await Notification.countDocuments(query);
    
    // Get count of unread notifications
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.id,
      read: false 
    });
    
    res.status(200).json({
      notifications,
      pagination: {
        total: totalCount,
        unreadCount,
        offset: parseInt(offset),
        limit: parseInt(limit),
        hasMore: totalCount > (parseInt(offset) + parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Validate notification ID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }
    
    // Find the notification
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if notification belongs to the user
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to modify this notification' });
    }
    
    // Mark as read
    notification.read = true;
    await notification.save();
    
    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    // Update all unread notifications for the user
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );
    
    res.status(200).json({ 
      message: 'All notifications marked as read',
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark notifications as read', error: error.message });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Validate notification ID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }
    
    // Find the notification
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if notification belongs to the user
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this notification' });
    }
    
    // Delete the notification
    await Notification.findByIdAndDelete(notificationId);
    
    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification', error: error.message });
  }
};

// Clear all notifications
exports.clearAllNotifications = async (req, res) => {
  try {
    // Delete all notifications for the user
    const result = await Notification.deleteMany({ userId: req.user.id });
    
    res.status(200).json({ 
      message: 'All notifications cleared',
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ message: 'Failed to clear notifications', error: error.message });
  }
}; 