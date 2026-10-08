const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Ride = require('../models/Ride');

const DEMO_USERS = [
  { username: 'alice', email: 'alice@company.com', password: 'demo1234', role: 'driver', home: 'Downtown Apt 4B', work: 'Corporate HQ Tower' },
  { username: 'bob', email: 'bob@company.com', password: 'demo1234', role: 'passenger', home: 'Riverside District', work: 'Corporate HQ Tower' },
  { username: 'carol', email: 'carol@company.com', password: 'demo1234', role: 'both', home: 'Westside Park', work: 'Corporate HQ Tower' }
];

async function seedDemo() {
  await mongoose.connect(process.env.MONGO_URI);
  const salt = await bcrypt.genSalt(10);

  const users = {};
  for (const u of DEMO_USERS) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      user = await User.create({
        username: u.username,
        email: u.email,
        password: await bcrypt.hash(u.password, salt),
        role: u.role,
        homeLocation: { address: u.home },
        workplaceLocation: { address: u.work },
        commuteSchedule: { departureTime: '08:00', returnTime: '17:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }
      });
      console.log(`Created user: ${u.email} / ${u.password}`);
    }
    users[u.username] = user;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const existing = await Ride.countDocuments({ driver: users.alice._id });
  if (existing === 0) {
    await Ride.create({
      driver: users.alice._id,
      origin: { address: 'Downtown Apt 4B' },
      destination: { address: 'Corporate HQ Tower' },
      departureTime: tomorrow,
      vehicleCapacity: 4,
      availableSeats: 3,
      notes: 'Morning commute — AC on, music optional'
    });
    console.log('Created sample ride from Alice');
  }

  await mongoose.disconnect();
  console.log('Demo seed complete.');
}

seedDemo().catch(console.error);
