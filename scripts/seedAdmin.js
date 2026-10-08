const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function seedAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = process.argv[2] || 'admin@commutesync.com';
  const existing = await User.findOne({ email });
  if (existing) {
    existing.isAdmin = true;
    await existing.save();
    console.log(`Promoted ${email} to admin`);
  } else {
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('admin123', salt);
    await User.create({
      username: 'admin',
      email,
      password,
      role: 'both',
      isAdmin: true,
      homeLocation: { address: '123 Admin St' },
      workplaceLocation: { address: 'Corporate HQ' }
    });
    console.log(`Created admin user: ${email} / admin123`);
  }
  await mongoose.disconnect();
}

seedAdmin().catch(console.error);
