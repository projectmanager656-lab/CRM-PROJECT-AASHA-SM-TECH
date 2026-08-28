const mongoose = require('mongoose');

async function findAdmin() {
  await mongoose.connect('mongodb://localhost:27017/it-management-system');
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({ role: 'super_admin' }).toArray();
  console.log('Super Admins:', users.map(u => ({ email: u.email, role: u.role })));
  process.exit(0);
}
findAdmin();
