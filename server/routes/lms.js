const express = require('express');
const router = express.Router();
const LMSCourse = require('../models/LMSCourse');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const fileUrl = `http://localhost:4000/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});
const User = require('../models/User');

// @route   GET /api/lms/courses
// @desc    Get courses based on role (HOD/Admin: all, Faculty: own, Student: all in institution)
router.get('/courses', async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.query.institutionId;
        const { role, id } = req.user;
        
        if (!institutionId && role !== 'COMPANY_ADMIN') {
            return res.status(400).json({ message: 'Institution ID is required' });
        }

        let query = {};
        if (institutionId) query.institutionId = institutionId;

        // Everyone in the institution sees all institutional courses
        // No restrictions by facultyId or student arrays anymore per user request.

        const courses = await LMSCourse.find(query)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount');
        res.json(courses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// @route   POST /api/lms/courses
// @desc    Create a new course (Faculty/Admin only)
router.post('/courses', async (req, res) => {
    try {
        // RBAC: Only HOD, Faculty, or Admins can create courses
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: Students cannot create courses' });
        }

        const institutionId = req.user.institutionId || req.body.institutionId;
        if (!institutionId) {
            return res.status(400).json({ message: 'Institution ID is required' });
        }

        const facultyId = req.user.role === 'FACULTY' ? req.user.id : (req.body.facultyId || req.user.id);

        const newCourse = new LMSCourse({
            ...req.body,
            institutionId,
            facultyId
        });

        const savedCourse = await newCourse.save();
        res.status(201).json(savedCourse);
    } catch (err) {
        console.error('LMS Course Create Error:', err);
        res.status(400).json({ message: err.message });
    }
});

// @route   GET /api/lms/courses/:id
// @desc    Get course details
router.get('/courses/:id', async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.query.institutionId;
        const query = { _id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await LMSCourse.findOne(query)
            .populate('facultyId', 'name email')
            .populate('students', 'name email')
            .populate({
                path: 'modules.assignments',
                model: 'Assignment'
            })
            .populate({
                path: 'modules.quizzes',
                model: 'Quiz'
            });
        
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(course);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/lms/courses/:id/modules
// @desc    Add a module to a course
router.post('/courses/:id/modules', async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.body.institutionId;
        const query = { _id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await LMSCourse.findOne(query);
        if (!course) return res.status(404).json({ message: 'Course not found in your institution' });

        course.modules.push({
            title: req.body.title,
            week: req.body.week,
            description: req.body.description
        });
        await course.save();
        res.status(201).json(course);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Materials
router.post('/courses/:id/modules/:moduleId/materials', async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.body.institutionId;
        const query = { _id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await LMSCourse.findOne(query);
        if (!course) return res.status(404).json({ message: 'Course not found in your institution' });

        const module = course.modules.id(req.params.moduleId);
        if (!module) return res.status(404).json({ message: 'Module not found' });

        module.materials.push(req.body);
        await course.save();
        res.status(201).json(course);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Assignments
router.post('/assignments', async (req, res) => {
    try {
        // RBAC Check
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const newAssignment = new Assignment(req.body);
        const savedAssignment = await newAssignment.save();
        
        // Add to module
        await LMSCourse.updateOne(
            { _id: req.body.courseId, "modules._id": req.body.moduleId },
            { $push: { "modules.$.assignments": savedAssignment._id } }
        );

        
        const updatedCourse = await LMSCourse.findById(req.body.courseId)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate({ path: 'modules.assignments', model: 'Assignment' })
            .populate({ path: 'modules.quizzes', model: 'Quiz' });
            
        res.status(201).json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Quizzes
router.post('/quizzes', async (req, res) => {
    try {
        // RBAC Check
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const newQuiz = new Quiz(req.body);
        const savedQuiz = await newQuiz.save();
        
        // Add to module
        await LMSCourse.updateOne(
            { _id: req.body.courseId, "modules._id": req.body.moduleId },
            { $push: { "modules.$.quizzes": savedQuiz._id } }
        );

        
        const updatedCourse = await LMSCourse.findById(req.body.courseId)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate({ path: 'modules.assignments', model: 'Assignment' })
            .populate({ path: 'modules.quizzes', model: 'Quiz' });
            
        res.status(201).json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/quizzes/:id', async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(quiz);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// Enrollment
router.post('/courses/:id/enroll', async (req, res) => {
    try {
        // RBAC Check
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { studentId } = req.body;
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (!course.students.includes(studentId)) {
            course.students.push(studentId);
            await course.save();
        }
        
        const updatedCourse = await LMSCourse.findById(req.params.id).populate('students', 'name email username lastLogin loginCount');
        res.json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get institution students
router.get('/institution-students', async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.query.institutionId;
        if (!institutionId) return res.status(400).json({ message: 'Institution ID required' });

        const students = await User.find({ institutionId, role: 'STUDENT' }).select('name email username lastLogin loginCount');
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Submissions
router.get('/assignments/:id/submissions', async (req, res) => {
    try {
        const submissions = await Submission.find({ assignmentId: req.params.id }).populate('studentId', 'name username email');
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/submissions', async (req, res) => {
    try {
        const newSubmission = new Submission({
            ...req.body,
            studentId: req.user.id // use midlleware id
        });
        const savedSubmission = await newSubmission.save();
        res.status(201).json(savedSubmission);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Grading
router.put('/submissions/:id', async (req, res) => {
    try {
        const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(submission);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Quiz Results
router.post('/quiz-results', async (req, res) => {
    try {
        const newResult = new QuizResult({
            ...req.body,
            studentId: req.user.id
        });
        const savedResult = await newResult.save();
        res.status(201).json(savedResult);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/quizzes/:id/results', async (req, res) => {
    try {
        const results = await QuizResult.find({ quizId: req.params.id }).populate('studentId', 'name username email');
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/my-submissions', async (req, res) => {
    try {
        const submissions = await Submission.find({ studentId: req.user.id });
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/my-quiz-results', async (req, res) => {
    try {
        const results = await QuizResult.find({ studentId: req.user.id });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;


