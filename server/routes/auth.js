const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Institution = require('../models/Institution');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    const { username, password, institutionId } = req.body;

    try {
        // Case-insensitive username search
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare password (trimming just in case)
        const isMatch = await user.comparePassword(password.trim());
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Ensure we handle missing isActive field by defaulting to true
        if (user.isActive === false) {
            console.log(`Account disabled: ${username}`);
            return res.status(403).json({ error: 'Account is disabled' });
        }

        const payload = {
            id: user._id,
            role: user.role,
            institutionId: user.institutionId,
            username: user.username
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        // Update login stats
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                institutionId: user.institutionId,
                name: user.name
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/auth/register-company-admin
// @desc    Register initial company admin (should be protected or removed in prod)
router.post('/register-company-admin', async (req, res) => {
    const { username, password, name, email } = req.body;
    try {
        const existing = await User.findOne({ role: 'COMPANY_ADMIN' });
        if (existing && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Company Admin already exists' });
        }

        const user = new User({
            username,
            password,
            name,
            email,
            role: 'COMPANY_ADMIN'
        });

        await user.save();
        res.status(201).json({ message: 'Company Admin created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/auth/institutions-public
// @desc    Get all institutions for registratio
// "?:n dropdown
router.get('/institutions-public', async (req, res) => {
    try {
        const institutions = await Institution.find({}, 'name _id');
        res.json(institutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/auth/register
// @desc    Register Student or Faculty
router.post('/register', async (req, res) => {
    const { username, password, name, email, role, institutionId, batch, department } = req.body;

    try {
        // Validate role
        if (!['STUDENT', 'FACULTY', 'HOD'].includes(role)) {
            return res.status(400).json({ error: 'Registration is only allowed for Students, Faculty, and HODs' });
        }

        // Check if user already exists
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Check institution exists
        if (institutionId) {
            const inst = await Institution.findById(institutionId);
            if (!inst) return res.status(400).json({ error: 'Invalid Institution' });
        }

        user = new User({
            username,
            password,
            name,
            email,
            role,
            institutionId,
            batch,
            department
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
