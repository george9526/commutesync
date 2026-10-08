const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { connectDatabase } = require('./config/database');
const { seedIfEmpty } = require('./config/seed');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
const { router: rideRoutes, setSocketIO: setRideIO } = require('./routes/rides');
const { router: bookingRoutes, setSocketIO: setBookingIO } = require('./routes/bookings');
const { router: messageRoutes, setSocketIO: setMessageIO } = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const { setupSocketIO } = require('./services/socketHandler');

setRideIO(io);
setBookingIO(io);
setMessageIO(io);
setupSocketIO(io);

app.use('/api/users', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CommuteSync',
    db: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

async function start() {
  const usedMemoryDb = await connectDatabase();
  if (usedMemoryDb || process.env.AUTO_SEED === 'true') {
    await seedIfEmpty();
  }

  server.listen(PORT, () => {
    console.log(`CommuteSync server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
