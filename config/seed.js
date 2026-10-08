const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Ride = require('../models/Ride');

function hoursFromNow(h) {
  const d = new Date(); d.setHours(d.getHours() + h); return d;
}

function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(8, 0, 0, 0); return d;
}

async function seedIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) return;

  const salt = await bcrypt.genSalt(10);
  const hash = (pw) => bcrypt.hash(pw, salt);

  const alice = await User.create({
    username: 'alice', email: 'alice@company.com', password: await hash('demo1234'),
    role: 'driver', completedRides: 12,
    homeLocation: { address: 'Downtown Apt 4B, 245 Main St' },
    workplaceLocation: { address: 'Corporate HQ Tower, 1000 Business Blvd' },
    commuteSchedule: { departureTime: '08:00', returnTime: '17:30' }
  });

  const bob = await User.create({
    username: 'bob', email: 'bob@company.com', password: await hash('demo1234'),
    role: 'passenger', completedRides: 5,
    homeLocation: { address: 'Riverside District, 42 River Rd' },
    workplaceLocation: { address: 'Corporate HQ Tower, 1000 Business Blvd' },
    commuteSchedule: { departureTime: '08:15', returnTime: '17:30' }
  });

  const carol = await User.create({
    username: 'carol', email: 'carol@company.com', password: await hash('demo1234'),
    role: 'both', completedRides: 8,
    homeLocation: { address: 'Westside Park, 78 Park Ave' },
    workplaceLocation: { address: 'Corporate HQ Tower, 1000 Business Blvd' },
    commuteSchedule: { departureTime: '08:00', returnTime: '17:00' }
  });

  const dave = await User.create({
    username: 'dave', email: 'dave@company.com', password: await hash('demo1234'),
    role: 'driver', completedRides: 3,
    homeLocation: { address: 'Northwood Estates, 15 Cedar Ln' },
    workplaceLocation: { address: 'Tech Park Building B, 500 Innovation Dr' },
    commuteSchedule: { departureTime: '07:45', returnTime: '18:00' }
  });

  await User.create({
    username: 'admin', email: 'admin@commutesync.com', password: await hash('admin123'),
    role: 'both', isAdmin: true,
    homeLocation: { address: '123 Admin St' },
    workplaceLocation: { address: 'Corporate HQ Tower' }
  });

  const now = new Date();

  const aliceRides = [
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: daysFromNow(1), vehicleCapacity: 4, availableSeats: 3, notes: 'Morning commute — AC on, music optional, coffee stop possible' },
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: daysFromNow(2), vehicleCapacity: 4, availableSeats: 2, notes: 'Early bird — leaving at 7:30, quiet ride preferred' },
    { origin: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, destination: { address: 'Downtown Apt 4B, 245 Main St' }, departureTime: (() => { const d = daysFromNow(1); d.setHours(17, 30, 0, 0); return d; })(), vehicleCapacity: 4, availableSeats: 3, notes: 'Evening return — same route back' },
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: hoursFromNow(1), vehicleCapacity: 4, availableSeats: 2, status: 'in_progress', notes: 'Leaving now! Can pick up along Main St' },
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: (() => { const d = new Date(); d.setDate(d.getDate() - 3); d.setHours(8, 0, 0, 0); return d; })(), vehicleCapacity: 4, availableSeats: 0, status: 'completed', notes: 'Smooth ride, arrived 8:45' },
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: (() => { const d = new Date(); d.setDate(d.getDate() - 5); d.setHours(8, 0, 0, 0); return d; })(), vehicleCapacity: 4, availableSeats: 0, status: 'completed', notes: 'Traffic was light today' },
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: (() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(8, 0, 0, 0); return d; })(), vehicleCapacity: 4, availableSeats: 0, status: 'completed' },
    { origin: { address: 'Downtown Apt 4B, 245 Main St' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: (() => { const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(8, 0, 0, 0); return d; })(), vehicleCapacity: 4, availableSeats: 4, status: 'cancelled', notes: 'Sick day — cancelled' },
  ];

  const carolRides = [
    { origin: { address: 'Westside Park, 78 Park Ave' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: daysFromNow(1), vehicleCapacity: 3, availableSeats: 2, notes: 'Morning ride, prefer podcast over music' },
    { origin: { address: 'Westside Park, 78 Park Ave' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: daysFromNow(3), vehicleCapacity: 3, availableSeats: 2, notes: 'Flexible route — can detour for pickup' },
    { origin: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, destination: { address: 'Westside Park, 78 Park Ave' }, departureTime: (() => { const d = daysFromNow(1); d.setHours(17, 0, 0, 0); return d; })(), vehicleCapacity: 3, availableSeats: 2, notes: 'Leaving right at 5pm' },
    { origin: { address: 'Westside Park, 78 Park Ave' }, destination: { address: 'Corporate HQ Tower, 1000 Business Blvd' }, departureTime: (() => { const d = new Date(); d.setDate(d.getDate() - 4); d.setHours(8, 0, 0, 0); return d; })(), vehicleCapacity: 3, availableSeats: 0, status: 'completed', notes: 'Great company, good conversation' },
  ];

  const daveRides = [
    { origin: { address: 'Northwood Estates, 15 Cedar Ln' }, destination: { address: 'Tech Park Building B, 500 Innovation Dr' }, departureTime: daysFromNow(1), vehicleCapacity: 5, availableSeats: 4, notes: 'SUV, plenty of trunk space' },
    { origin: { address: 'Northwood Estates, 15 Cedar Ln' }, destination: { address: 'Tech Park Building B, 500 Innovation Dr' }, departureTime: daysFromNow(2), vehicleCapacity: 5, availableSeats: 3, notes: 'Going via Highway 101, faster route' },
  ];

  const allRideData = [
    ...aliceRides.map(r => ({ ...r, driver: alice._id })),
    ...carolRides.map(r => ({ ...r, driver: carol._id })),
    ...daveRides.map(r => ({ ...r, driver: dave._id })),
  ];

  for (const r of allRideData) {
    await Ride.create(r);
  }

  console.log('Seeded 5 demo users (password: demo1234) and ' + allRideData.length + ' rides');
  console.log('Admin: admin@commutesync.com / admin123');
}

module.exports = { seedIfEmpty };
