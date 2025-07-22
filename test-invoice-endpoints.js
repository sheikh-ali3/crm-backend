const axios = require('axios');

const baseUrl = 'http://localhost:5000';

// Test function to verify API endpoints
async function testInvoiceEndpoints() {
  try {
    console.log('Testing invoice-related API endpoints...\n');

    // Test 1: Get all services (superadmin endpoint)
    console.log('1. Testing GET /api/services/superadmin...');
    try {
      const servicesResponse = await axios.get(`${baseUrl}/api/services/superadmin`);
      console.log('✅ Services endpoint working. Found', servicesResponse.data.length, 'services');
    } catch (error) {
      console.log('❌ Services endpoint failed:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 2: Get all quotations (superadmin endpoint)
    console.log('\n2. Testing GET /api/services/superadmin/quotations...');
    try {
      const quotationsResponse = await axios.get(`${baseUrl}/api/services/superadmin/quotations`);
      console.log('✅ Quotations endpoint working. Found', quotationsResponse.data.length, 'quotations');
      
      // Show sample quotation structure
      if (quotationsResponse.data.length > 0) {
        const sampleQuotation = quotationsResponse.data[0];
        console.log('   Sample quotation structure:', {
          _id: sampleQuotation._id,
          adminId: sampleQuotation.adminId,
          serviceId: sampleQuotation.serviceId,
          status: sampleQuotation.status
        });
      }
    } catch (error) {
      console.log('❌ Quotations endpoint failed:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 3: Get all invoices
    console.log('\n3. Testing GET /api/invoices...');
    try {
      const invoicesResponse = await axios.get(`${baseUrl}/api/invoices`);
      console.log('✅ Invoices endpoint working. Found', invoicesResponse.data.length, 'invoices');
    } catch (error) {
      console.log('❌ Invoices endpoint failed:', error.response?.status, error.response?.data?.message || error.message);
    }

    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testInvoiceEndpoints(); 