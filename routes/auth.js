const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Admin signup (or initial setup) and teacher signup by admin
// @access  Public / Admin
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, schoolId } = req.body;
    if (!name || !email || !password || !schoolId) {
      return res.status(400).json({ message: 'Name, email, password, and schoolId are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Check if any user already exists to determine if we should allow admin signup
    const userCount = await User.countDocuments({});
    
    // Determine the role: first user is always admin, others depend on role sent
    let finalRole = 'teacher';
    if (userCount === 0) {
      finalRole = 'admin'; // First user must be admin
    } else if (role === 'admin') {
      // If not the first user but trying to be admin
      return res.status(400).json({ message: 'An owner account already exists. Only one owner is allowed.' });
    } else {
      finalRole = 'teacher';
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: finalRole,
      schoolId
    });

    await user.save();

    res.json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (admin/teacher)
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body; // Added role to destructuring

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if the role matches the requested login section
    if (role && user.role !== role) {
      const roleDisplayName = role === 'admin' ? 'Owner' : 'Staff';
      return res.status(403).json({ 
        message: `This account is not registered as ${roleDisplayName}. Please login in the correct section.` 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = { user: { id: user.id, role: user.role, schoolId: user.schoolId } };

    jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({ 
        token, 
        user: { 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          schoolId: user.schoolId,
          schoolName: user.schoolName,
          schoolTagline: user.schoolTagline
        } 
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/create-teacher
// @desc    Admin creates teacher
// @access  Private (admin)
router.post('/create-teacher', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name, email, password } = req.body;
    const schoolId = req.user.schoolId;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const teacher = new User({
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: 'teacher',
      schoolId
    });

    await teacher.save();
    res.json({ message: 'Teacher account created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/school-settings
// @desc    Update school settings (admin only)
// @access  Private (admin)
router.post('/school-settings', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { schoolName, schoolTagline } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { schoolName, schoolTagline },
      { new: true }
    );

    res.json({
      schoolName: user.schoolName,
      schoolTagline: user.schoolTagline
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/school-settings
// @desc    Get school settings (any logged in user of that school)
// @access  Private
router.get('/school-settings', auth, async (req, res) => {
  try {
    // Since there's only one owner globally, find the admin user to get the settings
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(404).json({ message: 'School settings not found' });
    }

    res.json({
      schoolName: admin.schoolName,
      schoolTagline: admin.schoolTagline
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/check-admin
// @desc    Check if any user exists (the first user must be admin)
// @access  Public
router.get('/check-admin', async (req, res) => {
  try {
    const userExists = await User.findOne({}); // Check for ANY user
    res.json({ exists: !!userExists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/school-settings-public
// @desc    Get basic school info (for signup page)
// @access  Public
router.get('/school-settings-public', async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(404).json({ message: 'No school setup yet' });
    }
    res.json({ 
      schoolName: admin.schoolName, 
      schoolId: admin.schoolId 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;