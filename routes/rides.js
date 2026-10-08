const express = require('express');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const router = express.Router();

let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

function emitRideUpdate(ride) {
  if (io) {
    io.to(`ride:${ride._id}`).emit('ride_updated', ride);
    io.emit('rides_changed');
  }
}

router.post('/', auth, async (req, res) => {
  try {
    if (!['driver', 'both'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only drivers can create ride offers' });
    }

    const { origin, destination, departureTime, vehicleCapacity, notes } = req.body;
    if (!origin?.address || !destination?.address || !departureTime || !vehicleCapacity) {
      return res.status(400).json({ error: 'Origin, destination, departure time, and capacity are required' });
    }

    const capacity = Number(vehicleCapacity);
    if (capacity < 1) return res.status(400).json({ error: 'Vehicle capacity must be at least 1' });

    const ride = new Ride({
      driver: req.user.id,
      origin,
      destination,
      departureTime: new Date(departureTime),
      vehicleCapacity: capacity,
      availableSeats: capacity - 1,
      notes: notes || ''
    });

    await ride.save();
    await ride.populate('driver', 'username email rating role');

    if (io) io.emit('rides_changed');
    res.status(201).json(ride);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ride', details: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { origin, destination, date, status } = req.query;
    const filter = {};

    if (status) filter.status = status;
    else filter.status = { $in: ['scheduled', 'in_progress'] };

    if (origin) filter['origin.address'] = { $regex: origin, $options: 'i' };
    if (destination) filter['destination.address'] = { $regex: destination, $options: 'i' };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.departureTime = { $gte: start, $lte: end };
    } else {
      filter.departureTime = { $gte: new Date() };
    }

    const rides = await Ride.find(filter)
      .populate('driver', 'username email rating role')
      .populate('confirmedPassengers', 'username rating')
      .sort({ departureTime: 1 });

    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const rides = await Ride.find({ driver: req.user.id })
      .populate('driver', 'username email rating')
      .populate('confirmedPassengers', 'username rating')
      .sort({ departureTime: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your rides' });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    const myRides = await Ride.find({
      $or: [
        { driver: req.user.id },
        { confirmedPassengers: req.user.id }
      ]
    })
      .populate('driver', 'username email rating')
      .populate('confirmedPassengers', 'username rating')
      .sort({ departureTime: -1 })
      .limit(50);

    const myBookings = await Booking.find({ passenger: req.user.id })
      .populate({
        path: 'ride',
        populate: { path: 'driver', select: 'username email rating' }
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ rides: myRides, bookings: myBookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driver', 'username email rating role')
      .populate('confirmedPassengers', 'username rating');
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ride' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (String(ride.driver) !== req.user.id) {
      return res.status(403).json({ error: 'Only the driver can edit this ride' });
    }
    if (ride.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled rides can be edited' });
    }

    const { origin, destination, departureTime, vehicleCapacity, notes } = req.body;
    const confirmedCount = ride.confirmedPassengers.length;

    if (origin) ride.origin = { ...ride.origin, ...origin };
    if (destination) ride.destination = { ...ride.destination, ...destination };
    if (departureTime) ride.departureTime = new Date(departureTime);
    if (notes !== undefined) ride.notes = notes;

    if (vehicleCapacity) {
      const capacity = Number(vehicleCapacity);
      const minSeats = capacity - 1 - confirmedCount;
      if (minSeats < 0) {
        return res.status(400).json({ error: 'Capacity too low for existing confirmed passengers' });
      }
      ride.vehicleCapacity = capacity;
      ride.availableSeats = minSeats;
    }

    await ride.save();
    await ride.populate('driver', 'username email rating');
    await ride.populate('confirmedPassengers', 'username rating');

    emitRideUpdate(ride);
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ride', details: error.message });
  }
});

async function cancelRide(req, res) {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (String(ride.driver) !== req.user.id) {
      return res.status(403).json({ error: 'Only the driver can cancel this ride' });
    }
    if (!['scheduled', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({ error: 'Ride cannot be cancelled' });
    }

    ride.status = 'cancelled';
    await ride.save();

    await Booking.updateMany(
      { ride: ride._id, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled' }
    );

    if (io) {
      io.to(`ride:${ride._id}`).emit('ride_cancelled', ride);
      io.to(`ride:${ride._id}`).emit('notification', {
        type: 'ride_cancelled',
        message: 'Ride has been cancelled by the driver',
        rideId: ride._id
      });
      io.emit('rides_changed');
    }

    res.json({ message: 'Ride cancelled', ride });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel ride' });
  }
}

router.delete('/:id', auth, cancelRide);
router.post('/:id/cancel', auth, cancelRide);

router.post('/:id/start', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (String(ride.driver) !== req.user.id) {
      return res.status(403).json({ error: 'Only the driver can start this ride' });
    }
    if (ride.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled rides can be started' });
    }

    ride.status = 'in_progress';
    await ride.save();
    await ride.populate('driver', 'username email rating');
    await ride.populate('confirmedPassengers', 'username rating');

    if (io) {
      io.to(`ride:${ride._id}`).emit('ride_status_changed', ride);
      io.to(`ride:${ride._id}`).emit('notification', {
        type: 'ride_started',
        message: 'Your ride has started!',
        rideId: ride._id
      });
      io.emit('rides_changed');
    }

    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start ride' });
  }
});

router.post('/:id/complete', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (String(ride.driver) !== req.user.id) {
      return res.status(403).json({ error: 'Only the driver can complete this ride' });
    }
    if (ride.status !== 'in_progress') {
      return res.status(400).json({ error: 'Only in-progress rides can be completed' });
    }

    ride.status = 'completed';
    await ride.save();

    const User = require('../models/User');
    await User.findByIdAndUpdate(ride.driver, { $inc: { completedRides: 1 } });
    for (const passengerId of ride.confirmedPassengers) {
      await User.findByIdAndUpdate(passengerId, { $inc: { completedRides: 1 } });
    }

    await ride.populate('driver', 'username email rating');
    await ride.populate('confirmedPassengers', 'username rating');

    if (io) {
      io.to(`ride:${ride._id}`).emit('ride_status_changed', ride);
      io.to(`ride:${ride._id}`).emit('notification', {
        type: 'ride_completed',
        message: 'Your ride has been completed. Please rate your experience!',
        rideId: ride._id
      });
      io.emit('rides_changed');
    }

    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete ride' });
  }
});

module.exports = { router, setSocketIO };
