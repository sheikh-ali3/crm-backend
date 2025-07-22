const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test admin credentials
const testAdmin = {
  email: 'admin@example.com',
  password: 'adminpassword'
};

async function testFrontendSimulation() {
  console.log('🧪 Simulating Frontend AdminDashboard Services Request\n');

  try {
    // Step 1: Login as Admin (simulating frontend login)
    console.log('1. Logging in as Admin...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      email: testAdmin.email,
      password: testAdmin.password
    });
    
    const adminToken = loginResponse.data.token;
    console.log('✅ Admin login successful');
    console.log('Token received:', adminToken ? 'Yes' : 'No');
    console.log('');

    // Step 2: Simulate AdminDashboard fetchServices function
    console.log('2. Simulating AdminDashboard fetchServices function...');
    console.log('Calling: GET ${API_URL}/api/services/admin');
    console.log('Headers: Authorization: Bearer ${adminToken}');
    console.log('');
    
    try {
      const servicesResponse = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Services request successful');
      console.log('Status:', servicesResponse.status);
      console.log('Services count:', servicesResponse.data.length);
      console.log('Response data type:', typeof servicesResponse.data);
      console.log('Is array:', Array.isArray(servicesResponse.data));
      console.log('');
    } catch (error) {
      console.log('❌ Services request failed');
      console.log('Error type:', error.constructor.name);
      console.log('Error message:', error.message);
      console.log('Status:', error.response?.status);
      console.log('Status text:', error.response?.statusText);
      console.log('Response data:', error.response?.data);
      console.log('Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
      console.log('');
    }

    // Step 3: Test with different token format
    console.log('3. Testing with different token format...');
    try {
      const servicesResponse2 = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Services request with Content-Type successful');
      console.log('Status:', servicesResponse2.status);
      console.log('');
    } catch (error) {
      console.log('❌ Services request with Content-Type failed');
      console.log('Error:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    // Step 4: Test token validation
    console.log('4. Testing token validation...');
    try {
      const verifyResponse = await axios.get(`${API_URL}/admin/verify`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Token validation successful');
      console.log('User role:', verifyResponse.data.user.role);
      console.log('User permissions:', verifyResponse.data.user.permissions);
      console.log('');
    } catch (error) {
      console.log('❌ Token validation failed');
      console.log('Error:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    console.log('🎉 Frontend simulation test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testFrontendSimulation(); 