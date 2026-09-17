import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const API_BASE = 'http://localhost:5005/api/v1';

async function testBackend() {
  console.log('Testing HR Lifecycle Backend Endpoints...');

  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const adminUser = await db.collection('users').findOne({ department: 'HR' }) ||
                    await db.collection('users').findOne({});

  if (!adminUser) throw new Error('No user found in Atlas database');

  const token = jwt.sign(
    {
      userId: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
      department: 'HR',
    },
    process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
    { expiresIn: '1h' }
  );

  const headers = { Authorization: `Bearer ${token}` };

  // 1. Test Onboarding Summary
  const onbSummary = await axios.get(`${API_BASE}/onboarding/summary`, { headers });
  console.log('Onboarding summary response:', onbSummary.data.data);

  // 2. Test Eligible Employees for Onboarding
  const eligible = await axios.get(`${API_BASE}/onboarding/eligible-employees`, { headers });
  console.log('Eligible employees:', eligible.data.data.employees?.length, 'Eligible candidates:', eligible.data.data.candidates?.length);

  // 3. Test Interview Summary
  const invSummary = await axios.get(`${API_BASE}/recruitment/interviews/summary`, { headers });
  console.log('Interview summary response:', invSummary.data.data);

  // 4. Test List Interviews
  const interviews = await axios.get(`${API_BASE}/recruitment/interviews`, { headers });
  console.log('Interviews total retrieved:', interviews.data.data?.length);

  // 5. Test Resignation Summary
  const resSummary = await axios.get(`${API_BASE}/resignation/summary`, { headers });
  console.log('Resignation summary response:', resSummary.data.data);

  await mongoose.disconnect();
  console.log('>>> ALL BACKEND LIFECYCLE ENDPOINTS VERIFIED SUCCESSFULLY! <<<');
}

testBackend().catch((e) => {
  console.error('Backend test error:', e.response?.data || e.message);
  process.exit(1);
});
