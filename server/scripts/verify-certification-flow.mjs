import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import 'dotenv/config';

import mongoose from 'mongoose';
import AuthService from '../src/services/AuthService.js';
import http from 'http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

async function runTest() {
  console.log('Connecting to database...');
  await connectDB();
  const db = mongoose.connection.db;

  // Start temporary HTTP test server
  const testPort = 5099;
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(testPort, resolve));
  console.log(`Test server listening on port ${testPort}`);

  const adminUser = await db.collection('users').findOne({ role: { $in: ['admin', 'super_admin'] } });
  if (!adminUser) throw new Error('No admin user found in DB');

  const token = AuthService.generateToken(
    adminUser._id.toString(),
    adminUser.email,
    adminUser.role,
    adminUser.department || 'HR'
  );

  const BASE_URL = `http://localhost:${testPort}/api/v1`;

  console.log('\n--- 1. Testing GET /training/programs ---');
  const progRes = await fetch(`${BASE_URL}/training/programs`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const progJson = await progRes.json();
  console.log('Programs status:', progRes.status, 'Count:', progJson.data?.length);
  const dataScienceProg = progJson.data.find(p => p.name.toLowerCase().includes('data science'));
  console.log('Data Science Program:', dataScienceProg?._id, dataScienceProg?.name);

  console.log('\n--- 2. Testing GET /training/courses?program=:id ---');
  const courseRes = await fetch(`${BASE_URL}/training/courses?program=${dataScienceProg._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const courseJson = await courseRes.json();
  console.log('Courses for program status:', courseRes.status);
  console.log('Courses found:', courseJson.data?.map(c => ({ _id: c._id, title: c.title, program: c.program })));

  if (!courseJson.data || courseJson.data.length === 0) {
    throw new Error('FAILED: No courses returned for data science program!');
  }
  const selectedCourse = courseJson.data[0];

  // Pick an employee
  const employee = await db.collection('users').findOne({ role: 'employee' });
  console.log('\n--- Selected Employee for Certification ---');
  console.log('Employee:', employee._id.toString(), employee.firstName, employee.lastName);

  // Clean any old test cert for this employee+course so test is repeatable
  await db.collection('trainingcertifications').deleteMany({
    employee: employee._id,
    course: selectedCourse._id
  });

  console.log('\n--- 3. Testing POST /training/certifications/generate ---');
  const genPayload = {
    employee: employee._id.toString(),
    program: dataScienceProg._id.toString(),
    course: selectedCourse._id.toString()
  };

  const genRes = await fetch(`${BASE_URL}/training/certifications/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(genPayload)
  });

  const genJson = await genRes.json();
  console.log('Generate Status:', genRes.status);
  console.log('Generate Response:', JSON.stringify(genJson, null, 2));

  if (!genRes.ok || !genJson.data?._id) {
    throw new Error(`Failed to generate certification: ${JSON.stringify(genJson)}`);
  }

  const generatedCertId = genJson.data._id;
  const certNumber = genJson.data.certificateNumber;
  console.log('Generated Certificate ID:', generatedCertId);
  console.log('Certificate Number:', certNumber);

  console.log('\n--- 4. Testing GET /training/certifications ---');
  const certsRes = await fetch(`${BASE_URL}/training/certifications`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const certsJson = await certsRes.json();
  const foundCert = certsJson.data.find(c => c._id === generatedCertId);
  console.log('Found newly generated cert in list?', !!foundCert, 'Cert #:', foundCert?.certificateNumber);

  console.log('\n--- 5. Testing GET /training/certifications/:id/pdf ---');
  const pdfRes = await fetch(`${BASE_URL}/training/certifications/${generatedCertId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('PDF Download Status:', pdfRes.status);
  console.log('Content-Type:', pdfRes.headers.get('content-type'));
  console.log('Content-Disposition:', pdfRes.headers.get('content-disposition'));

  const pdfBuffer = await pdfRes.arrayBuffer();
  console.log('PDF Byte Size:', pdfBuffer.byteLength);

  if (pdfRes.status !== 200 || !pdfRes.headers.get('content-type')?.includes('application/pdf') || pdfBuffer.byteLength < 5000) {
    throw new Error('FAILED: PDF generation or download failed!');
  }

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('====================================================');

  server.close();
  await disconnectDB();
  process.exit(0);
}

runTest().catch(async (err) => {
  console.error('Test Error:', err);
  process.exit(1);
});
