const express = require('express');
const router = express.Router();
const Institution = require('../models/Institution');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Faculty = require('../models/Faculty');
const Student = require('../models/Timetable'); // Actually Student data might be in Timetables or separate, checking models...

// Middleware to verify Company Admin
const companyAdminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'COMPANY_ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Company Admin only.' });
    }
};

// @route   GET api/company/institutions
// @desc    Get all institutions with their admin details
router.get('/institutions', async (req, res) => {
    try {
        const institutions = await Institution.find().lean();
        
        // Fetch admin users for each institution
        const enrichedInstitutions = await Promise.all(institutions.map(async (inst) => {
            const admin = await User.findOne({ 
                institutionId: inst._id, 
                role: 'COLLEGE_ADMIN' 
            }, 'username');
            return {
                ...inst,
                adminUsername: admin ? admin.username : 'N/A'
            };
        }));

        res.json(enrichedInstitutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/company/institutions
// @desc    Create an institution and its admin user
router.post('/institutions', async (req, res) => {
    const { name, code, address, contact, adminUsername, adminPassword } = req.body;
    try {
        // 1. Create Institution
        const institution = new Institution({ name, code, address, contact });
        await institution.save();

        // 2. Create College Admin User
        const user = new User({
            username: adminUsername,
            password: adminPassword,
            role: 'COLLEGE_ADMIN',
            institutionId: institution._id,
            name: `${name} Admin`
        });
        await user.save();

        res.status(201).json({ institution, user: { username: user.username, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   PUT api/company/institutions/:id/reset-password
// @desc    Reset a college admin's password
router.put('/institutions/:id/reset-password', async (req, res) => {
    const { newPassword } = req.body;
    try {
        const user = await User.findOne({ institutionId: req.params.id, role: 'COLLEGE_ADMIN' });
        if (!user) return res.status(404).json({ error: 'Admin user not found' });

        user.password = newPassword; // Pre-save hook will hash it
        await user.save();
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   DELETE api/company/institutions/:id
// @desc    Delete institution and its user (careful!)
router.delete('/institutions/:id', async (req, res) => {
    try {
        await User.deleteMany({ institutionId: req.params.id });
        await Institution.findByIdAndDelete(req.params.id);
        res.json({ message: 'Institution and associated users deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/company/stats
// @desc    Get global stats for company dashboard
router.get('/stats', async (req, res) => {
    try {
        const institutionCount = await Institution.countDocuments();
        const facultyCount = await Faculty.countDocuments();
        const batchCount = await Batch.countDocuments();
        // Since Student model isn't explicitly found, maybe count something else or skip
        
        res.json({
            institutions: institutionCount,
            totalFaculty: facultyCount,
            totalBatches: batchCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
