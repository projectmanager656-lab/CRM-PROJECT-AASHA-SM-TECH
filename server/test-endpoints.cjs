const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // Assuming jsonwebtoken is used in server

async function testBackend() {
  try {
    await mongoose.connect('mongodb://localhost:27017/it-management-system');
    
    // Create a fake token for a superadmin
    const user = await mongoose.connection.db.collection('users').findOne({ role: 'super_admin' });
    if (!user) throw new Error("No super_admin found");
    
    // We don't have JWT_SECRET, let's just make the requests to the endpoints and check if they return 401 or actual data
    // If we get 401, it means the endpoint exists and is protected.
    const axios = require('axios');
    console.log('Testing endpoints for existence (expecting 401 Unauthorized if no token, 404 if not found):');
    
    const endpoints = [
      '/api/payroll',
      '/api/notifications',
      '/api/calendar',
      '/api/invoices',
      '/api/super-admin/summary'
    ];

    for (const ep of endpoints) {
      try {
        await axios.get(`http://localhost:5005${ep}`);
        console.log(`${ep} -> Success (no auth required?)`);
      } catch (err) {
        console.log(`${ep} -> ${err.response?.status} ${err.response?.statusText}`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

testBackend();
