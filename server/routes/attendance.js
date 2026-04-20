const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const LMSCourse = require('../models/LMSCourse');
const User = require('../models/User');
const Batch = require('../models/Batch');
const auth = require('../middleware/auth');

// Helper: extract institution id from request
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    return req.headers['x-institution-id'] || process.env.DEFAULT_INSTITUTION_ID;
};

// @route   GET /api/attendance/courses
// @desc    Get courses for attendance marking
// @access  Faculty/Admin
router.get('/courses', auth, async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        let query = { institutionId };
        
        // If Faculty, handle mapping to timetable facultyId
        if (req.user.role === 'FACULTY') {
            // Find faculty record by username, email, or name
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
                // If no record found, check by username or name in courses directly
                query.$or = [
                    { facultyId: req.user.username },
                    { facultyName: { $regex: new RegExp(req.user.name, 'i') } }
                ];
            }
        }
        
        console.log(`FETCHING COURSES: User=${req.user.username}, Role=${req.user.role}, Inst=${institutionId}`);
        const courses = await Course.find(query);
        console.log(`COURSES FOUND: ${courses.length}`);
        res.json(courses);
    } catch (err) {
        console.error("ATTENDANCE ERROR:", err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/attendance/students/:courseId
// @desc    Get students for a specific course/batch
// @access  Faculty/Admin
router.get('/students/:courseId', auth, async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ msg: 'Course not found' });

        const institutionId = getInstitutionId(req);
        
        const reqBatch = req.query.batch || course.batch;
        
        // 1. Build a high-precision criteria list
        const criteria = [{ batch: reqBatch }];

        // Check for common shorthand year (e.g., "2023" -> "23") 
        // ONLY if it safely identifies the cohort
        const yearMatch = reqBatch.match(/20(\d{2})/);
        if (yearMatch) {
            criteria.push({ batch: { $regex: new RegExp(`^${yearMatch[1]}`, 'i') } });
        }

        // 2. Cross-reference with the official Batch definitions
        const officialBatches = await Batch.find({
            institutionId,
            department: course.department,
            $or: [
                { batchId: reqBatch },
                { name: reqBatch }
            ]
        });

        if (officialBatches.length > 0) {
            officialBatches.forEach(ob => {
                if (ob.batchId) criteria.push({ batch: ob.batchId });
                if (ob.name) criteria.push({ batch: ob.name });
            });
        }

        // 3. Final Strict Query
        // We MUST match role='STUDENT' AND the institution AND the department AND one of our batch criteria
        const students = await User.find({
            institutionId,
            role: 'STUDENT',
            department: course.department,
            $or: criteria
        }).select('name username batch department');

        // Note: No fallbacks. If students.length is 0, the frontend will show the "No students found" state.
        res.json(students);
    } catch (err) {
        console.error("Attendance Fetch Error:", err.message);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   POST /api/attendance/mark
// @desc    Mark attendance for a list of students
// @access  Faculty/HOD
router.post('/mark', auth, async (req, res) => {
    try {
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

        // Delete existing records for the same course and date to prevent duplicates
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
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/attendance/student/:studentId
// @desc    Get attendance stats for a student
// @access  Student/Faculty/Admin
router.get('/student/:studentId', auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ studentId, institutionId }).populate('courseId', 'subject courseCode');

        // Group by course and calculate percentages
        const stats = {};
        records.forEach(rec => {
            const courseId = rec.courseId?._id?.toString() || 'unknown';
            if (!stats[courseId]) {
                const courseName = rec.courseId?.subject || 'Unknown Course';
                stats[courseId] = {
                    courseTitle: courseName,
                    courseCode: rec.courseId?.courseCode || 'N/A',
                    present: 0,
                    absent: 0,
                    late: 0,
                    total: 0
                };
            }
            stats[courseId].total++;
            if (rec.status === 'Present') stats[courseId].present++;
            else if (rec.status === 'Absent') stats[courseId].absent++;
            else if (rec.status === 'Late') stats[courseId].late++;
        });

        // Calculate percentages
        const formattedStats = Object.values(stats).map(stat => ({
            ...stat,
            percentage: ((stat.present + (stat.late * 0.5)) / stat.total * 100).toFixed(2)
        }));

        res.json({
            records,
            stats: formattedStats
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/attendance/course/:courseId
// @desc    Get attendance history for a course
// @access  Faculty/Admin
router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const { courseId } = req.params;
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ courseId, institutionId })
            .populate('studentId', 'name username')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/attendance/faculty/history
// @desc    Get faculty's marked attendance history
// @access  Faculty
router.get('/faculty/history', auth, async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ facultyId: req.user.id, institutionId })
            .populate('courseId', 'title courseCode')
            .populate('studentId', 'name username')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/attendance/admin/report
// @desc    General report for Admin
// @access  Admin
router.get('/admin/report', auth, async (req, res) => {
    try {
        if (!['COLLEGE_ADMIN', 'COMPANY_ADMIN', 'HOD'].includes(req.user.role)) {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const institutionId = getInstitutionId(req);
        const records = await Attendance.find({ institutionId })
            .populate('courseId', 'title department')
            .populate('studentId', 'name department');
        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
