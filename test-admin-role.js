const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test admin credentials
const testAdmin = {
  email: 'admin@example.com',
  password: 'adminpassword'
};

async function testAdminRole() {
  console.log('🧪 Testing Admin Role and Permissions\n');

  try {
    // Step 1: Login as Admin
    console.log('1. Logging in as Admin...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      email: testAdmin.email,
      password: testAdmin.password
    });
    
    const adminToken = loginResponse.data.token;
    console.log('✅ Admin login successful');
    console.log('User data:', {
      id: loginResponse.data.user._id,
      email: loginResponse.data.user.email,
      role: loginResponse.data.user.role,
      permissions: loginResponse.data.user.permissions
    });
    console.log('');

    // Step 2: Test admin verification endpoint
    console.log('2. Testing admin verification endpoint...');
    try {
      const verifyResponse = await axios.get(`${API_URL}/admin/verify`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Admin verification successful');
      console.log('Verified user data:', {
        id: verifyResponse.data.user._id,
        email: verifyResponse.data.user.email,
        role: verifyResponse.data.user.role,
        permissions: verifyResponse.data.user.permissions
      });
      console.log('');
    } catch (error) {
      console.log('❌ Admin verification failed:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    // Step 3: Test services endpoint with detailed error
    console.log('3. Testing /api/services/admin endpoint...');
    try {
      const servicesResponse = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Services endpoint successful');
      console.log('Services count:', servicesResponse.data.length);
      console.log('');
    } catch (error) {
      console.log('❌ Services endpoint failed');
      console.log('Error message:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('Response data:', error.response?.data);
      console.log('');
    }

    console.log('🎉 Admin role test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAdminRole(); 