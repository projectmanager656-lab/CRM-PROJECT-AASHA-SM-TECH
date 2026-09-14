import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import 'dotenv/config';
import mongoose from 'mongoose';

async function inspectExpensesPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const sampleExpense = await db.collection('expenses').findOne();
    console.log('\n--- expenses sample ---');
    console.log(sampleExpense);

    const samplePayment = await db.collection('payments').findOne();
    console.log('\n--- payments sample ---');
    console.log(samplePayment);

    const samplePayroll = await db.collection('payroll').findOne();
    console.log('\n--- payroll sample ---');
    console.log(samplePayroll);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

inspectExpensesPayments();
