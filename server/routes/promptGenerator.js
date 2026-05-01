const express = require('express');
const router = express.Router();
const TimetableRegistry = require('../models/Timetable');
const mongoose = require('mongoose');
const Scheduler = require('../utils/scheduler');

// Simple helper to parse the comma-separated strings
const parseList = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
};

router.post('/', async (req, res) => {
    try {
        const Timetable = req.tenantModels ? req.tenantModels.Timetable : TimetableRegistry.getTimetableModel(mongoose.connection);

        if (req.body.isParsedData) {
            // Highly robust parsed data from frontend prompt
            const { batches, lectureRooms, labRooms, subjectConfig } = req.body;

            if (Object.keys(subjectConfig).length === 0) return res.status(400).json({ error: "No subjects extracted" });
            if (lectureRooms.length === 0 && labRooms.length === 0) return res.status(400).json({ error: "No rooms extracted" });

            const config = {
                periodsPerDay: 8, // P1=1, P2=2, P3=3, LUNCH=4, P4=5, P5=6, P6=7 (Wait! Lunch is 12-1pm, P1 9-10 P2 10-11 P3 11-12 LUNCH P4 1-2 P5 2-3 P6 3-4 -> 7 periods total!
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                lunchBreak: { enabled: true, period: 4 }
            };
            config.periodsPerDay = 7; // Specifically from prompt: 9-10, 10-11, 11-12, Lunch, 1-2, 2-3, 3-4 = 7 periods

            const roomConfigObj = {
                lectureRooms: lectureRooms.length > 0 ? lectureRooms : labRooms,
                labRooms: labRooms.length > 0 ? labRooms : lectureRooms
            };

            const batchesData = [];
            const nBatches = batches.length > 0 ? batches.length : 1;
            for (let i = 0; i < nBatches; i++) {
                const batchName = batches[i] || `Batch ${i + 1}`;
                batchesData.push({
                    batch: { _id: `temp_batch_${i}`, batchId: batchName, name: batchName },
                    subjectConfig: subjectConfig
                });
            }

            const instId = req.headers['x-institution-id'] || req.user?.institutionId || process.env.DEFAULT_INSTITUTION_ID || '69884fc9b7b03d132ba7f832';
            const scheduler = new Scheduler(config, roomConfigObj, [], instId, {});
            const results = scheduler.generateMulti(batchesData);

            // Save to Database so they appear in "View All Timetables"
            const savedTimetables = [];
            for (const result of results) {
                // Delete existing for this batch to avoid duplicates
                await Timetable.deleteMany({
                    institutionId: instId,
                    $or: [{ batch: result.batchName }, { batchId: result.batchId }]
                });

                const tt = new Timetable({
                    institutionId: instId,
                    title: `Timetable for ${result.batchName}`,
                    batch: result.batchName,
                    batchId: result.batchId,
                    schedule: result.schedule,
                    warnings: result.warnings,
                    createdAt: new Date()
                });
                await tt.save();
                savedTimetables.push(tt);
            }

            return res.json({
                message: "Timetable generated successfully from prompt!",
                timetables: savedTimetables
            });
        }

        // Fallback to legacy string handler
        const {
            numBatches = 1,
            batches = '',
            coreSubjects = '',
            electiveSubjects = '',
            faculty = '',
            lectureRooms = '',
            labRooms = '',
            lectureHours = 3,
            labHours = 0,
            noClashes = true, // Implicitly handled by scheduler logic
            limitContinuous = true // Implicitly handled by scheduler logic
        } = req.body;

        const coreSubjectList = parseList(coreSubjects);
        const electiveSubjectList = parseList(electiveSubjects);
        const allSubjects = [...coreSubjectList, ...electiveSubjectList];
        const facultyList = parseList(faculty);
        const lecRoomList = parseList(lectureRooms);
        const labRoomList = parseList(labRooms);
        const batchList = parseList(batches);

        if (allSubjects.length === 0) return res.status(400).json({ error: "Subjects are required" });
        if (facultyList.length === 0) return res.status(400).json({ error: "Faculty is required" });
        if (lecRoomList.length === 0 && labRoomList.length === 0) return res.status(400).json({ error: "Rooms are required" });

        // Basic Config mapping
        const config = {
            periodsPerDay: 8,
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            lunchBreak: { enabled: true, period: 4 }
        };

        const roomConfig = {
            lectureRooms: lecRoomList.length > 0 ? lecRoomList : labRoomList,
            labRooms: labRoomList.length > 0 ? labRoomList : lecRoomList
        };

        // Create subject config
        const subjectConfig = {};
        let facIndex = 0;

        coreSubjectList.forEach((sub) => {
            const fac = facultyList[facIndex % facultyList.length];
            facIndex++;
            subjectConfig[sub] = {
                lectureHours: parseInt(lectureHours) || 3,
                labHours: parseInt(labHours) || 0,
                faculty: fac,
                subjectType: 'Core'
            };
        });

        electiveSubjectList.forEach((sub) => {
            const fac = facultyList[facIndex % facultyList.length];
            facIndex++;
            subjectConfig[sub] = {
                lectureHours: parseInt(lectureHours) || 3,
                labHours: parseInt(labHours) || 0,
                faculty: fac,
                subjectType: 'Elective'
            };
        });

        // Initialize batches data
        const batchesData = [];
        const nBatches = batchList.length > 0 ? batchList.length : (parseInt(numBatches) || 1);
        for (let i = 0; i < nBatches; i++) {
            const batchName = batchList[i] || `Prompt Batch ${i + 1}`;
            batchesData.push({
                batch: { _id: `temp_batch_${i}`, batchId: batchName, name: batchName },
                subjectConfig: subjectConfig
            });
        }

        // Generate timetable using same Scheduler!
        const instId = req.headers['x-institution-id'] || req.user?.institutionId || process.env.DEFAULT_INSTITUTION_ID || '69884fc9b7b03d132ba7f832';
        const scheduler = new Scheduler(config, roomConfig, [], instId, {});
        const results = scheduler.generateMulti(batchesData);

        // Save to Database so they appear in "View All Timetables"
        const savedTimetables = [];
        for (const result of results) {
            await Timetable.deleteMany({
                institutionId: instId,
                $or: [{ batch: result.batchName }, { batchId: result.batchId }]
            });

            const tt = new Timetable({
                institutionId: instId,
                title: `Timetable for ${result.batchName}`,
                batch: result.batchName,
                batchId: result.batchId,
                schedule: result.schedule,
                warnings: result.warnings,
                createdAt: new Date()
            });
            await tt.save();
            savedTimetables.push(tt);
        }

        res.json({
            message: "Timetable generated successfully from prompts!",
            timetables: savedTimetables
        });
    } catch (err) {
        console.error("PROMPT GENERATE ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
