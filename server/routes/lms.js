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
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const fileUrl = `${protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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

// Add Material to Module
router.post('/courses/:id/modules/:moduleId/materials', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        const module = course.modules.id(req.params.moduleId);
        if (!module) return res.status(404).json({ message: 'Module not found' });

        module.materials.push({
            title: req.body.title,
            url: req.body.url,
            type: req.body.type
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

/**
 * Resolves a User ID to its tenant-specific counterpart.
 * Necessary because users mirrored from Main DB might have different _id values in the Tenant DB.
 */
const resolveTenantUserId = async (req, userId) => {
    const { User: TenantUser } = await getLMSModels(req);
    const tenantUser = await TenantUser.findById(userId);
    
    if (tenantUser) return tenantUser._id;
    
    // If not found by ID (likely a Main DB ID), try finding by username
    if (req.user && req.user.username) {
        const resolvedUser = await TenantUser.findOne({ username: req.user.username });
        if (resolvedUser) return resolvedUser._id;
    }
    
    return userId; // Fallback
};

router.post('/courses/:id/enroll', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const isStaff = ['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role);
        const { studentId } = req.body;
        
        if (!isStaff && studentId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const resolvedStudentId = await resolveTenantUserId(req, studentId);

        // Use addToSet to avoid duplicates and handle ObjectIds/Strings correctly
        // We add BOTH the provided ID (from token) and the resolved ID (from tenant DB)
        // to ensure compatibility with both global and local context.
        course.students.addToSet(studentId);
        course.students.addToSet(resolvedStudentId);
        await course.save();

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


router.get('/courses/:id/student-stats', auth, async (req, res) => {
    try {
        const { LMSCourse, QuizResult, User } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // 1. Get all students in the institution
        const students = await User.find({ institutionId: course.institutionId, role: 'STUDENT' })
            .select('name email username lastLogin loginCount');

        // 2. Get all quiz IDs for this course
        const quizIds = course.modules.flatMap(m => m.quizzes);

        // 3. Get all results for these quizzes
        const results = await QuizResult.find({ quizId: { $in: quizIds } });

        // 4. Map students to their stats
        const stats = students.map(s => {
            const studentResults = results.filter(r => r.studentId.toString() === s._id.toString());
            const completedCount = new Set(studentResults.map(r => r.quizId.toString())).size;
            const totalQuizzes = quizIds.length;
            
            return {
                ...s.toObject(),
                completedQuizzes: completedCount,
                totalQuizzes: totalQuizzes,
                progress: totalQuizzes > 0 ? Math.round((completedCount / totalQuizzes) * 100) : 0
            };
        });

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        
        // Fallback for existing records with Main DB IDs that didn't populate
        const UserRegistry = require('../models/User');
        const MainUser = UserRegistry.getUserModel(require('mongoose').connection);
        
        const fixedSubmissions = await Promise.all(submissions.map(async (sub) => {
            const subObj = sub.toObject();
            if (!subObj.studentId || typeof subObj.studentId === 'string' || !subObj.studentId.name) {
                const searchId = subObj.studentId?._id || subObj.studentId;
                if (searchId) {
                    const mainUser = await MainUser.findById(searchId);
                    if (mainUser) {
                        subObj.studentId = {
                            _id: mainUser._id,
                            name: mainUser.name,
                            username: mainUser.username,
                            email: mainUser.email
                        };
                    }
                }
            }
            return subObj;
        }));

        res.json(fixedSubmissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.post('/submissions', auth, async (req, res) => {
    try {
        const { Submission } = await getLMSModels(req);
        const resolvedStudentId = await resolveTenantUserId(req, req.user.id);
        const newSubmission = new Submission({
            ...req.body,
            studentId: resolvedStudentId
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
        const resolvedStudentId = await resolveTenantUserId(req, req.user.id);
        const newResult = new QuizResult({
            ...req.body,
            studentId: resolvedStudentId
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
        
        // Fallback for existing records with Main DB IDs that didn't populate
        const UserRegistry = require('../models/User');
        const MainUser = UserRegistry.getUserModel(require('mongoose').connection);
        
        const fixedResults = await Promise.all(results.map(async (result) => {
            const resultObj = result.toObject();
            if (!resultObj.studentId || typeof resultObj.studentId === 'string' || !resultObj.studentId.name) {
                const searchId = resultObj.studentId?._id || resultObj.studentId;
                if (searchId) {
                    const mainUser = await MainUser.findById(searchId);
                    if (mainUser) {
                        resultObj.studentId = {
                            _id: mainUser._id,
                            name: mainUser.name,
                            username: mainUser.username,
                            email: mainUser.email
                        };
                    }
                }
            }
            return resultObj;
        }));

        res.json(fixedResults);
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

// Edit Material
router.put('/courses/:id/modules/:moduleId/materials/:materialId', auth, async (req, res) => {
    try {
        const { LMSCourse } = await getLMSModels(req);
        const course = await LMSCourse.findById(req.params.id);
        const module = course.modules.id(req.params.moduleId);
        const material = module.materials.id(req.params.materialId);
        Object.assign(material, req.body);
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


