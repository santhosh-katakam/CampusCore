const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getTenantModels } = require('../utils/tenantManager');
const UserRegistry = require('../models/User');
const Institution = require('../models/Institution');
const BatchRegistry = require('../models/Batch');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';

// Helper: Resolve dynamic models
const getAuthModels = async (req) => {
    // If tenant context exists (from middleware), use it.
    // Otherwise, use the main connection as fallback (e.g. for creating Company Admins)
    return {
        User: req.tenantModels?.User || UserRegistry.getUserModel(require('mongoose').connection),
        Batch: req.tenantModels?.Batch || BatchRegistry.getBatchModel(require('mongoose').connection)
    };
};

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { User: TenantUser } = await getAuthModels(req);
        const MainUser = UserRegistry.getUserModel(require('mongoose').connection);
        
        console.log(`🔑 Login attempt for: ${username}`);

        // 1. Try finding in current context (Tenant DB if header provided, Main DB otherwise)
        let user = await TenantUser.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        let source = req.tenantSlug ? `Tenant DB (${req.tenantSlug})` : 'Main DB';

        // 2. If not found and we were in a tenant context, try the Main DB as fallback
        if (!user && req.tenantModels) {
            console.log(`🔍 Not found in ${source}, checking Main DB...`);
            user = await MainUser.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
            source = 'Main DB (Fallback)';
        }

        if (!user) {
            console.log(`❌ User not found: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`✅ User found in ${source}`);

        // Compare password
        const isMatch = await user.comparePassword(password.trim());
        
        if (!isMatch) {
            console.log(`❌ Password mismatch for: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // --- AUTO-SYNC LOGIC ---
        // If user was found in Main DB but we have a tenant context, 
        // ensure they exist in the Tenant DB too.
        if (source.includes('Main DB') && req.tenantModels) {
            const { User: TenantUser } = req.tenantModels;
            const existsInTenant = await TenantUser.findOne({ username: user.username });
            if (!existsInTenant && user.institutionId && user.role !== 'COMPANY_ADMIN') {
                console.log(`🔄 Auto-syncing user ${username} to Tenant DB...`);
                const tenantUser = new TenantUser({
                    _id: user._id,
                    username: user.username,
                    password: user.password, // Already hashed in Main DB
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    institutionId: user.institutionId,
                    batch: user.batch,
                    department: user.department,
                    isActive: user.isActive
                });
                // We use password as is since it's already hashed
                await tenantUser.save();
                console.log(`✅ Auto-sync complete for ${username}`);
            }
        }
        // -----------------------

        console.log(`🎉 Login successful: ${username}`);

        // Ensure we handle missing isActive field by defaulting to true
        if (user.isActive === false) {
            console.log(`🚫 Account disabled: ${username}`);
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
        const MainUser = UserRegistry.getUserModel(require('mongoose').connection);
        const existing = await MainUser.findOne({ role: 'COMPANY_ADMIN' });
        if (existing && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Company Admin already exists' });
        }

        const user = new MainUser({
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

// @route   GET api/auth/batches-public/:institutionId
// @desc    Get all batches for a specific institution for registration dropdown
router.get('/batches-public/:institutionId', async (req, res) => {
    try {
        const inst = await Institution.findById(req.params.institutionId);
        if (!inst || !inst.slug) return res.status(404).json({ error: 'Institution not found' });
        
        const models = await getTenantModels(inst.slug);
        const batches = await models.Batch.find({ institutionId: req.params.institutionId }, 'name batchId department');
        res.json(batches);
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

        // Check institution exists and get slug
        const inst = await Institution.findById(institutionId);
        if (!inst) return res.status(400).json({ error: 'Invalid Institution' });

        const models = await getTenantModels(inst.slug);
        const User = models.User;

        // Check if user already exists
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ error: 'Username already taken' });
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

        // 2. IMPORTANT: Also save to Main DB for login routing
        const MainUser = UserRegistry.getUserModel(require('mongoose').connection);
        const existingMain = await MainUser.findOne({ username });
        if (!existingMain) {
            const mainUser = new MainUser({
                _id: user._id, // Use the same ID for consistency
                username,
                password: user.password, // Use hashed password from above
                name,
                email,
                role,
                institutionId,
                batch,
                department
            });

            await mainUser.save();
        }

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
