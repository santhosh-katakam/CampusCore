const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { getTenantModels } = require('../utils/tenantManager');
const AttendanceRegistry = require('../models/Attendance');
const CourseRegistry = require('../models/Course');
const FacultyRegistry = require('../models/Faculty');
const LMSCourseRegistry = require('../models/LMSCourse');
const UserRegistry = require('../models/User');
const BatchRegistry = require('../models/Batch');
const auth = require('../middleware/auth');

const getAttendanceModels = async (req) => {
    if (req.tenantModels) return req.tenantModels;
    if (req.tenantSlug) return await getTenantModels(req.tenantSlug);
    
    // Fallback: try to resolve from user's institutionId
    const instId = getInstitutionId(req);
    if (instId && instId !== 'undefined' && instId !== 'null') {
        const Institution = require('../models/Institution');
        const inst = await Institution.findById(instId);
        if (inst && inst.slug) {
            console.log(`🔄 getAttendanceModels: Resolved tenant ${inst.slug} from institutionId ${instId}`);
            return await getTenantModels(inst.slug);
        }
    }
    
    console.warn('⚠️ getAttendanceModels: Failed to resolve tenant context');
    return null;
};

// Helper: extract institution id from request
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    const id = req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

// @route   GET /api/attendance/courses
// @desc    Get courses for attendance marking
// @access  Faculty/Admin
router.get('/courses', auth, async (req, res) => {
    try {
        const { Course, Faculty } = await getAttendanceModels(req);
        const institutionId = getInstitutionId(req);
        let query = { institutionId };

        // If Faculty, handle mapping to timetable facultyId
        if (req.user.role === 'FACULTY') {
            const facultyRecord = await Faculty.findOne({
                institutionId,
                $or: [
                    { facultyId: req.user.username },
                    { email: req.user.email },
                    { name: { $regex: new RegExp(req.user.name, 'i') } }
                ]
            });

            if (facultyRecord) {
                query.$or = [
                    { facultyId: facultyRecord.facultyId },
                    { facultyName: facultyRecord.name }
                ];
            } else {
                query.$or = [
                    { facultyId: req.user.username },
                    { facultyName: { $regex: new RegExp(req.user.name, 'i') } }
                ];
            }
        }

        const courses = await Course.find(query);
        res.json(courses);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/students/:courseId', auth, async (req, res) => {
    try {
        const { Course, User, Batch } = await getAttendanceModels(req);
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ msg: 'Course not found' });

        const institutionId = getInstitutionId(req);
        const reqBatch = req.query.batch || course.batch;
        const criteria = [{ batch: reqBatch }];

        const yearMatch = reqBatch.match(/20(\d{2})/);
        if (yearMatch) {
            criteria.push({ batch: { $regex: new RegExp(`^${yearMatch[1]}`, 'i') } });
        }

        const officialBatches = await Batch.find({
            institutionId,
            department: course.department,
            $or: [{ batchId: reqBatch }, { name: reqBatch }]
        });

        if (officialBatches.length > 0) {
            officialBatches.forEach(ob => {
                if (ob.batchId) criteria.push({ batch: ob.batchId });
                if (ob.name) criteria.push({ batch: ob.name });
            });
        }

        const students = await User.find({
            institutionId,
            role: 'STUDENT',
            department: course.department,
            $or: criteria
        }).select('_id name username batch department');

        res.json(students);
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   GET api/attendance/records
// @desc    Get attendance records for a specific course, date, and session (for editing)
router.get('/records', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        const { courseId, date, session } = req.query;
        
        if (!courseId || !date) {
            return res.status(400).json({ error: 'CourseId and Date are required' });
        }

        const query = {
            courseId: new mongoose.Types.ObjectId(courseId),
            facultyId: new mongoose.Types.ObjectId(req.user.id || req.user._id),
            session: session || 'Current',
            date: {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(date).setHours(23, 59, 59, 999))
            }
        };

        const records = await Attendance.find(query);
        res.json(records);
    } catch (err) {
        console.error('Fetch Records Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/mark', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        let institutionId = getInstitutionId(req);
        
        if (!institutionId && req.user?.institutionId) {
            institutionId = req.user.institutionId;
        }

        const { courseId, date, attendanceData, session } = req.body;
        const facultyId = req.user.id || req.user._id;
        const currentSession = session || 'Current';

        console.log(`📝 Marking attendance: Course ${courseId}, Date ${date}, Session ${currentSession}, Count ${attendanceData.length}`);

        const records = attendanceData.map(item => ({
            institutionId: new mongoose.Types.ObjectId(institutionId),
            studentId: new mongoose.Types.ObjectId(item.studentId),
            facultyId: new mongoose.Types.ObjectId(facultyId),
            courseId: new mongoose.Types.ObjectId(courseId),
            date: new Date(date),
            status: item.status,
            session: currentSession
        }));

        // Delete existing records for SAME course, SAME date, and SAME session
        await Attendance.deleteMany({
            courseId: new mongoose.Types.ObjectId(courseId),
            session: currentSession,
            date: {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(date).setHours(23, 59, 59, 999))
            }
        });

        const savedRecords = await Attendance.insertMany(records);
        console.log(`✅ Saved ${savedRecords.length} records for session ${currentSession}`);
        res.status(201).json(savedRecords);
    } catch (err) {
        console.error('Attendance Mark Error:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

router.get('/student/:studentId', auth, async (req, res) => {
    try {
        const { Attendance, User } = await getAttendanceModels(req);
        if (!Attendance) return res.status(400).json({ error: 'Tenant context missing' });

        const { studentId } = req.params;
        const institutionId = getInstitutionId(req);
        
        console.log(`🔍 [ATTENDANCE] Fetching for student: ${studentId} (User: ${req.user?.username})`);
        
        // --- ID MISMATCH FIX ---
        // Some users have different IDs in Main DB vs Tenant DB.
        // We resolve the tenant-specific ID using the username from the authenticated user.
        let resolvedStudentId = studentId;
        if (req.user?.username) {
            const tenantUser = await User.findOne({ username: req.user.username });
            if (tenantUser) {
                resolvedStudentId = tenantUser._id;
                console.log(`   Resolved tenant ID: ${resolvedStudentId} from username ${req.user.username}`);
            }
        }
        
        const query = { studentId: new mongoose.Types.ObjectId(resolvedStudentId) };
        console.log(`   Query: ${JSON.stringify(query)}`);

        const records = await Attendance.find(query)
            .populate('courseId', 'subject courseCode title')
            .sort({ date: -1 });
        
        console.log(`✅ Found ${records.length} records in tenant ${req.tenantSlug}`);
        
        // Log a sample record if exists to debug population
        if (records.length > 0) {
            console.log(`   Sample record: CourseID=${records[0].courseId?._id}, Subject=${records[0].courseId?.subject || records[0].courseId?.title}`);
        }

        const stats = {};
        records.forEach(rec => {
            const cId = rec.courseId?._id?.toString() || 'unknown';
            if (!stats[cId]) {
                stats[cId] = {
                    courseTitle: rec.courseId?.subject || 'Unknown Course',
                    courseCode: rec.courseId?.courseCode || 'N/A',
                    present: 0, absent: 0, late: 0, total: 0
                };
            }
            stats[cId].total++;
            if (rec.status === 'Present') stats[cId].present++;
            else if (rec.status === 'Absent') stats[cId].absent++;
            else if (rec.status === 'Late') stats[cId].late++;
        });

        const formattedStats = Object.values(stats).map(stat => ({
            ...stat,
            percentage: ((stat.present + (stat.late * 0.5)) / stat.total * 100).toFixed(2)
        }));

        res.json({ records, stats: formattedStats });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        const { courseId } = req.params;
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ courseId, institutionId })
            .populate('studentId', 'name username')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/faculty/history', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ facultyId: req.user.id, institutionId })
            .populate('courseId', 'title courseCode')
            .populate('studentId', 'name username')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/admin/report', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        if (!['COLLEGE_ADMIN', 'COMPANY_ADMIN', 'HOD', 'FACULTY'].includes(req.user.role)) {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const institutionId = getInstitutionId(req);
        const { courseId, studentId, startDate, endDate } = req.query;
        
        // --- DATA ISOLATION FIX ---
        // Only show records created by this specific Faculty/HOD
        const query = { 
            institutionId: new mongoose.Types.ObjectId(institutionId),
            facultyId: new mongoose.Types.ObjectId(req.user.id || req.user._id)
        };
        
        if (courseId) query.courseId = new mongoose.Types.ObjectId(courseId);
        if (studentId) query.studentId = new mongoose.Types.ObjectId(studentId);
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        console.log(`📊 Fetching filtered report for faculty: ${req.user.username}`);

        const records = await Attendance.find(query)
            .populate('courseId', 'subject department courseCode')
            .populate('studentId', 'name department username');
        res.json(records);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
