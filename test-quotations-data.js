const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test admin credentials
const testAdmin = {
  email: 'admin@example.com',
  password: 'adminpassword'
};

async function testQuotationsData() {
  console.log('🧪 Testing Quotations Data Source\n');

  try {
    // Step 1: Login as Admin
    console.log('1. Logging in as Admin...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      email: testAdmin.email,
      password: testAdmin.password
    });
    
    const adminToken = loginResponse.data.token;
    const adminId = loginResponse.data.user._id;
    console.log('✅ Admin login successful');
    console.log('Admin ID:', adminId);
    console.log('Admin Email:', loginResponse.data.user.email);
    console.log('');

    // Step 2: Test quotations endpoint
    console.log('2. Testing /api/services/admin/quotations endpoint...');
    try {
      const quotationsResponse = await axios.get(`${API_URL}/api/services/admin/quotations`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Quotations endpoint successful');
      console.log('Status:', quotationsResponse.status);
      console.log('Quotations count:', quotationsResponse.data.length);
      console.log('');
      
      // Show detailed quotation data
      if (quotationsResponse.data.length > 0) {
        console.log('📋 Sample Quotation Data:');
        console.log('========================');
        
        quotationsResponse.data.forEach((quotation, index) => {
          console.log(`\nQuotation ${index + 1}:`);
          console.log('  ID:', quotation._id);
          console.log('  Service:', quotation.serviceId?.name || 'Unknown Service');
          console.log('  Status:', quotation.status);
          console.log('  Request Details:', quotation.requestDetails);
          console.log('  Requested Price:', quotation.requestedPrice);
          console.log('  Final Price:', quotation.finalPrice);
          console.log('  Company Name:', quotation.enterpriseDetails?.companyName);
          console.log('  Created At:', quotation.createdAt);
          console.log('  Updated At:', quotation.updatedAt);
          
          if (quotation.superadminNotes) {
            console.log('  SuperAdmin Notes:', quotation.superadminNotes);
          }
          
          if (quotation.rejectionReason) {
            console.log('  Rejection Reason:', quotation.rejectionReason);
          }
          
          if (quotation.proposedDeliveryDate) {
            console.log('  Proposed Delivery Date:', quotation.proposedDeliveryDate);
          }
        });
      } else {
        console.log('⚠️ No quotations found for this admin');
      }
      console.log('');

    } catch (error) {
      console.log('❌ Quotations endpoint failed');
      console.log('Error message:', error.response?.data?.message || error.message);
      console.log('Status:', error.response?.status);
      console.log('Response data:', error.response?.data);
      console.log('');
    }

    // Step 3: Check if using mock DB or real DB
    console.log('3. Checking database type...');
    try {
      const response = await axios.get(`${API_URL}/api/services/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      console.log('✅ Services endpoint working');
      console.log('Services count:', response.data.length);
      
      // Check if this is mock data by looking at the service names
      const serviceNames = response.data.map(s => s.name);
      console.log('Service names:', serviceNames);
      
      if (serviceNames.includes('Web Development') && serviceNames.includes('UI/UX Design')) {
        console.log('📝 Data Source: Mock Database (Sample Data)');
        console.log('   - 10 sample quotations are created for random admins');
        console.log('   - Each admin gets quotations based on their adminId');
      } else {
        console.log('📝 Data Source: Real MongoDB Database');
        console.log('   - Services and quotations are stored in MongoDB');
        console.log('   - Data is created through the application');
      }
      console.log('');

    } catch (error) {
      console.log('❌ Could not determine data source');
      console.log('Error:', error.response?.data?.message || error.message);
      console.log('');
    }

    console.log('🎉 Quotations data test completed!');
    console.log('\n💡 Summary:');
    console.log('- Quotations data comes from the /api/services/admin/quotations endpoint');
    console.log('- The endpoint filters quotations by adminId (current logged-in admin)');
    console.log('- Data is populated with service information (name, price, category)');
    console.log('- Quotations can have status: pending, approved, rejected, completed');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testQuotationsData(); 