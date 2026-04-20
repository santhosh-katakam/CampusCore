const express = require('express');
const router = express.Router();
const TimetableConfig = require('../models/TimetableConfig');

// Middleware to extract institutionId
const getInstitutionId = (req) => req.headers['x-institution-id'] || process.env.DEFAULT_INSTITUTION_ID;

// GET Configuration by Session
router.get('/config/:session', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
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
        res.status(500).json({ error: err.message });
    }
});

// SAVE/UPDATE Configuration
router.put('/config/:session', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
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
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
