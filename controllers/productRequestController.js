const ProductRequest = require('../models/productRequestModel');
const User = require('../models/User');

// Create a new product request
exports.createProductRequest = async (req, res) => {
  try {
    const {
      productId,
      productName,
      enterpriseId,
      enterpriseName,
      contactName,
      contactEmail,
      contactPhone,
      companyName,
      message,
      paymentMethod,
      bankAccount,
      additionalInfo
    } = req.body;

    // Verify the enterprise exists
    const enterprise = await User.findOne({ _id: enterpriseId, role: 'admin' });
    if (!enterprise) {
      return res.status(404).json({ message: 'Enterprise not found' });
    }

    // Create the product request
    const productRequest = new ProductRequest({
      productId,
      productName,
      enterpriseId,
      enterpriseName,
      contactName,
      contactEmail,
      contactPhone,
      companyName,
      message,
      paymentMethod,
      bankAccount,
      additionalInfo
    });

    await productRequest.save();

    res.status(201).json({
      success: true,
      message: 'Product request submitted successfully',
      request: productRequest
    });
  } catch (error) {
    console.error('Error creating product request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit product request',
      error: error.message
    });
  }
};

// Get all product requests (for superadmin)
exports.getAllProductRequests = async (req, res) => {
  try {
    const requests = await ProductRequest.find()
      .sort({ createdAt: -1 })
      .populate('enterpriseId', 'email profile.companyName');

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching product requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product requests',
      error: error.message
    });
  }
};

// Get product requests for a specific enterprise
exports.getEnterpriseProductRequests = async (req, res) => {
  try {
    const { enterpriseId } = req.params;

    const requests = await ProductRequest.find({ enterpriseId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching enterprise product requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enterprise product requests',
      error: error.message
    });
  }
};

// Update product request status (for superadmin)
exports.updateProductRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;

    const request = await ProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Product request not found'
      });
    }

    request.status = status;
    request.notes = notes;
    request.processedDate = new Date();
    request.processedBy = req.user.id;

    await request.save();

    res.json({
      success: true,
      message: 'Product request status updated successfully',
      request
    });
  } catch (error) {
    console.error('Error updating product request status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product request status',
      error: error.message
    });
  }
}; 