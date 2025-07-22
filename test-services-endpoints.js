const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test admin credentials
const testAdmin = {
  email: 'admin@example.com',
  password: 'adminpassword'
};

async function testServicesEndpoints() {
  console.log('🧪 Testing Services Endpoints for Admin Users\n');

  try {
    // Step 1: Login as Admin
    console.log('1. Logging in as Admin...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      email: testAdmin.email,
      password: testAdmin.password
    });
    
    const adminToken = loginResponse.data.token;
    console.log('✅ Admin login successful\n');

    // Step 2: Test services endpoint
    console.log('2. Testing /api/services/admin endpoint...');
    try {
      const servicesResponse = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Services endpoint successful');
      console.log('Services count:', servicesResponse.data.length);
      console.log('First service:', servicesResponse.data[0]?.name || 'No services found');
      console.log('');
    } catch (error) {
      console.log('❌ Services endpoint failed:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    // Step 3: Test quotations endpoint
    console.log('3. Testing /api/services/admin/quotations endpoint...');
    try {
      const quotationsResponse = await axios.get(`${API_URL}/api/services/admin/quotations`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Quotations endpoint successful');
      console.log('Quotations count:', quotationsResponse.data.length);
      console.log('');
    } catch (error) {
      console.log('❌ Quotations endpoint failed:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    // Step 4: Test individual service endpoint
    console.log('4. Testing /api/services/admin/:id endpoint...');
    try {
      // First get a service ID
      const servicesResponse = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (servicesResponse.data.length > 0) {
        const serviceId = servicesResponse.data[0]._id;
        const serviceResponse = await axios.get(`${API_URL}/api/services/admin/${serviceId}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        console.log('✅ Individual service endpoint successful');
        console.log('Service name:', serviceResponse.data.name);
        console.log('');
      } else {
        console.log('⚠️ No services available to test individual service endpoint');
        console.log('');
      }
    } catch (error) {
      console.log('❌ Individual service endpoint failed:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    console.log('🎉 Services endpoints test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Make sure you have an admin user with these credentials:');
      console.log('Email:', testAdmin.email);
      console.log('Password:', testAdmin.password);
    }
  }
}

// Run the test
testServicesEndpoints(); 