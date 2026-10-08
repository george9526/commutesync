const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({ address: String, lat: Number, lng: Number }, { _id: false });
const scheduleSchema = new mongoose.Schema({ departureTime: String, returnTime: String }, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: 'both', enum: ['driver', 'passenger', 'both'] },
  homeLocation: { type: locationSchema, default: {} },
  workplaceLocation: { type: locationSchema, default: {} },
  commuteSchedule: { type: scheduleSchema, default: {} },
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  ratingsCount: { type: Number, default: 0 },
  completedRides: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
