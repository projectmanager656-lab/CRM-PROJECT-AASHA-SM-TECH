import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import 'dotenv/config';
import mongoose from 'mongoose';

async function inspectExactSchemas() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('--- ALL 4 EXPENSES ---');
    const expenses = await db.collection('expenses').find().toArray();
    console.log(JSON.stringify(expenses, null, 2));

    console.log('--- ALL 6 PAYMENTS ---');
    const payments = await db.collection('payments').find().toArray();
    console.log(JSON.stringify(payments, null, 2));

    console.log('--- FNF SETTLEMENT ---');
    const fnf = await db.collection('fullandfinalsettlements').find().toArray();
    console.log(JSON.stringify(fnf, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

inspectExactSchemas();
