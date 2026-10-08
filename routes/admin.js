const express = require('express');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Report = require('../models/Report');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

router.get('/stats', auth, admin, async (req, res) => {
  try {
    const [userCount, activeRides, openReports, completedRides] = await Promise.all([
      User.countDocuments(),
      Ride.countDocuments({ status: { $in: ['scheduled', 'in_progress'] } }),
      Report.countDocuments({ status: 'open' }),
      Ride.countDocuments({ status: 'completed' })
    ]);
    res.json({ userCount, activeRides, openReports, completedRides });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/rides', auth, admin, async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate('driver', 'username email')
      .populate('confirmedPassengers', 'username')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

router.get('/users', auth, admin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/reports', auth, admin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'username email')
      .populate('reportedUser', 'username email')
      .populate('ride', 'origin destination departureTime')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.put('/reports/:id', auth, admin, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (status) report.status = status;
    if (adminNotes !== undefined) report.adminNotes = adminNotes;
    await report.save();

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

router.post('/reports', auth, async (req, res) => {
  try {
    const { reportedUserId, rideId, reason, description } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const report = new Report({
      reporter: req.user.id,
      reportedUser: reportedUserId || undefined,
      ride: rideId || undefined,
      reason,
      description: description || ''
    });
    await report.save();
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;
