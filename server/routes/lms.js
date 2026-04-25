const express = require('express');
const router = express.Router();
const { getTenantModels } = require('../utils/tenantManager');
const auth = require('../middleware/auth');

const getLMSModels = async (req) => {
    return req.tenantModels || await getTenantModels(req.tenantSlug);
};
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

// @route   GET /api/lms/courses
// @desc    Get courses based on role (HOD/Admin: all, Faculty: own, Student: all in institution)
router.get('/courses', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const institutionId = req.user.institutionId || req.query.institutionId;
        const { role } = req.user;
        
        if (!institutionId && role !== 'COMPANY_ADMIN') {
            return res.status(400).json({ message: 'Institution ID is required' });
        }

        let query = {};
        if (institutionId) query.institutionId = institutionId;

        const courses = await LMSCourse.find(query)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount');
        res.json(courses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/courses', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const institutionId = req.user.institutionId || req.body.institutionId;
        if (!institutionId) return res.status(400).json({ message: 'Institution ID is required' });

        const facultyId = req.user.role === 'FACULTY' ? req.user.id : (req.body.facultyId || req.user.id);

        const newCourse = new LMSCourse({
            ...req.body,
            institutionId,
            facultyId
        });

        const savedCourse = await newCourse.save();
        res.status(201).json(savedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/courses/:id', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const institutionId = req.user.institutionId || req.query.institutionId;
        const query = { _id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await LMSCourse.findOne(query)
            .populate('facultyId', 'name email')
            .populate('students', 'name email')
            .populate('modules.assignments')
            .populate('modules.quizzes');
        
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(course);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/courses/:id/modules', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const institutionId = req.user.institutionId || req.body.institutionId;
        const query = { _id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await LMSCourse.findOne(query);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        course.modules.push({
            title: req.body.title,
            week: req.body.week,
            description: req.body.description
        });
        await course.save();
        const updatedCourse = await LMSCourse.findById(course._id)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate('modules.assignments')
            .populate('modules.quizzes');
        res.status(201).json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/assignments', auth, async (req, res) => {
    try {
        const { LMSCourse, Assignment } = await getLMSModels(req);
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const newAssignment = new Assignment(req.body);
        const savedAssignment = await newAssignment.save();
        
        await LMSCourse.updateOne(
            { _id: req.body.courseId, "modules._id": req.body.moduleId },
            { $push: { "modules.$.assignments": savedAssignment._id } }
        );

        const updatedCourse = await LMSCourse.findById(req.body.courseId)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate('modules.assignments')
            .populate('modules.quizzes');
            
        res.status(201).json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/quizzes', auth, async (req, res) => {
    try {
        const { LMSCourse, Quiz } = await getLMSModels(req);
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const newQuiz = new Quiz(req.body);
        const savedQuiz = await newQuiz.save();
        
        await LMSCourse.updateOne(
            { _id: req.body.courseId, "modules._id": req.body.moduleId },
            { $push: { "modules.$.quizzes": savedQuiz._id } }
        );

        const updatedCourse = await LMSCourse.findById(req.body.courseId)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate('modules.assignments')
            .populate('modules.quizzes');
            
        res.status(201).json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/courses/:id/enroll', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const isStaff = ['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role);
        const { studentId } = req.body;
        
        if (!isStaff && studentId !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (!course.students.includes(studentId)) {
            course.students.push(studentId);
            await course.save();
        }
        
        const updatedCourse = await LMSCourse.findById(req.params.id)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate('modules.assignments')
            .populate('modules.quizzes');
        res.json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/institution-students', auth, async (req, res) => {
    try {
        const { User } = await getLMSModels(req);
        const institutionId = req.user.institutionId || req.query.institutionId;
        if (!institutionId) return res.status(400).json({ message: 'Institution ID required' });

        const students = await User.find({ institutionId, role: 'STUDENT' }).select('name email username lastLogin loginCount');
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/assignments/:id/submissions', auth, async (req, res) => {
    try {
        const { Submission } = await getLMSModels(req);
        const submissions = await Submission.find({ assignmentId: req.params.id }).populate('studentId', 'name username email');
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/submissions', auth, async (req, res) => {
    try {
        const { Submission } = await getLMSModels(req);
        const newSubmission = new Submission({
            ...req.body,
            studentId: req.user.id
        });
        const savedSubmission = await newSubmission.save();
        res.status(201).json(savedSubmission);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/submissions/:id', auth, async (req, res) => {
    try {
        const { Submission } = await getLMSModels(req);
        const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(submission);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/quiz-results', auth, async (req, res) => {
    try {
        const { QuizResult } = await getLMSModels(req);
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

router.get('/quizzes/:id/results', auth, async (req, res) => {
    try {
        const { QuizResult } = await getLMSModels(req);
        const results = await QuizResult.find({ quizId: req.params.id }).populate('studentId', 'name username email');
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/quizzes/:id', auth, async (req, res) => {
    try {
        const { Quiz } = await getLMSModels(req);
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(quiz);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/my-submissions', auth, async (req, res) => {
    try {
        const { Submission } = await getLMSModels(req);
        const submissions = await Submission.find({ studentId: req.user.id });
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/my-quiz-results', auth, async (req, res) => {
    try {
        const { QuizResult } = await getLMSModels(req);
        const results = await QuizResult.find({ studentId: req.user.id });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Course
router.delete('/courses/:id', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        if (!['HOD', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        await LMSCourse.findByIdAndDelete(req.params.id);
        res.json({ message: 'Course deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Edit Module
router.put('/courses/:id/modules/:moduleId', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        const module = course.modules.id(req.params.moduleId);
        if (!module) return res.status(404).json({ message: 'Module not found' });
        
        module.title = req.body.title || module.title;
        module.week = req.body.week || module.week;
        module.description = req.body.description || module.description;
        
        await course.save();
        const updatedCourse = await LMSCourse.findById(course._id)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate('modules.assignments')
            .populate('modules.quizzes');
        res.json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete Module
router.delete('/courses/:id/modules/:moduleId', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        course.modules.pull(req.params.moduleId);
        await course.save();
        res.json(course);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Edit Material
router.put('/courses/:id/modules/:moduleId/materials/:materialId', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        const module = course.modules.id(req.params.moduleId);
        const material = module.materials.id(req.params.materialId);
        Object.assign(material, req.body);
        await course.save();
        res.json(course);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete Material
router.delete('/courses/:id/modules/:moduleId/materials/:materialId', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        const module = course.modules.id(req.params.moduleId);
        module.materials.pull(req.params.materialId);
        await course.save();
        const updatedCourse = await LMSCourse.findById(course._id)
            .populate('facultyId', 'name email')
            .populate('students', 'name email username lastLogin loginCount')
            .populate('modules.assignments')
            .populate('modules.quizzes');
        res.json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Edit/Delete Assignment
router.put('/assignments/:id', auth, async (req, res) => {
    try {
        const { Assignment } = await getLMSModels(req);
        const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(assignment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/assignments/:id', auth, async (req, res) => {
    try {
        const { LMSCourse, Assignment } = await getLMSModels(req);
        const assignment = await Assignment.findById(req.params.id);
        if (assignment) {
            await LMSCourse.updateOne(
                { _id: assignment.courseId },
                { $pull: { "modules.$[].assignments": assignment._id } }
            );
            await Assignment.findByIdAndDelete(req.params.id);
        }
        res.json({ message: 'Assignment deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Quiz
router.delete('/quizzes/:id', auth, async (req, res) => {
    try {
        const { LMSCourse, Quiz } = await getLMSModels(req);
        const quiz = await Quiz.findById(req.params.id);
        if (quiz) {
            await LMSCourse.updateOne(
                { _id: quiz.courseId },
                { $pull: { "modules.$[].quizzes": quiz._id } }
            );
            await Quiz.findByIdAndDelete(req.params.id);
        }
        res.json({ message: 'Quiz deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Unenroll Student
router.delete('/courses/:id/enroll/:studentId', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        course.students.pull(req.params.studentId);
        await course.save();
        const updatedCourse = await LMSCourse.findById(req.params.id).populate('students', 'name email username lastLogin loginCount');
        res.json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;


