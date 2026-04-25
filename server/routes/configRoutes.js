const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getTimetableConfigModel } = require('../models/TimetableConfig');

// Helper: Resolve dynamic model
const getConfigModel = (req) => {
    // Use tenant connection if available, else fallback to main connection
    return req.tenantModels?.TimetableConfig || getTimetableConfigModel(mongoose.connection);
};

// Middleware to extract institutionId
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    let id = req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

// GET Configuration by Session
router.get('/config/:session', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const TimetableConfig = getConfigModel(req);
        const config = await TimetableConfig.findOne({ session: req.params.session, institutionId });
        if (!config) {
            // Return default config if not found
            return res.json({
                session: req.params.session,
                periodsPerDay: 8,
                periodDuration: 60,
                startTime: '09:00',
                endTime: '17:00',
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                lunchBreak: { enabled: true, period: 4, duration: 60 }
            });
        }
        res.json(config);
    } catch (err) {
        console.error('FETCH CONFIG ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// SAVE/UPDATE Configuration
router.put('/config/:session', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const TimetableConfig = getConfigModel(req);
        const { periodsPerDay, periodDuration, startTime, endTime, workingDays, lunchBreak } = req.body;

        let config = await TimetableConfig.findOne({ session: req.params.session, institutionId });

        if (config) {
            // Update existing
            config.periodsPerDay = periodsPerDay;
            config.periodDuration = periodDuration;
            config.startTime = startTime;
            config.endTime = endTime;
            config.workingDays = workingDays;
            config.lunchBreak = lunchBreak;
            config.updatedAt = new Date();
            await config.save();
        } else {
            // Create new
            config = new TimetableConfig({
                session: req.params.session,
                periodsPerDay,
                periodDuration,
                startTime,
                endTime,
                workingDays,
                lunchBreak,
                institutionId
            });
            await config.save();
        }

        res.json(config);
    } catch (err) {
        console.error('SAVE CONFIG ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

