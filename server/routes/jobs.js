const express = require('express');
const router = express.Router();
const JobRegistry = require('../models/Job');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Helper to resolve models
const getJobModels = (req) => {
    return {
        Job: req.tenantModels?.Job || JobRegistry.getJobModel(mongoose.connection)
    };
};

// Helper to get institution ID
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    const id = req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

// @route   GET /api/jobs
// @desc    Get all jobs for the institution
router.get('/', auth, async (req, res) => {
    try {
        const { Job } = getJobModels(req);
        const institutionId = getInstitutionId(req);
        if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });

        const jobs = await Job.find({ institutionId }).sort({ createdAt: -1 });
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST /api/jobs
// @desc    Post a new job (HOD or Faculty)
router.post('/', auth, async (req, res) => {
    try {
        const { Job } = getJobModels(req);
        const { title, company, description, location, salary, link } = req.body;
        const institutionId = getInstitutionId(req);

        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Unauthorized to post jobs' });
        }

        const job = new Job({
            title,
            company,
            description,
            location,
            salary,
            link,
            institutionId,
            postedBy: req.user.id,
            postedByName: req.user.username
        });

        await job.save();
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete a job
router.delete('/:id', auth, async (req, res) => {
    try {
        const { Job } = getJobModels(req);
        const institutionId = getInstitutionId(req);
        const job = await Job.findOne({ _id: req.params.id, institutionId });
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Only HOD or the person who posted it can delete
        if (req.user.role !== 'HOD' && req.user.role !== 'COLLEGE_ADMIN' && job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await Job.deleteOne({ _id: req.params.id });
        res.json({ message: 'Job removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
