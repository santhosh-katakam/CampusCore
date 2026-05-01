const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Institution = require('../models/Institution');
const { getUserModel } = require('../models/User');
const { getTenantModels } = require('../utils/tenantManager');

// Helper: Resolve dynamic User model on main connection
const MainUser = getUserModel(mongoose.connection);

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
    console.log(`🏢 FETCHING INSTITUTIONS: User=${req.user?.username || 'Guest'}`);
    try {
        const institutions = await Institution.find().lean();
        console.log(`✅ FOUND ${institutions.length} INSTITUTIONS`);
        
        const enrichedInstitutions = await Promise.all(institutions.map(async (inst) => {
            const admin = await MainUser.findOne({ 
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
    const { name, code, address, contact, adminUsername, adminPassword, slug: providedSlug } = req.body;
    try {
        // 1. Generate slug if not provided
        const slug = providedSlug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        
        // 2. Create Institution
        const institution = new Institution({ name, code, slug, address, contact });
        await institution.save();

        // 3. Create College Admin User (Stored in Main DB for cross-tenant routing)
        const user = new MainUser({
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

// @route   GET api/company/stats
// @desc    Get global stats for company dashboard (aggregated across all tenant DBs)
router.get('/stats', async (req, res) => {
    console.log(`📊 FETCHING GLOBAL STATS`);
    try {
        const institutions = await Institution.find();
        let totalFaculty = 0;
        let totalBatches = 0;

        // Iterate through all institutions and sum up counts from their respective DBs
        for (const inst of institutions) {
            try {
                if (!inst.slug) continue;
                const models = await getTenantModels(inst.slug);
                
                const [facCount, batCount] = await Promise.all([
                    models.Faculty.countDocuments(),
                    models.Batch.countDocuments()
                ]);
                
                totalFaculty += facCount;
                totalBatches += batCount;
            } catch (instErr) {
                console.error(`Error fetching stats for ${inst.name}:`, instErr.message);
            }
        }

        res.json({
            institutions: institutions.length,
            totalFaculty,
            totalBatches
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   DELETE api/company/institutions/:id
// @desc    Delete an institution and its admin user
router.delete('/institutions/:id', async (req, res) => {
    try {
        const instId = req.params.id;
        const institution = await Institution.findById(instId);
        
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        // 1. Delete the institution from main DB
        await Institution.findByIdAndDelete(instId);
        
        // 2. Delete the associated admin user(s)
        await MainUser.deleteMany({ institutionId: instId });

        res.json({ message: 'Institution deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   PUT api/company/institutions/:id/reset-password
// @desc    Reset password for an institution's admin
router.put('/institutions/:id/reset-password', async (req, res) => {
    try {
        const instId = req.params.id;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const admin = await MainUser.findOne({ institutionId: instId, role: 'COLLEGE_ADMIN' });
        if (!admin) {
            return res.status(404).json({ error: 'Admin user not found' });
        }

        admin.password = newPassword;
        await admin.save(); // Assuming save() triggers the password hashing pre-hook

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
