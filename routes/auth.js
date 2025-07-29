// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// @route   POST /api/auth/signup
// @desc    Register user with strong password enforcement
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Simple validation
        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        // Check for existing user
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists with this email' });
        }

        // Create new user (password validation & hashing happens in pre-save hook)
        user = new User({
            name,
            email,
            password
        });

        const savedUser = await user.save();

        // Generate JWT token
        const token = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, {
            expiresIn: '7d' // Longer token for better UX
        });

        res.status(201).json({
            token,
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email
            }
        });

    } catch (err) {
        console.error('Signup Error:', err);
        
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(' ') });
        }
        
        // Handle our custom password strength error
        if (err.statusCode === 400) {
            return res.status(400).json({ msg: err.message });
        }
        
        // Handle duplicate email (11000 is MongoDB duplicate key error code)
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'User already exists with this email' });
        }
        
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Simple validation
        if (!email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // Generic message for security (don't reveal if email exists)
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Compare passwords using the method defined in the User model
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' }); // Generic message
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '7d' // Longer token
        });

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;