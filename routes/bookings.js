const express = require('express');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const router = express.Router();

let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

function notifyUser(userId, payload) {
  if (io) io.to(`user:${userId}`).emit('notification', payload);
}

router.post('/request', auth, async (req, res) => {
  try {
    const { rideId, seatsRequested = 1 } = req.body;
    const seats = Number(seatsRequested);

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'scheduled') {
      return res.status(400).json({ error: 'Ride is not available for booking' });
    }
    if (String(ride.driver) === req.user.id) {
      return res.status(400).json({ error: 'Cannot book your own ride' });
    }
    if (ride.availableSeats < seats) {
      return res.status(409).json({ error: 'Not enough seats available' });
    }

    const existing = await Booking.findOne({ ride: rideId, passenger: req.user.id });
    if (existing && ['pending', 'confirmed'].includes(existing.status)) {
      return res.status(400).json({ error: 'You already have an active booking for this ride' });
    }

    let booking;
    if (existing) {
      existing.status = 'pending';
      existing.seatsRequested = seats;
      await existing.save();
      booking = existing;
    } else {
      booking = await Booking.create({ ride: rideId, passenger: req.user.id, seatsRequested: seats });
    }

    await booking.populate('passenger', 'username email rating');
    await booking.populate({
      path: 'ride',
      populate: { path: 'driver', select: 'username email' }
    });

    notifyUser(ride.driver, {
      type: 'booking_request',
      message: `${booking.passenger.username} requested ${seats} seat(s)`,
      bookingId: booking._id,
      rideId: ride._id
    });

    if (io) {
      io.to(`ride:${rideId}`).emit('booking_requested', booking);
      io.emit('rides_changed');
    }

    res.status(201).json(booking);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'You already have a booking for this ride' });
    }
    res.status(500).json({ error: 'Failed to request booking', details: error.message });
  }
});

router.get('/pending', auth, async (req, res) => {
  try {
    const myRides = await Ride.find({ driver: req.user.id, status: 'scheduled' }).select('_id');
    const rideIds = myRides.map(r => r._id);

    const bookings = await Booking.find({ ride: { $in: rideIds }, status: 'pending' })
      .populate('passenger', 'username email rating homeLocation workplaceLocation')
      .populate('ride', 'origin destination departureTime availableSeats')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending bookings' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ passenger: req.user.id })
      .populate({
        path: 'ride',
        populate: { path: 'driver', select: 'username email rating' }
      })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your bookings' });
  }
});

router.post('/:id/accept', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking is not pending' });
    }

    const ride = await Ride.findOneAndUpdate(
      {
        _id: booking.ride,
        driver: req.user.id,
        status: 'scheduled',
        availableSeats: { $gte: booking.seatsRequested }
      },
      {
        $inc: { availableSeats: -booking.seatsRequested },
        $addToSet: { confirmedPassengers: booking.passenger }
      },
      { new: true }
    );

    if (!ride) {
      return res.status(409).json({ error: 'No seats available — another booking may have been accepted first' });
    }

    booking.status = 'confirmed';
    await booking.save();

    await booking.populate('passenger', 'username email rating');
    await booking.populate({
      path: 'ride',
      populate: [
        { path: 'driver', select: 'username email rating' },
        { path: 'confirmedPassengers', select: 'username rating' }
      ]
    });

    notifyUser(booking.passenger, {
      type: 'booking_confirmed',
      message: 'Your booking has been confirmed!',
      bookingId: booking._id,
      rideId: booking.ride._id
    });

    if (io) {
      io.to(`ride:${booking.ride._id}`).emit('booking_confirmed', booking);
      io.to(`ride:${booking.ride._id}`).emit('ride_updated', booking.ride);
      io.emit('rides_changed');
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept booking', details: error.message });
  }
});

router.post('/:id/reject', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('ride');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (String(booking.ride.driver) !== req.user.id) {
      return res.status(403).json({ error: 'Only the driver can reject bookings' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking is not pending' });
    }

    booking.status = 'rejected';
    await booking.save();

    notifyUser(booking.passenger, {
      type: 'booking_rejected',
      message: 'Your booking request was declined',
      bookingId: booking._id,
      rideId: booking.ride._id
    });

    if (io) {
      io.to(`ride:${booking.ride._id}`).emit('booking_rejected', booking);
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (String(booking.passenger) !== req.user.id) {
      return res.status(403).json({ error: 'Only the passenger can cancel this booking' });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }

    if (booking.status === 'confirmed') {
      await Ride.findOneAndUpdate(
        { _id: booking.ride },
        {
          $inc: { availableSeats: booking.seatsRequested },
          $pull: { confirmedPassengers: booking.passenger }
        }
      );
    }

    booking.status = 'cancelled';
    await booking.save();

    const ride = await Ride.findById(booking.ride);

    if (io) {
      io.to(`ride:${booking.ride}`).emit('booking_cancelled', booking);
      if (ride) io.to(`ride:${booking.ride}`).emit('ride_updated', ride);
      io.emit('rides_changed');
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = { router, setSocketIO };
