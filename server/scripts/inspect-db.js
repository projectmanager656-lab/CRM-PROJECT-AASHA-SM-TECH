import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: './.env' });

const uri = process.env.MONGODB_URI;

async function inspect() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('Connected successfully!');
  const db = mongoose.connection.db;

  const departments = await db.collection('departments').find({}).toArray();
  const employees = await db.collection('users').find({ role: 'employee' }).toArray();
  const allUsers = await db.collection('users').find({}).project({
    email: 1,
    role: 1,
    department: 1,
    firstName: 1,
    lastName: 1,
    createdAt: 1,
    employmentStatus: 1,
    isActive: 1,
    jobDetails: 1
  }).toArray();
  
  const collections = await db.listCollections().toArray();
  const payrollColName = collections.find(c => c.name === 'payrolls' || c.name === 'payroll')?.name || 'payroll';
  const payrolls = await db.collection(payrollColName).find({}).toArray();

  const dump = {
    departments,
    employees,
    allUsers,
    payrolls
  };

  fs.writeFileSync('C:/Users/YASH/.gemini/antigravity-ide/brain/566a521a-563b-436d-9e2b-84c615f91964/scratch/db-dump.json', JSON.stringify(dump, null, 2));
  console.log('Dump saved successfully to db-dump.json');

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
