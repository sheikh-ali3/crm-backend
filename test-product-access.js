const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test data
const testAdmin = {
  email: 'admin@testenterprise.com',
  password: 'admin123',
  role: 'admin',
  profile: {
    fullName: 'Test Admin',
    phone: '1234567890',
    department: 'IT'
  },
  enterprise: {
    companyName: 'Test Enterprise',
    address: '123 Test St',
    city: 'Test City',
    country: 'Test Country'
  }
};

const testSuperAdmin = {
  email: 'superadmin@moaqa.com',
  password: 'superadmin123'
};

async function testProductAccess() {
  console.log('🧪 Testing Product Access Functionality\n');

  try {
    // Step 1: Login as SuperAdmin
    console.log('1. Logging in as SuperAdmin...');
    const superAdminLogin = await axios.post(`${API_URL}/superadmin/login`, {
      email: testSuperAdmin.email,
      password: testSuperAdmin.password
    });
    
    const superAdminToken = superAdminLogin.data.token;
    console.log('✅ SuperAdmin login successful\n');

    // Step 2: Create a test admin
    console.log('2. Creating test admin...');
    const createAdminResponse = await axios.post(`${API_URL}/superadmin/admins`, testAdmin, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    const adminId = createAdminResponse.data.admin._id;
    console.log(`✅ Test admin created with ID: ${adminId}\n`);

    // Step 3: Grant CRM access to the admin
    console.log('3. Granting CRM access to admin...');
    const grantCrmResponse = await axios.put(
      `${API_URL}/superadmin/admins/${adminId}/products/crm/grant`,
      {},
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    
    console.log('✅ CRM access granted successfully');
    console.log('Access URL:', grantCrmResponse.data.admin.productAccess.find(p => p.productId === 'crm')?.accessUrl);
    console.log('');

    // Step 4: Grant HRM access to the admin
    console.log('4. Granting HRM access to admin...');
    const grantHrmResponse = await axios.put(
      `${API_URL}/superadmin/admins/${adminId}/products/hrm/grant`,
      {},
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    
    console.log('✅ HRM access granted successfully');
    console.log('Access URL:', grantHrmResponse.data.admin.productAccess.find(p => p.productId === 'hrm')?.accessUrl);
    console.log('');

    // Step 5: Login as the admin
    console.log('5. Logging in as admin...');
    const adminLogin = await axios.post(`${API_URL}/login`, {
      email: testAdmin.email,
      password: testAdmin.password
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful\n');

    // Step 6: Verify admin permissions
    console.log('6. Verifying admin permissions...');
    const verifyResponse = await axios.get(`${API_URL}/admin/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    const adminUser = verifyResponse.data.user;
    console.log('✅ Admin verification successful');
    console.log('Permissions:', adminUser.permissions);
    console.log('Product Access:', adminUser.productAccess);
    console.log('');

    // Step 7: Test admin products endpoint
    console.log('7. Testing admin products endpoint...');
    const adminProductsResponse = await axios.get(`${API_URL}/api/products/admins/${adminId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    console.log('✅ Admin products retrieved successfully');
    console.log('Products with access:', adminProductsResponse.data.filter(p => p.hasAccess).map(p => p.name));
    console.log('');

    // Step 8: Test product access verification
    console.log('8. Testing product access verification...');
    
    // Test CRM access
    try {
      const crmAccessResponse = await axios.get(`${API_URL}/products/verify/crm`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ CRM access verification successful');
    } catch (error) {
      console.log('❌ CRM access verification failed:', error.response?.data?.message);
    }

    // Test HRM access
    try {
      const hrmAccessResponse = await axios.get(`${API_URL}/products/verify/hrm`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ HRM access verification successful');
    } catch (error) {
      console.log('❌ HRM access verification failed:', error.response?.data?.message);
    }

    // Test non-granted product access
    try {
      const jobPortalAccessResponse = await axios.get(`${API_URL}/products/verify/job-portal`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('❌ Job Portal access should be denied but was granted');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Job Portal access correctly denied (expected)');
      } else {
        console.log('❌ Unexpected error for Job Portal access:', error.response?.data?.message);
      }
    }

    console.log('\n🎉 All tests completed successfully!');

    // Cleanup: Delete the test admin
    console.log('\n🧹 Cleaning up test data...');
    try {
      await axios.delete(`${API_URL}/superadmin/admins/${adminId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      console.log('✅ Test admin deleted successfully');
    } catch (error) {
      console.log('⚠️ Failed to delete test admin:', error.response?.data?.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Make sure you have a superadmin user with these credentials:');
      console.log('Email:', testSuperAdmin.email);
      console.log('Password:', testSuperAdmin.password);
    }
  }
}

// Run the test
testProductAccess(); 