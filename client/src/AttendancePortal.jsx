import React, { useState, useEffect } from 'react';
import axios from './api/axios';

const AttendancePortal = ({ user, viewingAs }) => {
    const [view, setView] = useState(viewingAs || 'student'); // 'student', 'faculty', 'admin'
    const [reportType, setReportType] = useState('overall'); // 'course', 'day', 'month', 'overall', 'history'
    const [stats, setStats] = useState([]);
    const [history, setHistory] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [students, setStudents] = useState([]);
    const [markingDate, setMarkingDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [attendanceData, setAttendanceData] = useState({}); // {studentId: 'Present/Absent/Late'}
    
    // Filter states
    const [filters, setFilters] = useState({
        batch: '',
        subject: ''
    });
    const [availableFilters, setAvailableFilters] = useState({
        batches: [],
        subjects: []
    });

    useEffect(() => {
        setView(viewingAs);
        if (viewingAs === 'student') {
            fetchStudentStats();
        } else {
            // Both Faculty and Admin/HOD need courses to mark attendance or filter reports
            fetchCourses();
            // If HOD, fetch reports immediately. Faculty can switch to them.
            if (viewingAs === 'hod' || user.role === 'FACULTY') fetchAdminReports();
        }
    }, [viewingAs]);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            // Fetch from primary data tables to ensure consistency with uploads
            const [batchesRes, coursesRes] = await Promise.all([
                axios.get('/batches'),
                axios.get('/courses')
            ]);
            
            setCourses(coursesRes.data);
            
            // Collect all unique batch identifiers from both the Batches and Courses tables
            const batchesFromBatches = batchesRes.data.map(b => b.name || b.batchId);
            const batchesFromCourses = coursesRes.data.map(c => c.batch);
            const allBatches = [...new Set([...batchesFromBatches, ...batchesFromCourses])]
                .filter(Boolean)
                .sort();
            
            // Initialize subjects based on all courses
            const initialSubjects = coursesRes.data.map(c => ({ id: c._id, name: c.subject, batch: c.batch }));
            
            setAvailableFilters({
                batches: allBatches,
                subjects: initialSubjects
            });
        } catch (err) {
            console.error('Data Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentStats = async () => {
        try {
            setLoading(true);
            const studentId = user._id || user.id;
            const res = await axios.get(`/attendance/student/${studentId}`);
            setStats(res.data.stats);
            setHistory(res.data.records);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (filters.batch) {
            // Find subjects that specifically mention this batch first, or show all as fallback
            const specificSubjects = courses
                .filter(c => c.batch === filters.batch)
                .map(c => ({ id: c._id, name: c.subject }));
            
            if (specificSubjects.length > 0) {
                setAvailableFilters(prev => ({ ...prev, subjects: specificSubjects }));
            } else {
                // If no exact match (likely a naming mismatch between tables), show all unique subjects
                const allUniqueSubjects = courses.reduce((acc, c) => {
                    if (!acc.find(s => s.name === c.subject)) {
                        acc.push({ id: c._id, name: c.subject });
                    }
                    return acc;
                }, []);
                setAvailableFilters(prev => ({ ...prev, subjects: allUniqueSubjects.sort((a,b) => a.name.localeCompare(b.name)) }));
            }
        }
    }, [filters.batch, courses]);

    const fetchStudentsForCourse = async (courseId) => {
        try {
            setLoading(true);
            // Get course details from our local state
            const course = courses.find(c => c._id === courseId);
            setSelectedCourse(course);

            const queryParams = filters.batch ? `?batch=${encodeURIComponent(filters.batch)}` : '';
            const res = await axios.get(`/attendance/students/${courseId}${queryParams}`);
            setStudents(res.data || []);
            
            // Initialize marking data
            const initial = {};
            (res.data || []).forEach(s => initial[s._id] = 'Present');
            setAttendanceData(initial);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdminReports = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/attendance/admin/report');
            setHistory(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const submitAttendance = async () => {
        try {
            const data = Object.keys(attendanceData).map(sid => ({
                studentId: sid,
                status: attendanceData[sid]
            }));
            await axios.post('/attendance/mark', {
                courseId: selectedCourse._id,
                date: markingDate,
                attendanceData: data
            });
            alert('Attendance marked successfully!');
            setSelectedCourse(null);
        } catch (err) {
            alert('Error marking attendance');
        }
    };

    const markAll = (status) => {
        const updated = { ...attendanceData };
        Object.keys(updated).forEach(id => updated[id] = status);
        setAttendanceData(updated);
    };

    const getOverallStats = (records) => {
        if(!records || records.length === 0) return null;
        const total = records.length;
        const present = records.filter(r => r.status === 'Present').length;
        const late = records.filter(r => r.status === 'Late').length;
        const absent = records.filter(r => r.status === 'Absent').length;
        return { present, absent, late, total, percentage: ((present + (late*0.5))/total * 100).toFixed(2) };
    };

    const getGroupedStats = (records, groupBy) => {
        const groups = {};
        records.forEach(r => {
            let key;
            if (groupBy === 'day') {
                key = new Date(r.date).toLocaleDateString();
            } else if (groupBy === 'month') {
                const d = new Date(r.date);
                key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
            } else if (groupBy === 'course') {
                key = r.courseId?.subject || r.courseId?.title || 'Unknown Course';
            }
            if(!groups[key]) groups[key] = { present: 0, late: 0, absent: 0, total: 0 };
            groups[key].total++;
            if(r.status==='Present') groups[key].present++;
            else if(r.status==='Late') groups[key].late++;
            else groups[key].absent++;
        });
        return Object.entries(groups).map(([label, counts]) => ({ 
            label, ...counts, percentage: ((counts.present + (counts.late*0.5))/counts.total * 100).toFixed(2) 
        })).sort((a,b) => b.label.localeCompare(a.label));
    };

    const renderStatGrid = (data) => {
        if(data.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>No attendance records found.</div>;
        return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {data.map(stat => (
                <div key={stat.label || stat.courseTitle} style={{ 
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{stat.label || stat.courseTitle}</h3>
                        {stat.courseCode && <span style={{ fontSize: '12px', background: '#edf2f7', padding: '4px 8px', borderRadius: '6px' }}>{stat.courseCode}</span>}
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: '800', color: parseFloat(stat.percentage) < 75 ? '#e53e3e' : '#38a169', marginBottom: '10px' }}>
                        {stat.percentage}%
                    </div>
                    {parseFloat(stat.percentage) < 75 && (
                        <div style={{ color: '#e53e3e', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                            ⚠️ Attendance is below 75%
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#718096' }}>
                        <span>Present: {stat.present}</span>
                        <span>Absent: {stat.absent}</span>
                        <span>Total: {stat.total}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#edf2f7', borderRadius: '4px', marginTop: '15px' }}>
                        <div style={{ 
                            width: `${stat.percentage}%`, height: '100%', 
                            background: parseFloat(stat.percentage) < 75 ? '#e53e3e' : '#38a169', 
                            borderRadius: '4px', transition: '0.3s' 
                        }} />
                    </div>
                </div>
            ))}
        </div>
        );
    };

    const renderHistoryTable = (records) => (
        <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', background: '#f7fafc', borderBottom: '2px solid #edf2f7' }}>
                        <th style={{ padding: '15px' }}>Date</th>
                        {view === 'hod' && <th style={{ padding: '15px' }}>Student</th>}
                        <th style={{ padding: '15px' }}>Course</th>
                        <th style={{ padding: '15px' }}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map(h => (
                        <tr key={h._id} style={{ borderBottom: '1px solid #edf2f7' }}>
                            <td style={{ padding: '15px' }}>{new Date(h.date).toLocaleDateString()}</td>
                            {view === 'hod' && <td style={{ padding: '15px' }}>{h.studentId?.name || 'N/A'}</td>}
                            <td style={{ padding: '15px' }}>{h.courseId?.subject || h.courseId?.title}</td>
                            <td style={{ padding: '15px' }}>
                                <span style={{ 
                                    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                                    background: h.status === 'Present' ? '#c6f6d5' : (h.status === 'Absent' ? '#fed7d7' : '#feebc8'),
                                    color: h.status === 'Present' ? '#22543d' : (h.status === 'Absent' ? '#822727' : '#744210')
                                }}>{h.status}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderReportControls = () => (
        <div style={{ marginBottom: '25px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['overall', 'course', 'month', 'day', 'history'].map(rt => (
                <button 
                    key={rt}
                    onClick={() => setReportType(rt)} 
                    style={{ 
                        padding: '10px 20px', 
                        background: reportType === rt ? '#4c51bf' : 'white', 
                        color: reportType === rt ? 'white' : '#4a5568', 
                        border: '1px solid #cbd5e0', 
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    {rt === 'history' && 'Detailed History'}
                    {rt === 'overall' && 'Overall Report'}
                    {rt === 'course' && 'Course Wise'}
                    {rt === 'month' && 'Month Wise'}
                    {rt === 'day' && 'Day Wise'}
                </button>
            ))}
        </div>
    );

    const renderStudentView = () => {
        const overall = getOverallStats(history);
        const groupedData = reportType === 'day' ? getGroupedStats(history, 'day') : reportType === 'month' ? getGroupedStats(history, 'month') : [];

        return (
            <div style={{ padding: '20px' }}>
                <h2 style={{ marginBottom: '20px', color: '#2d3748' }}>My Attendance Report</h2>
                {renderReportControls()}

                {reportType === 'overall' && overall && (
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontSize: '24px', marginBottom: '15px', color: '#4a5568' }}>Total Attendance</h3>
                        <div style={{ fontSize: '64px', fontWeight: '900', color: parseFloat(overall.percentage) < 75 ? '#e53e3e' : '#38a169', marginBottom: '20px' }}>
                            {overall.percentage}%
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '18px', color: '#718096', fontWeight: 'bold' }}>
                            <div>Present: <span style={{color: '#38a169'}}>{overall.present}</span></div>
                            <div>Absent: <span style={{color: '#e53e3e'}}>{overall.absent}</span></div>
                            <div>Total: {overall.total}</div>
                        </div>
                    </div>
                )}
                
                {reportType === 'course' && renderStatGrid(stats)}
                {(reportType === 'month' || reportType === 'day') && renderStatGrid(groupedData)}
                {reportType === 'history' && renderHistoryTable(history)}
                
                {history.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>No attendance records found.</div>}
            </div>
        );
    };

    const renderFacultyView = () => (
        <div style={{ padding: '20px' }}>
            {!selectedCourse ? (
                <div style={{ width: '100%', background: '#f8fafc', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <h2 style={{ marginBottom: '25px', textAlign: 'center', color: '#2d3748' }}>Mark Attendance</h2>
                    

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>Select Batch</label>
                        <select 
                            value={filters.batch} 
                            onChange={(e) => setFilters({...filters, batch: e.target.value, subject: ''})}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white' }}
                        >
                            <option value="">-- Choose Batch --</option>
                            {availableFilters.batches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>Select Subject / Course</label>
                        <select 
                            value={filters.subject} 
                            onChange={(e) => setFilters({...filters, subject: e.target.value})}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white' }}
                            disabled={!filters.batch}
                        >
                            <option value="">-- Choose Subject --</option>
                            {availableFilters.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <button 
                        onClick={() => filters.subject && fetchStudentsForCourse(filters.subject)}
                        disabled={!filters.subject}
                        style={{ 
                            width: '100%', padding: '15px', background: filters.subject ? '#4c51bf' : '#a0aec0', 
                            color: 'white', border: 'none', borderRadius: '10px', cursor: filters.subject ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold', fontSize: '16px', transition: '0.3s'
                        }}
                    >
                        Get Student List
                    </button>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <button onClick={() => setSelectedCourse(null)} style={{ background: 'none', border: 'none', color: '#4c51bf', cursor: 'pointer', fontWeight: 'bold' }}>← Back to Courses</button>
                        <h2 style={{ margin: 0 }}>Mark Attendance: {selectedCourse.subject} ({selectedCourse.batch})</h2>
                        <input 
                            type="date" 
                            value={markingDate} 
                            onChange={(e) => setMarkingDate(e.target.value)}
                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e0' }}
                        />
                    </div>

                    <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
                        <button onClick={() => markAll('Present')} style={{ padding: '8px 15px', background: '#38a169', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Mark All Present</button>
                        <button onClick={() => markAll('Absent')} style={{ padding: '8px 15px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Mark All Absent</button>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#edf2f7' }}>
                                <tr style={{ textAlign: 'left' }}>
                                    <th style={{ padding: '15px' }}>Student Name</th>
                                    <th style={{ padding: '15px' }}>Roll No / ID</th>
                                    <th style={{ padding: '15px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: '#a0aec0' }}>
                                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>👥</div>
                                            <strong>No students available in this batch.</strong>
                                            <p style={{ fontSize: '12px', marginTop: '5px' }}>Verify the batch name in the student registrations.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    students.map(student => (
                                        <tr key={student._id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                            <td style={{ padding: '15px' }}>{student.name}</td>
                                            <td style={{ padding: '15px' }}>{student.username}</td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    {['Present', 'Absent', 'Late'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setAttendanceData({...attendanceData, [student._id]: status})}
                                                            style={{
                                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e0',
                                                                background: attendanceData[student._id] === status ? 
                                                                    (status === 'Present' ? '#38a169' : (status === 'Absent' ? '#e53e3e' : '#dd6b27')) : 'white',
                                                                color: attendanceData[student._id] === status ? 'white' : '#4a5568',
                                                                cursor: 'pointer', fontSize: '13px'
                                                            }}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                        <button 
                            onClick={submitAttendance}
                            style={{ padding: '12px 30px', background: '#4c51bf', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                        >
                            Save Attendance
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    const renderAdminView = () => {
        const overall = getOverallStats(history);
        const groupedData = reportType === 'day' ? getGroupedStats(history, 'day') 
                          : reportType === 'month' ? getGroupedStats(history, 'month') 
                          : reportType === 'course' ? getGroupedStats(history, 'course') : [];

        return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Institution Attendance Report</h2>
                <button 
                    onClick={() => {
                        const csv = history.map(h => `${new Date(h.date).toLocaleDateString()},${h.studentId?.name},${h.courseId?.title},${h.status}`).join('\n');
                        const blob = new Blob([`Date,Student,Course,Status\n${csv}`], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'attendance_report.csv';
                        a.click();
                    }}
                    style={{ background: '#3182ce', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    📥 Export CSV
                </button>
            </div>

            {renderReportControls()}

            {reportType === 'overall' && overall && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '24px', marginBottom: '15px', color: '#4a5568' }}>Total Institution Attendance</h3>
                    <div style={{ fontSize: '64px', fontWeight: '900', color: parseFloat(overall.percentage) < 75 ? '#e53e3e' : '#38a169', marginBottom: '20px' }}>
                        {overall.percentage}%
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '18px', color: '#718096', fontWeight: 'bold' }}>
                        <div>Present: <span style={{color: '#38a169'}}>{overall.present}</span></div>
                        <div>Absent: <span style={{color: '#e53e3e'}}>{overall.absent}</span></div>
                        <div>Total: {overall.total}</div>
                    </div>
                </div>
            )}

            {(reportType === 'course' || reportType === 'month' || reportType === 'day') && renderStatGrid(groupedData)}
            {reportType === 'history' && renderHistoryTable(history)}

            {history.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>No attendance records found for institution.</div>}
        </div>
        );
    };

    const canViewReports = ['COLLEGE_ADMIN', 'HOD', 'FACULTY'].includes(user.role);
    const markView = user.role === 'FACULTY' ? 'faculty' : 'hod-mark';

    return (
        <div style={{ minHeight: '80vh' }}>
            {canViewReports && (
                <div style={{ padding: '20px 20px 0 20px' }}>
                    <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                        <button 
                            onClick={() => setView(markView)} 
                            style={{ 
                                padding: '10px 20px', background: 'transparent', border: 'none', 
                                color: view === markView ? '#4c51bf' : '#718096', 
                                fontWeight: 'bold', cursor: 'pointer',
                                borderBottom: view === markView ? '3px solid #4c51bf' : 'none'
                            }}
                        >
                            📝 Mark Attendance
                        </button>
                        <button 
                            onClick={() => { setView('hod'); fetchAdminReports(); }} 
                            style={{ 
                                padding: '10px 20px', background: 'transparent', border: 'none', 
                                color: view === 'hod' ? '#4c51bf' : '#718096', 
                                fontWeight: 'bold', cursor: 'pointer',
                                borderBottom: view === 'hod' ? '3px solid #4c51bf' : 'none'
                            }}
                        >
                            📈 View Reports
                        </button>
                    </div>
                </div>
            )}
            {view === 'student' && renderStudentView()}
            {(view === 'faculty' || view === 'hod-mark') && renderFacultyView()}
            {view === 'hod' && renderAdminView()}
            {loading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="spinner">Loading...</div>
                </div>
            )}
        </div>
    );
};

export default AttendancePortal;
