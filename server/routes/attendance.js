const express = require('express');
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
    return req.tenantModels || await getTenantModels(req.tenantSlug);
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
        }).select('name username batch department');

        res.json(students);
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/mark', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        const institutionId = getInstitutionId(req);
        const { courseId, date, attendanceData } = req.body;
        const facultyId = req.user.id;

        const records = attendanceData.map(item => ({
            institutionId,
            studentId: item.studentId,
            facultyId,
            courseId,
            date: new Date(date),
            status: item.status,
            session: req.body.session || 'Current'
        }));

        await Attendance.deleteMany({
            courseId,
            date: {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(date).setHours(23, 59, 59, 999))
            }
        });

        const savedRecords = await Attendance.insertMany(records);
        res.status(201).json(savedRecords);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/student/:studentId', auth, async (req, res) => {
    try {
        const { Attendance } = await getAttendanceModels(req);
        const { studentId } = req.params;
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ studentId, institutionId }).populate('courseId', 'subject courseCode');

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
        const records = await Attendance.find({ institutionId })
            .populate('courseId', 'title department')
            .populate('studentId', 'name department');
        res.json(records);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
