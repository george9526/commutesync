const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

function formatUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    homeLocation: user.homeLocation,
    workplaceLocation: user.workplaceLocation,
    commuteSchedule: user.commuteSchedule,
    rating: typeof user.rating === 'object' ? user.rating.average || 5 : user.rating,
    completedRides: user.completedRides || 0,
    isAdmin: user.isAdmin
  };
}

function toLocation(val) {
  if (!val) return {};
  if (typeof val === 'string') return { address: val };
  return val;
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, homeLocation, workplaceLocation, commuteSchedule } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'both',
      homeLocation: toLocation(homeLocation),
      workplaceLocation: toLocation(workplaceLocation),
      commuteSchedule: commuteSchedule || {}
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register', details: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: formatUser(user)
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { role, homeLocation, workplaceLocation, commuteSchedule } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (role) user.role = role;
    if (homeLocation) user.homeLocation = { ...user.homeLocation, ...homeLocation };
    if (workplaceLocation) user.workplaceLocation = { ...user.workplaceLocation, ...workplaceLocation };
    if (commuteSchedule) user.commuteSchedule = { ...user.commuteSchedule, ...commuteSchedule };

    await user.save();
    res.json({ message: 'Profile updated', user: formatUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

router.post('/rate/:userId', auth, async (req, res) => {
  try {
    const { score } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newCount = (user.ratingsCount || 0) + 1;
    const oldAvg = user.rating || 5;
    user.rating = Math.round(((oldAvg * (newCount - 1)) + score) / newCount * 10) / 10;
    user.ratingsCount = newCount;
    await user.save();

    res.json({ message: 'Rating submitted', rating: user.rating, ratingsCount: user.ratingsCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

module.exports = router;
