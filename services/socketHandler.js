const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

function setupSocketIO(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    socket.join(`user:${socket.userId}`);

    socket.on('join_ride', async (rideId) => {
      try {
        const ride = await Ride.findById(rideId);
        if (!ride) return;

        const isDriver = String(ride.driver) === socket.userId;
        const isConfirmed = ride.confirmedPassengers.some(p => String(p) === socket.userId);

        if (isDriver || isConfirmed) {
          socket.join(`ride:${rideId}`);
        }
      } catch (err) {
        console.error('join_ride error:', err.message);
      }
    });

    socket.on('leave_ride', (rideId) => {
      socket.leave(`ride:${rideId}`);
    });

    socket.on('send_message', async ({ rideId, content }) => {
      try {
        if (!content?.trim()) return;

        const ride = await Ride.findById(rideId);
        if (!ride) return;

        const isDriver = String(ride.driver) === socket.userId;
        const isConfirmed = ride.confirmedPassengers.some(p => String(p) === socket.userId);
        if (!isDriver && !isConfirmed) return;
        if (!['scheduled', 'in_progress'].includes(ride.status)) return;

        const message = new Message({
          ride: rideId,
          sender: socket.userId,
          content: content.trim()
        });
        await message.save();
        await message.populate('sender', 'username');

        io.to(`ride:${rideId}`).emit('new_message', message);
      } catch (err) {
        console.error('send_message error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
    });
  });
}

module.exports = { setupSocketIO };
