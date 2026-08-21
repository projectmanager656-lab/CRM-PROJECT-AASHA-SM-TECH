#!/usr/bin/env node
/**
 * Phase 2 Authentication End-to-End Test Suite
 * Tests: health, register, login, /me endpoint, invalid credentials, logout
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1';
let testToken = null;
let testUserId = null;

// Utility function for HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = BASE_URL + path;
    const url = new URL(fullPath);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (testToken) {
      options.headers['Authorization'] = `Bearer ${testToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n=== PHASE 2 AUTHENTICATION END-TO-END TESTS ===\n');

  // Test 1: Health Check
  console.log('TEST 1: Health Endpoint');
  try {
    const result = await makeRequest('GET', '/health');
    console.log(`✓ Status: ${result.status}`);
    console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
    if (result.status !== 200) {
      console.error('✗ Expected status 200');
      process.exit(1);
    }
  } catch (e) {
    console.error('✗ Error:', e.message);
    process.exit(1);
  }

  // Test 2: Register User
  console.log('\n\nTEST 2: User Registration');
  try {
    const payload = {
      email: `testuser_${Date.now()}@example.com`,
      password: 'testPassword123',
      firstName: 'Test',
      lastName: 'User',
    };
    const result = await makeRequest('POST', '/auth/register', payload);
    console.log(`✓ Status: ${result.status}`);
    console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status !== 201) {
      console.error(`✗ Expected status 201, got ${result.status}`);
    } else {
      if (result.data.data && result.data.data._id) {
        testUserId = result.data.data._id;
        console.log(`✓ User ID: ${testUserId}`);
      }
    }
  } catch (e) {
    console.error('✗ Error:', e.message);
  }

  // Test 3: Login with Valid Credentials
  console.log('\n\nTEST 3: Login with Valid Credentials');
  try {
    const payload = {
      email: `testuser_${Date.now() - 1000}@example.com`,
      password: 'testPassword123',
    };
    
    // First register to get a valid user
    await makeRequest('POST', '/auth/register', {
      ...payload,
      firstName: 'Valid',
      lastName: 'User',
    });

    // Then login
    const result = await makeRequest('POST', '/auth/login', {
      email: payload.email,
      password: payload.password,
    });
    
    console.log(`✓ Status: ${result.status}`);
    console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status === 200 && result.data.data.token) {
      testToken = result.data.data.token;
      console.log(`✓ JWT Token received (length: ${testToken.length})`);
    } else {
      console.error('✗ Expected status 200 with token');
    }
  } catch (e) {
    console.error('✗ Error:', e.message);
  }

  // Test 4: Get Current User (/me) with Valid Token
  console.log('\n\nTEST 4: Get Current User (/me) with Valid Token');
  if (testToken) {
    try {
      const result = await makeRequest('GET', '/auth/me');
      console.log(`✓ Status: ${result.status}`);
      console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
      
      if (result.status !== 200) {
        console.error(`✗ Expected status 200, got ${result.status}`);
      } else {
        console.log(`✓ User email: ${result.data.data.email}`);
        console.log(`✓ User role: ${result.data.data.role}`);
      }
    } catch (e) {
      console.error('✗ Error:', e.message);
    }
  } else {
    console.warn('⊘ Skipped: No valid token from login test');
  }

  // Test 5: Invalid Credentials
  console.log('\n\nTEST 5: Login with Invalid Credentials');
  try {
    const result = await makeRequest('POST', '/auth/login', {
      email: 'nonexistent@example.com',
      password: 'wrongPassword',
    });
    
    console.log(`✓ Status: ${result.status}`);
    console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status !== 401 && result.status !== 400) {
      console.warn(`⊘ Expected 401 or 400, got ${result.status}`);
    } else {
      console.log('✓ Correctly rejected invalid credentials');
    }
  } catch (e) {
    console.error('✗ Error:', e.message);
  }

  // Test 6: Protected Route without Token
  console.log('\n\nTEST 6: Protected Route Without Token');
  try {
    const savedToken = testToken;
    testToken = null;
    const result = await makeRequest('GET', '/auth/me');
    testToken = savedToken;
    
    console.log(`✓ Status: ${result.status}`);
    console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status !== 401) {
      console.warn(`⊘ Expected 401, got ${result.status}`);
    } else {
      console.log('✓ Correctly rejected request without token');
    }
  } catch (e) {
    console.error('✗ Error:', e.message);
  }

  // Test 7: Protected Route with Invalid Token
  console.log('\n\nTEST 7: Protected Route with Invalid Token');
  try {
    const savedToken = testToken;
    testToken = 'invalid.token.here';
    const result = await makeRequest('GET', '/auth/me');
    testToken = savedToken;
    
    console.log(`✓ Status: ${result.status}`);
    console.log(`✓ Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.status !== 401) {
      console.warn(`⊘ Expected 401, got ${result.status}`);
    } else {
      console.log('✓ Correctly rejected request with invalid token');
    }
  } catch (e) {
    console.error('✗ Error:', e.message);
  }

  console.log('\n\n=== END OF TESTS ===\n');
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
