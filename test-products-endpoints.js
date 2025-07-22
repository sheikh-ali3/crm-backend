const axios = require('axios');

const baseUrl = 'http://localhost:5000';

// Test function to verify products API endpoints
async function testProductsEndpoints() {
  try {
    console.log('Testing products API endpoints...\n');

    // Test 1: Get all products (superadmin endpoint)
    console.log('1. Testing GET /superadmin/products...');
    try {
      const productsResponse = await axios.get(`${baseUrl}/superadmin/products`);
      console.log('✅ Products endpoint working. Found', productsResponse.data.length, 'products');
      
      // Show sample product structure
      if (productsResponse.data.length > 0) {
        const sampleProduct = productsResponse.data[0];
        console.log('   Sample product structure:', {
          _id: sampleProduct._id,
          productId: sampleProduct.productId,
          name: sampleProduct.name,
          category: sampleProduct.category,
          pricing: sampleProduct.pricing
        });
      }
    } catch (error) {
      console.log('❌ Products endpoint failed:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 2: Get all services (superadmin endpoint)
    console.log('\n2. Testing GET /api/services/superadmin...');
    try {
      const servicesResponse = await axios.get(`${baseUrl}/api/services/superadmin`);
      console.log('✅ Services endpoint working. Found', servicesResponse.data.length, 'services');
    } catch (error) {
      console.log('❌ Services endpoint failed:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 3: Get all quotations (superadmin endpoint)
    console.log('\n3. Testing GET /api/services/superadmin/quotations...');
    try {
      const quotationsResponse = await axios.get(`${baseUrl}/api/services/superadmin/quotations`);
      console.log('✅ Quotations endpoint working. Found', quotationsResponse.data.length, 'quotations');
    } catch (error) {
      console.log('❌ Quotations endpoint failed:', error.response?.status, error.response?.data?.message || error.message);
    }

    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testProductsEndpoints(); 