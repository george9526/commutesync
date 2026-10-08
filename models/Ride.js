const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number }
}, { _id: false });

const rideSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  origin: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  departureTime: { type: Date, required: true },
  vehicleCapacity: { type: Number, required: true, min: 1 },
  availableSeats: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  notes: { type: String, default: '' },
  confirmedPassengers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

rideSchema.index({ status: 1, departureTime: 1 });
rideSchema.index({ driver: 1, status: 1 });

module.exports = mongoose.model('Ride', rideSchema);
