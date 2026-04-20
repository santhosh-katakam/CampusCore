import React, { useState, useEffect } from 'react';
import axios from './api/axios';

const LMSPortal = ({ user, viewingAs, setIsQuizMode }) => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCourse, setActiveCourse] = useState(null);
    const [view, setView] = useState('list'); // 'list', 'detail', 'create'
    const [subTab, setSubTab] = useState('content'); // 'content', 'assignments', 'quizzes', 'students'

    const [institutionStudents, setInstitutionStudents] = useState([]);
    const [showAddModal, setShowAddModal] = useState(null); // 'material', 'assignment', 'quiz'
    const [modalData, setModalData] = useState({});
    const [targetModule, setTargetModule] = useState(null);
    const [quizPlay, setQuizPlay] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [activeAssignment, setActiveAssignment] = useState(null);
    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [mySubmissions, setMySubmissions] = useState([]);
    const [myQuizResults, setMyQuizResults] = useState([]);
    const [quizResults, setQuizResults] = useState([]); // For faculty viewing all results of a quiz
    const [activeQuizId, setActiveQuizId] = useState(null);

    useEffect(() => {
        if (setIsQuizMode) {
            setIsQuizMode(!!quizPlay);
        }
        // Cleanup on unmount
        return () => {
            if (setIsQuizMode) setIsQuizMode(false);
        };
    }, [quizPlay, setIsQuizMode]);



    const startQuiz = (quiz) => {
        setQuizPlay({
            ...quiz,
            currentQuestion: 0,
            answers: {},
            completed: false
        });
        setSubTab('quizzes');
    };

    const submitQuiz = async () => {
        const questions = quizPlay.questions;
        const answers = quizPlay.answers;
        let score = 0;
        const results = [];

        questions.forEach((q, idx) => {
            const selected = answers[idx];
            const isCorrect = selected === q.correctOption;
            if (isCorrect) score += (q.marks || 1);
            results.push({
                questionId: q._id,
                selectedOption: selected,
                isCorrect
            });
        });

        const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 1), 0);

        try {
            await axios.post('/lms/quiz-results', {
                quizId: quizPlay._id,
                score,
                totalMarks,
                answers: results
            });
            alert(`Quiz submitted! Your score: ${score} / ${totalMarks}`);
            setQuizPlay(null);
            fetchCourses(); // Refresh to show results if needed
        } catch (err) {
            alert('Failed to submit quiz: ' + err.message);
        }
    };


    const openModal = (type, moduleId) => {
        setShowAddModal(type);
        setTargetModule(moduleId);
        setModalData({});
    };

    const closeModal = () => {
        setShowAddModal(null);
        setModalData({});
        setTargetModule(null);
        setUploading(false);
    };

    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/lms/upload', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setModalData({ ...modalData, url: res.data.url, attachmentUrl: res.data.url });
            setUploading(false);
        } catch (err) {
            alert('Upload failed: ' + err.message);
            setUploading(false);
        }
    };

    const handleModalSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            if (showAddModal === 'material') {
                const res = await axios.post(`/lms/courses/${activeCourse._id}/modules/${targetModule}/materials`, modalData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setActiveCourse(res.data);
            } else if (showAddModal === 'assignment') {
                const res = await axios.post('/lms/assignments', {
                    ...modalData,
                    courseId: activeCourse._id,
                    moduleId: targetModule
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setActiveCourse(res.data);
            } else if (showAddModal === 'quiz') {
                const res = await axios.post('/lms/quizzes', {
                    ...modalData,
                    courseId: activeCourse._id,
                    moduleId: targetModule,
                    questions: [] // Basic start
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setActiveCourse(res.data);
            }
            closeModal();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const fetchCourses = async () => {
        try {
            const token = localStorage.getItem('token');
            const instId = localStorage.getItem('viewingInstitutionId');
            const res = await axios.get(`/lms/courses${instId ? `?institutionId=${instId}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCourses(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching courses:', err);
            setLoading(false);
        }
    };

    const fetchCourseDetail = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/lms/courses/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveCourse(res.data);
        } catch (err) {
            console.error('Error fetching course detail:', err);
        }
    };

    const handleCreateCourse = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Add institutionId if missing (for COMPANY_ADMIN)
        if (!data.institutionId) {
            const instId = localStorage.getItem('viewingInstitutionId');
            if (instId) data.institutionId = instId;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('/lms/courses', data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setView('list');
            fetchCourses();
        } catch (err) {
            alert('Error creating course: ' + (err.response?.data?.message || err.message));
        }
    };

    const addMaterial = async (moduleId) => {
        const title = prompt("Material Title:");
        const url = prompt("Material URL:");
        const type = prompt("Material Type (video, pdf, link):");
        
        if (!title || !url || !type) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`/lms/courses/${activeCourse._id}/modules/${moduleId}/materials`, { title, url, type }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCourseDetail(activeCourse._id);
        } catch (err) {
            alert('Error adding material: ' + err.message);
        }
    };

    useEffect(() => {
        fetchCourses();
        if (viewingAs === 'hod' || viewingAs === 'faculty') {
            fetchInstitutionStudents();
        } else if (viewingAs === 'student') {
            fetchMySubmissions();
            fetchMyQuizResults();
        }
    }, [viewingAs]);

    const fetchMySubmissions = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/lms/my-submissions', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMySubmissions(res.data);
        } catch (err) {
            console.error('Error fetching my submissions:', err);
        }
    };

    const fetchMyQuizResults = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/lms/my-quiz-results', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMyQuizResults(res.data);
        } catch (err) {
            console.error('Error fetching my quiz results:', err);
        }
    };


    const fetchInstitutionStudents = async () => {
        try {
            const token = localStorage.getItem('token');
            const instId = localStorage.getItem('viewingInstitutionId');
            const res = await axios.get(`/lms/institution-students${instId ? `?institutionId=${instId}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstitutionStudents(res.data);
        } catch (err) {
            console.error('Error fetching students:', err);
        }
    };

    const addModule = async () => {
        const title = prompt("Module Title:");
        const week = prompt("Week Number:");
        if (!title || !week) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`/lms/courses/${activeCourse._id}/modules`, { title, week }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveCourse(res.data);
        } catch (err) {
            alert('Error adding module: ' + err.message);
        }
    };

    const addAssignment = async (moduleId) => {
        const title = prompt("Assignment Title:");
        const desc = prompt("Description:");
        const dueDate = prompt("Due Date (YYYY-MM-DD):");
        const maxMarks = prompt("Max Marks:");
        if (!title || !dueDate || !maxMarks) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/lms/assignments', {
                courseId: activeCourse._id,
                moduleId,
                title,
                description: desc,
                dueDate,
                maxMarks
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveCourse(res.data);
        } catch (err) {
            alert('Error adding assignment: ' + err.message);
        }
    };

    const addQuiz = async (moduleId) => {
        const title = prompt("Quiz Title:");
        if (!title) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/lms/quizzes', {
                courseId: activeCourse._id,
                moduleId,
                title,
                questions: [] 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveCourse(res.data);
            alert("Quiz created! Now click on the quiz to add questions.");
        } catch (err) {
            alert('Error adding quiz: ' + err.message);
        }
    };

    const handleAddQuestionToQuiz = async (quizId) => {
        const questionText = prompt("Question Text:");
        if (!questionText) return;
        const options = [];
        for (let i = 0; i < 4; i++) {
            const opt = prompt(`Option ${i+1}:`);
            if (!opt) return;
            options.push(opt);
        }
        const correctOption = parseInt(prompt("Correct Option Index (1-4):")) - 1;
        if (isNaN(correctOption) || correctOption < 0 || correctOption > 3) {
            alert("Invalid index");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const currentQuiz = activeCourse.modules.flatMap(m => m.quizzes).find(q => q._id === quizId);
            const updatedQuestions = [...currentQuiz.questions, { questionText, options, correctOption }];
            
            await axios.put(`/lms/quizzes/${quizId}`, { questions: updatedQuestions }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Refresh course
            fetchCourseDetail(activeCourse._id);
            alert("Question added!");
        } catch (err) {
            alert('Error adding question: ' + err.message);
        }
    };

    const enrollStudent = async (studentId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`/lms/courses/${activeCourse._id}/enroll`, { studentId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveCourse(res.data);
            alert("Student enrolled successfully!");
        } catch (err) {
            alert('Enrollment failed: ' + (err.response?.data?.message || err.message));
        }
    };


    const fetchSubmissions = async (assignmentId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/lms/assignments/${assignmentId}/submissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSubmissions(res.data);
            setActiveAssignment(assignmentId);
            setSubTab('submissions');
        } catch (err) {
            console.error('Error fetching submissions:', err);
        }
    };

    const submitAssignmentWork = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('/lms/submissions', {
                assignmentId: targetModule, // reuse targetModule for assignmentId in this context
                content: modalData.content,
                fileUrl: modalData.url || modalData.attachmentUrl
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Assignment submitted successfully!');
            closeModal();
        } catch (err) {
            alert('Submission failed: ' + err.message);
        }
    };

    const handleGradeSubmission = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/lms/submissions/${gradingSubmission._id}`, {
                grade: modalData.grade,
                feedback: modalData.feedback,
                status: 'graded'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Grade saved!');
            fetchSubmissions(activeAssignment);
            setGradingSubmission(null);
        } catch (err) {
            alert('Grading failed: ' + err.message);
        }
    };

    const addQuizQuestion = () => {
        const question = prompt("Question Text:");
        if (!question) return;
        const options = [];
        for (let i = 0; i < 4; i++) {
            options.push(prompt(`Option ${i+1}:`));
        }
        const correctAnswer = parseInt(prompt("Correct Option Index (1-4):")) - 1;
        
        setModalData(prev => ({
            ...prev,
            questions: [...(prev.questions || []), { question, options, correctAnswer }]
        }));
    };
    
    const fetchQuizResults = async (quizId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/lms/quizzes/${quizId}/results`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuizResults(res.data);
            setActiveQuizId(quizId);
            setSubTab('quiz_results');
        } catch (err) {
            console.error('Error fetching quiz results:', err);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading LMS...</div>;


    return (
        <div style={{ padding: '30px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontSize: '24px', color: '#2d3748' }}>📚 Learning Management System</h2>
                {(viewingAs === 'hod' || viewingAs === 'faculty') && view === 'list' && (
                    <button 
                        onClick={() => setView('create')}
                        style={{ background: '#4c51bf', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        + Create New Course
                    </button>
                )}
                {view !== 'list' && (
                    <button 
                        onClick={() => { setView('list'); setActiveCourse(null); }}
                        style={{ background: '#edf2f7', color: '#4a5568', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        ← Back to Courses
                    </button>
                )}
            </div>

            {view === 'list' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {courses.map(course => (
                        <div 
                            key={course._id} 
                            onClick={() => { fetchCourseDetail(course._id); setView('detail'); }}
                            style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer', border: '1px solid #e2e8f0', transition: '0.2s' }}
                        >
                            <div style={{ color: '#4c51bf', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>{course.category || 'General'}</div>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#1a202c' }}>{course.title}</h3>
                            <p style={{ color: '#718096', fontSize: '14px', marginBottom: '15px', height: '40px', overflow: 'hidden' }}>{course.description}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#a0aec0' }}>
                                <span>Faculty: {course.facultyId?.name}</span>
                                <span>{course.modules?.length || 0} Modules</span>
                            </div>
                        </div>
                    ))}
                    {courses.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', background: 'white', borderRadius: '24px', border: '2px dashed #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '64px', marginBottom: '20px' }}>{viewingAs === 'student' ? '🎓' : '📚'}</div>
                            <h3 style={{ color: '#2d3748', fontSize: '24px', marginBottom: '10px' }}>
                                {viewingAs === 'student' ? 'No Enrolled Courses' : 'No Courses Created'}
                            </h3>
                            <p style={{ color: '#718096', fontSize: '16px', maxWidth: '400px', margin: '0 auto 30px auto' }}>
                                {viewingAs === 'student' 
                                    ? "You haven't been enrolled in any courses yet. Once your faculty adds you, they will appear here." 
                                    : "Start by creating your first course to share materials and assessments with your students."}
                            </p>
                            {viewingAs !== 'student' && (
                                <button 
                                    onClick={() => setView('create')}
                                    style={{ background: '#4c51bf', color: 'white', padding: '12px 30px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(76, 81, 191, 0.3)' }}
                                >
                                    + Create New Course
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {view === 'create' && (
                <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: '800px', margin: '0 auto' }}>
                    <h3 style={{ marginBottom: '25px' }}>Create New LMS Course</h3>
                    <form onSubmit={handleCreateCourse}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Course Title</label>
                                <input name="title" required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} placeholder="e.g. Advanced Web Development" />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Description</label>
                                <textarea name="description" rows="4" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} placeholder="Describe the course content..."></textarea>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Category</label>
                                    <input name="category" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} placeholder="e.g. Technical" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Department</label>
                                    <input name="department" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} placeholder="e.g. CSE" />
                                </div>
                            </div>
                            <button type="submit" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '15px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                                Create Course
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {view === 'detail' && activeCourse && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 3fr', gap: '30px' }}>
                    {/* Course Sidebar */}
                    <div style={{ background: 'white', padding: '25px', borderRadius: '15px', border: '1px solid #e2e8f0', alignSelf: 'start' }}>
                        <h3 style={{ margin: '0 0 15px 0' }}>{activeCourse.title}</h3>
                        <p style={{ color: '#4a5568', fontSize: '14px', marginBottom: '20px' }}>{activeCourse.description}</p>
                        
                        <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '15px' }}>
                            <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Modules</h4>
                            {activeCourse.modules?.map((mod, idx) => (
                                <div key={idx} style={{ padding: '10px', borderRadius: '5px', background: '#f8fafc', marginBottom: '5px', fontSize: '13px' }}>
                                    Week {mod.week}: {mod.title}
                                </div>
                            ))}
                            {(viewingAs === 'hod' || viewingAs === 'faculty') && (
                                <button 
                                    onClick={addModule}
                                    style={{ width: '100%', background: '#edf2f7', border: 'none', padding: '8px', borderRadius: '5px', color: '#4c51bf', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
                                >
                                    + Add Module
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div style={{ background: 'white', padding: '30px', borderRadius: '15px', border: '1px solid #e2e8f0', minHeight: '600px' }}>
                        <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #edf2f7', marginBottom: '30px' }}>
                            {['Content', 'Assignments', 'Quizzes', ...(viewingAs !== 'student' ? ['Students'] : []), ...(gradingSubmission || activeAssignment ? ['Submissions'] : []), ...(activeQuizId ? ['Quiz Results'] : [])].map(tab => (
                                <div 
                                    key={tab}
                                    onClick={() => {
                                        const newSubTab = tab.replace(' ', '_').toLowerCase();
                                        setSubTab(newSubTab);
                                        // Re-fetch details when switching to assignments/quizzes to get latest data
                                        if (['assignments', 'quizzes', 'content'].includes(newSubTab) && activeCourse?._id) {
                                            fetchCourseDetail(activeCourse._id);
                                        }
                                    }}
                                    style={{ 
                                        paddingBottom: '15px', 
                                        borderBottom: subTab === tab.replace(' ', '_').toLowerCase() ? '2px solid #4c51bf' : 'none', 
                                        color: subTab === tab.replace(' ', '_').toLowerCase() ? '#4c51bf' : '#718096', 
                                        fontWeight: subTab === tab.replace(' ', '_').toLowerCase() ? 'bold' : 'normal',
                                        cursor: 'pointer' 
                                    }}
                                >
                                    {tab}
                                </div>
                            ))}


                        </div>

                        {subTab === 'content' && (
                            <div>
                                {activeCourse.modules?.length === 0 ? (
                                    <div style={{ textAlign: 'center', paddingTop: '100px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📖</div>
                                        <h3>Empty Course</h3>
                                        <p style={{ color: '#718096', marginBottom: '25px' }}>There are no modules in this course yet.</p>
                                        {(viewingAs === 'hod' || viewingAs === 'faculty') && (
                                            <button 
                                                onClick={addModule}
                                                style={{ background: '#4c51bf', color: 'white', padding: '12px 24px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 12px rgba(76, 81, 191, 0.3)' }}
                                            >
                                                + Add Your First Module
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {activeCourse.modules.map((mod, idx) => (
                                            <div key={idx} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                                    <h4 style={{ margin: 0 }}>Week {mod.week}: {mod.title}</h4>
                                                    {(viewingAs === 'hod' || viewingAs === 'faculty') && (
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            <button 
                                                                onClick={() => openModal('assignment', mod._id)}
                                                                style={{ background: '#48bb78', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                                            >
                                                                + Assignment
                                                            </button>
                                                            <button 
                                                                onClick={() => openModal('quiz', mod._id)}
                                                                style={{ background: '#f6ad55', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                                            >
                                                                + Quiz
                                                            </button>
                                                            <button 
                                                                onClick={() => openModal('material', mod._id)}
                                                                style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                                            >
                                                                + Material
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {mod.materials?.map((mat, midx) => (
                                                        <a key={midx} href={mat.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#4a5568', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                                                            <span>{mat.type === 'video' ? '🎥' : (mat.type === 'pdf' ? '📄' : '🔗')}</span>
                                                            <span style={{ fontSize: '14px' }}>{mat.title}</span>
                                                        </a>
                                                    ))}
                                                    {mod.materials?.length === 0 && <p style={{ fontSize: '13px', color: '#a0aec0', margin: 0 }}>No materials uploaded yet.</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {subTab === 'assignments' && (
                            <div>
                                <h4 style={{ marginBottom: '20px' }}>Course Assignments</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {(activeCourse.modules || []).flatMap(m => m.assignments || []).map((asn, idx) => (

                                        <div key={idx} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h5 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{asn.title}</h5>
                                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#4a5568', lineHeight: '1.5' }}>{asn.description}</p>
                                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#f56565' }}>Due: {new Date(asn.dueDate).toLocaleDateString()} | Max Marks: {asn.maxMarks}</p>
                                                </div>
                                                 <button 
                                                    onClick={() => {
                                                        if (viewingAs === 'student') {
                                                            openModal('submit_work', asn._id);
                                                        } else {
                                                            fetchSubmissions(asn._id);
                                                        }
                                                    }}
                                                    style={{ background: viewingAs === 'student' ? '#4c51bf' : '#48bb78', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                >
                                                    {viewingAs === 'student' ? (mySubmissions.find(s => s.assignmentId === asn._id) ? 'Resubmit' : 'Submit Work') : 'Review Submissions'}
                                                </button>
                                            </div>
                                            {viewingAs === 'student' && mySubmissions.find(s => s.assignmentId === asn._id) && (
                                                <div style={{ marginTop: '15px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #edf2f7', fontSize: '13px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                        <span style={{ color: '#718096' }}>Status:</span>
                                                        <span style={{ color: mySubmissions.find(s => s.assignmentId === asn._id).status === 'graded' ? '#48bb78' : '#4c51bf', fontWeight: 'bold' }}>
                                                            {mySubmissions.find(s => s.assignmentId === asn._id).status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    {mySubmissions.find(s => s.assignmentId === asn._id).grade !== null && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#718096' }}>Grade:</span>
                                                            <span style={{ color: '#1a202c', fontWeight: 'bold' }}>{mySubmissions.find(s => s.assignmentId === asn._id).grade} / {asn.maxMarks}</span>
                                                        </div>
                                                    )}
                                                    {mySubmissions.find(s => s.assignmentId === asn._id).feedback && (
                                                        <div style={{ marginTop: '10px', color: '#4a5568', fontStyle: 'italic', borderTop: '1px dashed #edf2f7', paddingTop: '10px' }}>
                                                            Feedback: {mySubmissions.find(s => s.assignmentId === asn._id).feedback}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    ))}
                                    {(activeCourse.modules || []).flatMap(m => m.assignments || []).length === 0 && (

                                        <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px' }}>
                                            <p>No assignments yet.</p>
                                            {(viewingAs === 'hod' || viewingAs === 'faculty') && activeCourse.modules.length > 0 && (
                                                <button 
                                                    onClick={() => openModal('assignment', activeCourse.modules[0]._id)}
                                                    style={{ background: '#edf2f7', color: '#4c51bf', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    + Add First Assignment
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {subTab === 'submissions' && (
                            <div>
                                <h4 style={{ marginBottom: '20px' }}>Student Submissions</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {submissions.map(sub => (
                                        <div key={sub._id} style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{sub.studentId?.name}</div>
                                                <div style={{ fontSize: '12px', color: '#718096' }}>Submitted: {new Date(sub.submittedAt).toLocaleString()}</div>
                                                {sub.grade && <div style={{ fontSize: '12px', color: '#48bb78', fontWeight: 'bold' }}>Grade: {sub.grade}</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {sub.fileUrl && <a href={sub.fileUrl} target="_blank" rel="noreferrer" style={{ background: '#edf2f7', color: '#4c51bf', padding: '5px 10px', borderRadius: '5px', textDecoration: 'none', fontSize: '12px' }}>View File</a>}
                                                <button 
                                                    onClick={() => { setGradingSubmission(sub); setShowAddModal('grade'); setModalData({ grade: sub.grade, feedback: sub.feedback }); }}
                                                    style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                                >
                                                    {sub.grade ? 'Edit Grade' : 'Grade'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {submissions.length === 0 && <p style={{ textAlign: 'center', color: '#a0aec0' }}>No submissions yet.</p>}
                                </div>
                            </div>
                        )}

                        {subTab === 'quizzes' && (
                            <div>
                                {quizPlay ? (
                                    <div style={{ background: '#f8fafc', padding: '40px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #edf2f7', paddingBottom: '20px' }}>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>{quizPlay.title}</h3>
                                                <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '14px' }}>Question {quizPlay.currentQuestion + 1} of {quizPlay.questions.length}</p>
                                            </div>
                                            <div style={{ background: '#4c51bf', color: 'white', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold' }}>
                                                Time Remaining: 29:55
                                            </div>
                                        </div>
                                        
                                        {quizPlay.questions?.length > 0 ? (
                                            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                                                <div style={{ background: 'white', padding: '30px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                                                    <h4 style={{ margin: '0 0 25px 0', fontSize: '20px', color: '#2d3748', lineHeight: '1.4' }}>
                                                        {quizPlay.questions[quizPlay.currentQuestion].questionText}
                                                    </h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                                        {quizPlay.questions[quizPlay.currentQuestion].options.map((opt, oidx) => (
                                                            <div 
                                                                key={oidx}
                                                                onClick={() => setQuizPlay({ ...quizPlay, answers: { ...quizPlay.answers, [quizPlay.currentQuestion]: oidx } })}
                                                                style={{ 
                                                                    padding: '20px', 
                                                                    borderRadius: '12px', 
                                                                    border: '2px solid',
                                                                    borderColor: quizPlay.answers[quizPlay.currentQuestion] === oidx ? '#4c51bf' : '#edf2f7',
                                                                    background: quizPlay.answers[quizPlay.currentQuestion] === oidx ? '#f0f3ff' : 'white',
                                                                    cursor: 'pointer',
                                                                    transition: '0.2s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '15px',
                                                                    fontWeight: quizPlay.answers[quizPlay.currentQuestion] === oidx ? 'bold' : 'normal',
                                                                    color: quizPlay.answers[quizPlay.currentQuestion] === oidx ? '#4c51bf' : '#4a5568'
                                                                }}
                                                            >
                                                                <div style={{ 
                                                                    width: '30px', 
                                                                    height: '30px', 
                                                                    borderRadius: '50%', 
                                                                    background: quizPlay.answers[quizPlay.currentQuestion] === oidx ? '#4c51bf' : '#edf2f7',
                                                                    color: quizPlay.answers[quizPlay.currentQuestion] === oidx ? 'white' : '#718096',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '14px'
                                                                }}>
                                                                    {String.fromCharCode(65 + oidx)}
                                                                </div>
                                                                {opt}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <button 
                                                        disabled={quizPlay.currentQuestion === 0}
                                                        onClick={() => setQuizPlay({ ...quizPlay, currentQuestion: quizPlay.currentQuestion - 1 })}
                                                        style={{ background: '#edf2f7', color: '#4a5568', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 'bold', cursor: quizPlay.currentQuestion === 0 ? 'not-allowed' : 'pointer', opacity: quizPlay.currentQuestion === 0 ? 0.5 : 1 }}
                                                    >
                                                        Previous Question
                                                    </button>
                                                    
                                                    {quizPlay.currentQuestion < quizPlay.questions.length - 1 ? (
                                                        <button 
                                                            onClick={() => setQuizPlay({ ...quizPlay, currentQuestion: quizPlay.currentQuestion + 1 })}
                                                            style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >
                                                            Next Question
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={submitQuiz}
                                                            style={{ background: '#48bb78', color: 'white', border: 'none', padding: '12px 40px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(72, 187, 120, 0.3)' }}
                                                        >
                                                            Finalize & Submit Quiz
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '50px' }}>
                                                <p style={{ color: '#718096', fontSize: '18px' }}>This quiz has no questions yet.</p>
                                                <button 
                                                    onClick={() => setQuizPlay(null)}
                                                    style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    Go Back
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <h4 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>⏱️</span> Course Assessments
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                                            {(activeCourse.modules || []).flatMap(m => m.quizzes || []).map((quiz, idx) => (
                                                quiz && typeof quiz === 'object' && (

                                                <React.Fragment key={idx}>
                                                    <div style={{ padding: '25px', border: '1px solid #e2e8f0', borderRadius: '16px', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                                <h5 style={{ margin: 0, fontSize: '18px', color: '#1a202c' }}>{quiz.title}</h5>
                                                                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Active</span>
                                                            </div>
                                                            <p style={{ margin: 0, fontSize: '14px', color: '#718096' }}>
                                                                {quiz.questions?.length || 0} Questions • 30 Minutes • Multiple Choice
                                                            </p>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            {(viewingAs === 'hod' || viewingAs === 'faculty') && (
                                                                <button 
                                                                    onClick={() => handleAddQuestionToQuiz(quiz._id)}
                                                                    style={{ background: '#edf2f7', color: '#4c51bf', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    + Add Question
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={() => startQuiz(quiz)}
                                                                style={{ 
                                                                    background: viewingAs === 'student' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f6ad55', 
                                                                    color: 'white', 
                                                                    border: 'none', 
                                                                    padding: '10px 25px', 
                                                                    borderRadius: '8px', 
                                                                    fontSize: '14px', 
                                                                    fontWeight: 'bold', 
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                                }}
                                                            >
                                                                {viewingAs === 'student' ? (myQuizResults.find(r => r.quizId === quiz._id) ? 'Retake Quiz' : 'Take Quiz') : 'Preview Quiz'}
                                                            </button>
                                                            {(viewingAs === 'hod' || viewingAs === 'faculty') && (
                                                                <button 
                                                                    onClick={() => fetchQuizResults(quiz._id)}
                                                                    style={{ background: '#48bb78', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    View Results
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {viewingAs === 'student' && myQuizResults.find(r => r.quizId === quiz._id) && (
                                                        <div style={{ marginTop: '-10px', marginBottom: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '0 0 16px 16px', border: '1px solid #dcfce7', borderTop: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '14px', color: '#166534', fontWeight: 'bold' }}>Last Score: {myQuizResults.find(r => r.quizId === quiz._id).score} / {myQuizResults.find(r => r.quizId === quiz._id).totalMarks}</span>
                                                            <span style={{ fontSize: '12px', color: '#166534' }}>Completed: {new Date(myQuizResults.find(r => r.quizId === quiz._id).completedAt).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                                )
                                            ))}

                                            {(activeCourse.modules || []).flatMap(m => m.quizzes || []).length === 0 && (

                                                <div style={{ textAlign: 'center', color: '#a0aec0', padding: '60px', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #e2e8f0' }}>
                                                    <div style={{ fontSize: '40px', marginBottom: '15px' }}>❓</div>
                                                    <p style={{ fontWeight: '500' }}>No quizzes scheduled yet.</p>
                                                    {(viewingAs === 'hod' || viewingAs === 'faculty') && activeCourse.modules.length > 0 && (
                                                        <button 
                                                            onClick={() => openModal('quiz', activeCourse.modules[0]._id)}
                                                            style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}
                                                        >
                                                            Create First Quiz
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {subTab === 'quiz_results' && (
                            <div>
                                <h4 style={{ marginBottom: '20px' }}>Student Quiz Performances</h4>
                                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '12px 20px' }}>Student</th>
                                                <th style={{ textAlign: 'center', padding: '12px 20px' }}>Score</th>
                                                <th style={{ textAlign: 'center', padding: '12px 20px' }}>Percentage</th>
                                                <th style={{ textAlign: 'right', padding: '12px 20px' }}>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {quizResults.map((res, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{ fontWeight: '600' }}>{res.studentId?.name}</div>
                                                        <div style={{ fontSize: '11px', color: '#718096' }}>{res.studentId?.username}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold' }}>
                                                        {res.score} / {res.totalMarks}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                                        <span style={{ 
                                                            padding: '4px 8px', 
                                                            borderRadius: '12px', 
                                                            background: (res.score / res.totalMarks) >= 0.7 ? '#def7ec' : ((res.score / res.totalMarks) >= 0.4 ? '#fef3c7' : '#fde8e8'),
                                                            color: (res.score / res.totalMarks) >= 0.7 ? '#03543f' : ((res.score / res.totalMarks) >= 0.4 ? '#92400e' : '#9b1c1c'),
                                                            fontSize: '12px',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {Math.round((res.score / res.totalMarks) * 100)}%
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px' }}>
                                                        {new Date(res.completedAt).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                            {quizResults.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>No results yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {subTab === 'students' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h4 style={{ margin: 0 }}>Enrolled Students ({activeCourse.students?.length || 0})</h4>
                                    {(viewingAs === 'hod' || viewingAs === 'faculty') && (
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#f8fafc', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a202c' }}>Enroll New Student</div>
                                                <div style={{ fontSize: '11px', color: '#718096' }}>Students must be enrolled to see content</div>
                                            </div>
                                            <select 
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        enrollStudent(e.target.value);
                                                        e.target.value = "";
                                                    }
                                                }}
                                                style={{ padding: '5px', borderRadius: '5px', border: '1px solid #e2e8f0' }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Select a student</option>
                                                {institutionStudents
                                                    .filter(s => !activeCourse.students?.some(as => as._id === s._id))
                                                    .map(s => (
                                                        <option key={s._id} value={s._id}>{s.name} ({s.username})</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    )}
                                </div>
                                
                                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '13px', color: '#4a5568' }}>Name</th>
                                                <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '13px', color: '#4a5568' }}>Status</th>
                                                <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '13px', color: '#4a5568' }}>Last Active</th>
                                                <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '13px', color: '#4a5568' }}>Logins</th>
                                                <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '13px', color: '#4a5568' }}>Progress</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeCourse.students?.map((s, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.name}</div>
                                                        <div style={{ fontSize: '12px', color: '#718096' }}>{s.email}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', fontSize: '14px' }}>
                                                        <span style={{ 
                                                            padding: '4px 10px', 
                                                            borderRadius: '20px', 
                                                            fontSize: '11px', 
                                                            fontWeight: 'bold',
                                                            background: s.lastLogin && (new Date() - new Date(s.lastLogin)) < 600000 ? '#def7ec' : '#f3f4f6',
                                                            color: s.lastLogin && (new Date() - new Date(s.lastLogin)) < 600000 ? '#03543f' : '#4b5563'
                                                        }}>
                                                            {s.lastLogin && (new Date() - new Date(s.lastLogin)) < 600000 ? '● Active Now' : 'Offline'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#4a5568' }}>
                                                        {s.lastLogin ? new Date(s.lastLogin).toLocaleString() : 'Never'}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: '14px' }}>
                                                        {s.loginCount || 0}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                                        <div style={{ width: '100px', height: '8px', background: '#edf2f7', borderRadius: '4px', margin: '0 auto', position: 'relative' }}>
                                                            <div style={{ width: '10%', height: '100%', background: '#48bb78', borderRadius: '4px' }}></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {activeCourse.students?.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>No students enrolled in this course yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Modals for Adding Content */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ marginBottom: '20px', color: '#1a202c' }}>
                            {showAddModal === 'material' ? 'Add Resource' : (showAddModal === 'assignment' ? 'Create Assignment' : 'Create Quiz')}
                        </h2>
                        <form onSubmit={(showAddModal === 'submit_work' ? submitAssignmentWork : (showAddModal === 'grade' ? handleGradeSubmission : handleModalSubmit))} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {showAddModal === 'grade' ? (
                                <>
                                    <p>Grader: {user.name} | Student: {gradingSubmission?.studentId?.name}</p>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Grade (out of {activeCourse.modules.flatMap(m => m.assignments).find(a => a._id === activeAssignment)?.maxMarks || 100})</label>
                                        <input 
                                            required
                                            type="number" 
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                            value={modalData.grade || ''}
                                            onChange={e => setModalData({...modalData, grade: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Feedback</label>
                                        <textarea 
                                            rows="3"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                            value={modalData.feedback || ''}
                                            onChange={e => setModalData({...modalData, feedback: e.target.value})}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {showAddModal !== 'submit_work' && (
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Title</label>
                                            <input 
                                                required
                                                type="text" 
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                placeholder="Enter title"
                                                value={modalData.title || ''}
                                                onChange={e => setModalData({...modalData, title: e.target.value})}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {showAddModal === 'submit_work' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Work Comments / URL</label>
                                        <textarea 
                                            required
                                            rows="4"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                            placeholder="Explain your work or paste a project link..."
                                            value={modalData.content || ''}
                                            onChange={e => setModalData({...modalData, content: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Upload Work (File/Zip)</label>
                                        <input 
                                            type="file" 
                                            onChange={handleFileUpload}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                                        />
                                        {uploading && <p style={{ fontSize: '11px', color: '#4c51bf' }}>Uploading...</p>}
                                        {modalData.url && <p style={{ fontSize: '11px', color: '#48bb78' }}>✅ File ready for submission</p>}
                                    </div>
                                </>
                            )}

                            {showAddModal === 'material' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Type</label>
                                        <select 
                                            required
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                            value={modalData.type || ''}
                                            onChange={e => setModalData({...modalData, type: e.target.value})}
                                        >
                                            <option value="">Select Type</option>
                                            <option value="pdf">📄 PDF Document</option>
                                            <option value="video">🎥 Video Link</option>
                                            <option value="link">🔗 Web Link</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Resource Source</label>
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <button 
                                                type="button"
                                                onClick={() => setModalData({...modalData, sourceMethod: 'file'})}
                                                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: modalData.sourceMethod === 'file' ? '#4c51bf' : 'white', color: modalData.sourceMethod === 'file' ? 'white' : '#4a5568', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                Upload File
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setModalData({...modalData, sourceMethod: 'link'})}
                                                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: modalData.sourceMethod === 'link' ? '#4c51bf' : 'white', color: modalData.sourceMethod === 'link' ? 'white' : '#4a5568', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                Paste Link
                                            </button>
                                        </div>

                                        {modalData.sourceMethod === 'file' ? (
                                            <div style={{ border: '2px dashed #e2e8f0', padding: '20px', borderRadius: '12px', textAlign: 'center', background: '#f8fafc' }}>
                                                <input 
                                                    type="file" 
                                                    accept=".pdf,video/*"
                                                    onChange={handleFileUpload}
                                                    style={{ display: 'none' }}
                                                    id="fileUpload"
                                                />
                                                <label htmlFor="fileUpload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{ fontSize: '24px' }}>📤</span>
                                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a5568' }}>
                                                        {uploading ? 'Uploading...' : (modalData.url ? 'File Ready' : 'Choose a file to upload')}
                                                    </span>
                                                    {modalData.url && <span style={{ fontSize: '11px', color: '#48bb78' }}>✅ Verified</span>}
                                                </label>
                                            </div>
                                        ) : (
                                            <input 
                                                required
                                                type="text" 
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                placeholder="Paste URL (e.g. YouTube or Drive link)"
                                                value={modalData.url || ''}
                                                onChange={e => setModalData({...modalData, url: e.target.value})}
                                            />
                                        )}
                                    </div>
                                </>
                            )}

                            {showAddModal === 'assignment' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Question / Description</label>
                                        <textarea 
                                            required
                                            rows="4"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                            placeholder="Type the question or detailed instructions here..."
                                            value={modalData.description || ''}
                                            onChange={e => setModalData({...modalData, description: e.target.value})}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Due Date</label>
                                            <input 
                                                required
                                                type="date" 
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                value={modalData.dueDate || ''}
                                                onChange={e => setModalData({...modalData, dueDate: e.target.value})}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Max Marks</label>
                                            <input 
                                                required
                                                type="number" 
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                value={modalData.maxMarks || ''}
                                                onChange={e => setModalData({...modalData, maxMarks: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Reference Material (PDF)</label>
                                        <input 
                                            type="file" 
                                            accept=".pdf"
                                            onChange={handleFileUpload}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                                        />
                                        {uploading && <p style={{ fontSize: '11px', color: '#4c51bf', margin: '5px 0' }}>Uploading attachment...</p>}
                                        {modalData.attachmentUrl && <p style={{ fontSize: '11px', color: '#48bb78', margin: '5px 0' }}>✅ Attachment uploaded</p>}
                                    </div>
                                </>
                            )}

                            {showAddModal === 'quiz' && (
                                <>
                                    <div>
                                        <p style={{ fontSize: '13px', color: '#718096' }}>Add multiple-choice questions for the quiz.</p>
                                        <button type="button" onClick={addQuizQuestion} style={{ background: '#edf2f7', color: '#4c51bf', padding: '8px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                                            + Add Question
                                        </button>
                                        <div style={{ marginTop: '10px' }}>
                                            {modalData.questions?.map((q, i) => (
                                                <div key={i} style={{ fontSize: '12px', padding: '5px', background: '#f8fafc', marginBottom: '5px', borderRadius: '5px' }}>
                                                    {i+1}. {q.question} ({q.options.length} options)
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    onClick={closeModal}
                                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#4c51bf', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    Create {showAddModal}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LMSPortal;
