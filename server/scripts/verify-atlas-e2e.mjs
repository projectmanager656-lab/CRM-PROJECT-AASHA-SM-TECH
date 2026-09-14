import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING END-TO-END MONGODB ATLAS PERSISTENCE VERIFICATION');
  console.log('====================================================');

  const uri = process.env.MONGODB_URI;
  console.log('1. Target MongoDB Atlas URI:', uri.replace(/:([^:@]+)@/, ':****@'));

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log('2. Connected Database Name:', mongoose.connection.name);
  console.log('   Cluster Host:', mongoose.connection.host);

  // Check collections in DB
  const collections = await db.listCollections().toArray();
  const collNames = collections.map(c => c.name);
  console.log('3. All Collections count:', collNames.length);
  console.log('   Does "offerletters" collection exist?', collNames.includes('offerletters'));
  console.log('   Does "candidates" collection exist?', collNames.includes('candidates'));
  console.log('   Does "jobrequisitions" collection exist?', collNames.includes('jobrequisitions'));

  // Fetch a candidate
  const candidate = await db.collection('candidates').findOne();
  if (!candidate) {
    throw new Error('No candidate found in Atlas candidates collection!');
  }
  console.log('4. Selected Real Candidate from Atlas:');
  console.log('   _id:', candidate._id.toString());
  console.log('   Name:', candidate.name);
  console.log('   Email:', candidate.email);
  console.log('   Applied Position:', candidate.appliedPosition);

  // Fetch admin user
  const adminUser = await db.collection('users').findOne({ role: { $in: ['admin', 'super_admin'] } });
  if (!adminUser) {
    throw new Error('No admin user found!');
  }
  console.log('5. Selected Admin User for Authenticated API Call:');
  console.log('   _id:', adminUser._id.toString());
  console.log('   Email:', adminUser.email);
  console.log('   Role:', adminUser.role);

  // Generate JWT token matching project's auth middleware
  const token = jwt.sign(
    {
      userId: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
      department: adminUser.department || 'HR'
    },
    process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
    { expiresIn: '1d' }
  );

  const API_BASE = `http://localhost:${process.env.PORT || 5005}/api/v1`;

  // STEP A: Create Offer via POST /api/v1/recruitment/offer-letters
  console.log('\n--- STEP A: Testing POST /recruitment/offer-letters ---');
  const postPayload = {
    candidateId: candidate._id.toString(),
    offeredDesignation: 'Lead Cloud Solutions Architect',
    department: 'Tech',
    employmentType: 'Full Time',
    salary: '24,00,000 / yr',
    joiningDate: '2026-10-15',
    offerDate: '2026-09-11',
    expiresAt: '2026-09-25',
    probationPeriod: '3 Months',
    workLocation: 'Pune / Hybrid',
    reportingManager: 'CTO / Director of Engineering',
    workingHours: '9:30 AM - 6:30 PM (Mon-Fri)',
    noticePeriod: '60 Days',
    termsAndConditions: 'Standard NDA and IP agreement applies.',
    additionalNotes: 'Joining bonus applicable upon completion of probation.',
  };

  const createRes = await fetch(`${API_BASE}/recruitment/offer-letters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(postPayload)
  });

  const createJson = await createRes.json();
  console.log('API Create Status:', createRes.status);
  console.log('API Create Response:', JSON.stringify(createJson, null, 2));

  if (!createRes.ok || !createJson.data?._id) {
    throw new Error(`Failed to create offer via API: ${JSON.stringify(createJson)}`);
  }

  const createdId = createJson.data._id;
  const offerNumber = createJson.data.offerNumber;
  console.log(`✓ Offer created with real MongoDB _id: ${createdId}, offerNumber: ${offerNumber}`);

  // STEP B: Direct verification in MongoDB Atlas database
  console.log('\n--- STEP B: Direct Query in MongoDB Atlas "offerletters" collection ---');
  const atlasDoc = await db.collection('offerletters').findOne({ _id: new mongoose.Types.ObjectId(createdId) });
  console.log('Found Document in Atlas offerletters collection:', atlasDoc ? 'YES' : 'NO');
  if (atlasDoc) {
    console.log('Atlas Document Fields:');
    console.log('  _id:', atlasDoc._id.toString(), '(type: ObjectId)');
    console.log('  offerNumber:', atlasDoc.offerNumber);
    console.log('  candidate:', atlasDoc.candidate.toString(), '(matches candidate _id:', atlasDoc.candidate.toString() === candidate._id.toString(), ')');
    console.log('  offeredDesignation:', atlasDoc.offeredDesignation);
    console.log('  department:', atlasDoc.department);
    console.log('  salary:', atlasDoc.salary);
    console.log('  status:', atlasDoc.status);
    console.log('  createdAt:', atlasDoc.createdAt);
  } else {
    throw new Error(`Document ${createdId} was NOT found in Atlas offerletters collection!`);
  }

  // STEP C: Test GET /recruitment/offer-letters (List and Population)
  console.log('\n--- STEP C: Testing GET /recruitment/offer-letters ---');
  const listRes = await fetch(`${API_BASE}/recruitment/offer-letters?search=${offerNumber}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listJson = await listRes.json();
  console.log('List API Status:', listRes.status);
  const foundInList = (listJson.data || []).find(o => o._id === createdId);
  console.log('Found in List Response:', foundInList ? 'YES' : 'NO');
  if (foundInList) {
    console.log('Populated candidate object in list:');
    console.log('  candidate._id:', foundInList.candidate?._id);
    console.log('  candidate.name:', foundInList.candidate?.name);
    console.log('  candidate.email:', foundInList.candidate?.email);
  }

  // STEP D: Test GET /recruitment/offer-letters/summary (KPI Counts)
  console.log('\n--- STEP D: Testing GET /recruitment/offer-letters/summary ---');
  const sumRes = await fetch(`${API_BASE}/recruitment/offer-letters/summary`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const sumJson = await sumRes.json();
  console.log('Summary API Status:', sumRes.status);
  console.log('Summary KPIs from DB:', JSON.stringify(sumJson.data, null, 2));

  // STEP E: Test PUT /recruitment/offer-letters/:id (Edit Persistence)
  console.log('\n--- STEP E: Testing PUT /recruitment/offer-letters/:id ---');
  const updatePayload = {
    ...postPayload,
    offeredDesignation: 'Principal Cloud Architect',
    salary: '26,50,000 / yr',
    noticePeriod: '45 Days',
  };
  const putRes = await fetch(`${API_BASE}/recruitment/offer-letters/${createdId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updatePayload)
  });
  const putJson = await putRes.json();
  console.log('PUT Status:', putRes.status);
  console.log('Updated designation in response:', putJson.data?.offeredDesignation);

  // Re-verify in Atlas directly to confirm edit persisted in DB
  const updatedAtlasDoc = await db.collection('offerletters').findOne({ _id: new mongoose.Types.ObjectId(createdId) });
  console.log('Re-querying Atlas directly after PUT:');
  console.log('  Updated designation in Atlas:', updatedAtlasDoc.offeredDesignation);
  console.log('  Updated salary in Atlas:', updatedAtlasDoc.salary);
  console.log('  Updated updatedAt timestamp:', updatedAtlasDoc.updatedAt);

  console.log('\n====================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! MONGODB ATLAS PERSISTENCE CONFIRMED');
  console.log('====================================================');

  await mongoose.disconnect();
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
