const axios = require('axios');

// Test script to verify quotation update functionality
async function testQuotationUpdate() {
  try {
    console.log('=== TESTING QUOTATION UPDATE ===');
    
    const baseUrl = 'http://localhost:5000';
    
    // First, let's get a list of quotations
    console.log('1. Getting quotations list...');
    const quotationsResponse = await axios.get(`${baseUrl}/api/services/superadmin/quotations`, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need to replace this with a valid token
      }
    });
    
    console.log('Quotations found:', quotationsResponse.data.length);
    
    if (quotationsResponse.data.length === 0) {
      console.log('No quotations found. Please create some quotations first.');
      return;
    }
    
    const firstQuotation = quotationsResponse.data[0];
    console.log('First quotation:', {
      id: firstQuotation._id,
      status: firstQuotation.status,
      service: firstQuotation.serviceId?.name
    });
    
    // Test the quotation update
    console.log('2. Testing quotation update...');
    const updateData = {
      status: 'approved',
      finalPrice: 1500,
      superadminNotes: 'Test update from script',
      proposedDeliveryDate: '2024-12-31'
    };
    
    const updateResponse = await axios.put(
      `${baseUrl}/api/services/superadmin/quotations/${firstQuotation._id}`,
      updateData,
      {
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE', // You'll need to replace this with a valid token
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Update successful:', updateResponse.data);
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testQuotationUpdate(); 