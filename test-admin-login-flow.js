const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test admin credentials
const testAdmin = {
  email: 'admin@example.com',
  password: 'adminpassword'
};

async function testAdminLoginFlow() {
  console.log('🧪 Testing Complete Admin Login Flow\n');

  try {
    // Step 1: Login as Admin (simulating frontend login)
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
    console.log('Token received:', adminToken ? 'Yes' : 'No');
    console.log('');

    // Step 2: Test admin verification endpoint (simulating AdminDashboard checkAuth)
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
      return;
    }

    // Step 3: Test services endpoint (simulating AdminDashboard fetchServices)
    console.log('3. Testing services endpoint...');
    try {
      const servicesResponse = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Services endpoint successful');
      console.log('Status:', servicesResponse.status);
      console.log('Services count:', servicesResponse.data.length);
      console.log('First service:', servicesResponse.data[0]?.name || 'No services found');
      console.log('');
    } catch (error) {
      console.log('❌ Services endpoint failed');
      console.log('Error message:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('Response data:', error.response?.data);
      console.log('');
    }

    // Step 4: Test quotations endpoint (simulating AdminDashboard fetchQuotations)
    console.log('4. Testing quotations endpoint...');
    try {
      const quotationsResponse = await axios.get(`${API_URL}/api/services/admin/quotations`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Quotations endpoint successful');
      console.log('Status:', quotationsResponse.status);
      console.log('Quotations count:', quotationsResponse.data.length);
      console.log('');
    } catch (error) {
      console.log('❌ Quotations endpoint failed');
      console.log('Error message:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('');
    }

    console.log('🎉 Admin login flow test completed!');
    console.log('\n💡 If all tests passed, the issue might be:');
    console.log('1. Frontend is using a different token');
    console.log('2. Frontend is not properly logged in');
    console.log('3. Frontend is using a different API URL');
    console.log('4. Browser cache issues');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Login failed. Make sure you have an admin user with these credentials:');
      console.log('Email:', testAdmin.email);
      console.log('Password:', testAdmin.password);
    }
  }
}

// Run the test
testAdminLoginFlow(); 