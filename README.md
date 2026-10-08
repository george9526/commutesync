# CommuteSync

Real-Time Multi-User Corporate Commute Coordination System — enables employees to coordinate carpooling with real-time seat booking, chat, and ride lifecycle tracking.

## Features

- **Authentication & Profiles** — Register/login with role (Driver, Passenger, Both), home/work locations, commute schedule, and ratings
- **Ride Management** — Drivers create, edit, and cancel rides with route, departure time, and capacity
- **Real-Time Booking** — Passengers search and request seats; atomic concurrency control prevents overbooking
- **Driver Approval** — Accept/reject booking requests with instant WebSocket updates
- **Ride Chat** — Real-time messaging between driver and confirmed passengers per ride
- **Lifecycle Dashboard** — Track rides through Scheduled → In Progress → Completed → Cancelled
- **Admin Panel** — Monitor active rides, users, and manage reports/disputes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express 5 |
| Real-time | Socket.IO (WebSockets) |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (optional — the server falls back to an in-memory database if MongoDB is not running)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=5001
MONGO_URI=mongodb://localhost:27017/commutesync
JWT_SECRET=your_super_secret_jwt_key_change_in_production
```

### 2. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 3. Start the backend

```bash
npm run dev
```

On first run without MongoDB, demo data is seeded automatically:

| Account | Password | Role |
|---------|----------|------|
| alice@company.com | demo1234 | Driver |
| bob@company.com | demo1234 | Passenger |
| carol@company.com | demo1234 | Both |
| admin@commutesync.com | admin123 | Admin |

### 4. Start the frontend (separate terminal)

```bash
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

## Creating an Admin User (with MongoDB)

Register a normal account, then run:

```bash
npm run seed:admin -- your@email.com
```

Or in MongoDB:

```javascript
db.users.updateOne({ email: "admin@company.com" }, { $set: { isAdmin: true } })
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register |
| POST | `/api/users/login` | Login |
| PUT | `/api/users/profile` | Update profile |
| GET | `/api/rides` | Search available rides |
| POST | `/api/rides` | Create ride offer |
| POST | `/api/bookings/request` | Request a seat |
| POST | `/api/bookings/:id/accept` | Driver accepts booking |
| GET/POST | `/api/messages/:rideId` | Chat messages |
| GET | `/api/admin/*` | Admin endpoints |

## WebSocket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `rides_changed` | Server → Client | Refresh ride lists |
| `booking_confirmed` | Server → Client | Booking accepted |
| `ride_status_changed` | Server → Client | Trip started/completed |
| `new_message` | Server → Client | Chat message |
| `notification` | Server → Client | User notifications |
| `send_message` | Client → Server | Send chat message |
| `join_ride` | Client → Server | Join ride room |

## Concurrency Control

Seat acceptance uses MongoDB atomic `findOneAndUpdate` — the `availableSeats` field is decremented only when `availableSeats >= seatsRequested`, so simultaneous accept requests cannot overbook the last seat. Pending booking requests do not hold seats; seats are reserved only upon driver acceptance.
