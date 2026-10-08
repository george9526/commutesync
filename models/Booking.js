const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  seatsRequested: { type: Number, default: 1, min: 1 }
}, { timestamps: true });

bookingSchema.index({ ride: 1, passenger: 1 }, { unique: true });
bookingSchema.index({ passenger: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
