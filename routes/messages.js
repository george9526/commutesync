const express = require('express');
const Message = require('../models/Message');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const router = express.Router();

let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

async function canAccessChat(userId, rideId) {
  const ride = await Ride.findById(rideId);
  if (!ride) return { allowed: false, ride: null };

  const isDriver = String(ride.driver) === userId;
  const isConfirmed = ride.confirmedPassengers.some(p => String(p) === userId);

  return { allowed: isDriver || isConfirmed, ride };
}

router.get('/rides/available', auth, async (req, res) => {
  try {
    const asDriver = await Ride.find({
      driver: req.user.id,
      status: { $in: ['scheduled', 'in_progress'] },
      confirmedPassengers: { $exists: true, $ne: [] }
    }).select('origin destination departureTime status');

    const confirmedBookings = await Booking.find({
      passenger: req.user.id,
      status: 'confirmed'
    }).populate({
      path: 'ride',
      match: { status: { $in: ['scheduled', 'in_progress'] } },
      select: 'origin destination departureTime status driver'
    });

    const asPassenger = confirmedBookings
      .filter(b => b.ride)
      .map(b => b.ride);

    const all = [...asDriver, ...asPassenger];
    const unique = all.filter((ride, i, arr) =>
      arr.findIndex(r => String(r._id) === String(ride._id)) === i
    );

    res.json(unique);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat rides' });
  }
});

router.get('/:rideId', auth, async (req, res) => {
  try {
    const { allowed } = await canAccessChat(req.user.id, req.params.rideId);
    if (!allowed) {
      return res.status(403).json({ error: 'Chat access requires confirmed booking' });
    }

    const messages = await Message.find({ ride: req.params.rideId })
      .populate('sender', 'username')
      .sort({ createdAt: 1 })
      .limit(200);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:rideId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    const { allowed, ride } = await canAccessChat(req.user.id, req.params.rideId);
    if (!allowed) {
      return res.status(403).json({ error: 'Chat access requires confirmed booking' });
    }
    if (!['scheduled', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({ error: 'Chat is not available for this ride' });
    }

    const message = new Message({
      ride: req.params.rideId,
      sender: req.user.id,
      content: content.trim()
    });
    await message.save();
    await message.populate('sender', 'username');

    if (io) {
      io.to(`ride:${req.params.rideId}`).emit('new_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = { router, setSocketIO };
