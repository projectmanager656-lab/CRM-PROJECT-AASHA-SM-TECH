const axios = require('axios');

async function runTests() {
  try {
    console.log('Testing Superadmin Login...');
    const loginRes = await axios.post('http://localhost:5005/api/auth/super-admin/login', {
      email: 'superadmin@example.com', // Need to guess or check the db for real email. Let's try standard ones.
      password: 'password'
    }).catch(e => {
      // It might fail if we don't know the exact credentials.
      return { data: { error: e.response?.data || e.message } };
    });
    
    console.log('Login Result:', loginRes.data);

    // Let's also test the endpoints without auth to see what they return (should be 401 Unauthorized)
    console.log('Testing /super-admin/summary without auth...');
    const summaryRes = await axios.get('http://localhost:5005/api/super-admin/summary').catch(e => e.response?.status);
    console.log('Summary Res Status:', summaryRes);

  } catch (error) {
    console.error('Test script error:', error);
  }
}

runTests();
