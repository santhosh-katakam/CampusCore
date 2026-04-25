import React, { useState, useEffect } from 'react';
import AdminPortal from './AdminPortal';
import StudentPortal from './StudentPortal';
import ExcelUpload from './ExcelUpload';
import TimetableConfig from './TimetableConfig';
import FacultyAvailability from './FacultyAvailability';
import ElectiveGrouping from './ElectiveGrouping';
import ReportsPortal from './ReportsPortal';
import Login from './Login';
import CompanyPortal from './CompanyPortal';
import LMSPortal from './LMSPortal';
import AttendancePortal from './AttendancePortal';
import JobPortal from './JobPortal';
import Register from './Register';
import Chatbot from './components/Chatbot';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#e53e3e' }}>Something went wrong.</h2>
          <p>The application encountered an error. Please try refreshing the page.</p>
          <pre style={{ textAlign: 'left', background: '#f7fafc', padding: '20px', borderRadius: '8px', overflow: 'auto', display: 'inline-block', maxWidth: '100%' }}>
            {this.state.error?.toString()}
          </pre>
          <br/>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#4c51bf', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Clear Cache & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [section, setSection] = useState('timetable'); // 'timetable', 'lms', or 'attendance'
  const [activeTab, setActiveTab] = useState('admin');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [viewingCollege, setViewingCollege] = useState(null);
  const [viewMode, setViewMode] = useState('hod'); // 'hod', 'faculty', 'student' - used for administrative viewing
  const [isQuizMode, setIsQuizMode] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      const u = JSON.parse(savedUser);
      setUser(u);
      
      // Map role to viewMode
      if (u.role === 'COLLEGE_ADMIN' || u.role === 'HOD') setViewMode('hod');
      else if (u.role === 'FACULTY') setViewMode('faculty');
      else if (u.role === 'STUDENT') setViewMode('student');

      const savedViewingId = localStorage.getItem('viewingInstitutionId');
      const savedViewingName = localStorage.getItem('viewingInstitutionName');
      if (savedViewingId) {
        setViewingCollege({ id: savedViewingId, name: savedViewingName });
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('viewingInstitutionId');
    localStorage.removeItem('viewingInstitutionName');
    setUser(null);
    setViewingCollege(null);
  };

  const selectCollege = (id, name) => {
    const collegeObj = { id, name };
    localStorage.setItem('viewingInstitutionId', id);
    localStorage.setItem('viewingInstitutionName', name);
    setViewingCollege(collegeObj);
    setViewMode('hod');
    setSection('timetable');
    setActiveTab('admin');
  };

  const backToCentral = () => {
    localStorage.removeItem('viewingInstitutionId');
    localStorage.removeItem('viewingInstitutionName');
    setViewingCollege(null);
    setSection('timetable');
    setActiveTab('company');
  };

  if (loading) return null;
  
  if (!user) {
    if (isRegistering) {
      return <Register onBack={() => setIsRegistering(false)} />;
    }
    return (
      <Login 
        onLogin={(u) => {
          setUser(u);
          if (u.role === 'COLLEGE_ADMIN' || u.role === 'HOD') setViewMode('hod');
          else if (u.role === 'FACULTY') setViewMode('faculty');
          else if (u.role === 'STUDENT') setViewMode('student');
        }} 
        onRegister={() => setIsRegistering(true)}
      />
    );
  }

  // Define Tabs per Section
  const timetableTabs = [
    { id: 'company', label: '🏢 Institutions', component: CompanyPortal, roles: ['COMPANY_ADMIN'], section: 'timetable' },
    { id: 'admin', label: '👨‍💼 Admin Dashboard', component: AdminPortal, roles: ['hod'], section: 'timetable' },
    { id: 'upload', label: '📊 Data Upload', component: ExcelUpload, roles: ['hod', 'faculty'], section: 'timetable' },
    { id: 'config', label: '⚙️ Config', component: TimetableConfig, roles: ['hod'], section: 'timetable' },
    { id: 'faculty-list', label: '🧑‍🏫 Faculty', component: FacultyAvailability, roles: ['hod'], section: 'timetable' },
    { id: 'elective', label: '🧩 Electives', component: ElectiveGrouping, roles: ['hod'], section: 'timetable' },
    { id: 'faculty-view', label: '🗓️ My Schedule', component: FacultyAvailability, roles: ['faculty', 'hod'], section: 'timetable' },
    { id: 'student-view', label: '🎓 Timetables', component: StudentPortal, roles: ['student', 'faculty', 'hod'], section: 'timetable' },
    { id: 'reports', label: '📈 Reports', component: ReportsPortal, roles: ['hod', 'faculty', 'COMPANY_ADMIN'], section: 'timetable' },
  ];

  const lmsTabs = [
    { id: 'lms-main', label: '📚 LMS Dashboard', component: LMSPortal, roles: ['hod', 'faculty', 'student'], section: 'lms' },
  ];

  const attendanceTabs = [
    { id: 'attendance-main', label: '📝 Attendance', component: AttendancePortal, roles: ['hod', 'faculty', 'student'], section: 'attendance' },
  ];

  const jobTabs = [
    { id: 'job-main', label: '💼 Job Board', component: JobPortal, roles: ['hod', 'faculty', 'student'], section: 'jobs' },
  ];

  // Helper to determine if a tab should be shown
  const isTabVisible = (tab) => {
    if (user.role === 'COMPANY_ADMIN' && !viewingCollege) {
        return tab.roles.includes('COMPANY_ADMIN');
    }
    return tab.roles.includes(viewMode);
  };

  const currentTabs = 
    section === 'timetable' ? timetableTabs : 
    (section === 'lms' ? lmsTabs : 
    (section === 'attendance' ? attendanceTabs : jobTabs));
  const visibleTabs = currentTabs.filter(isTabVisible);
  
  // Ensure activeTab is valid for current visible tabs
  const getSafeActiveTab = () => {
    if (visibleTabs.find(t => t.id === activeTab)) return activeTab;
    return visibleTabs[0]?.id || '';
  };

  const currentTabId = getSafeActiveTab();
  const ActiveComponent = [...timetableTabs, ...lmsTabs, ...attendanceTabs, ...jobTabs].find(tab => tab.id === currentTabId)?.component || (() => <div style={{padding: 40}}>Unauthorized or No Section Selected</div>);

  return (
    <ErrorBoundary>
      <div className="min-h-screen" style={{ background: '#f0f2f5', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Main Navigation */}
      <nav style={{
        background: viewingCollege ? '#1a202c' : 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
        color: 'white',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '70px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                {user.role === 'COMPANY_ADMIN' && !viewingCollege ? '🏢 COMPANY ADMIN' : (viewingCollege && viewingCollege.name ? viewingCollege.name.toUpperCase() : 'PORTAL')}
              </h1>
              
              {(viewingCollege || user.role !== 'COMPANY_ADMIN') && (
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '4px' }}>
                  <button 
                    onClick={() => { setSection('timetable'); setActiveTab(viewMode === 'hod' ? 'admin' : (viewMode === 'faculty' ? 'faculty-view' : 'student-view')); }}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: 'none',
                      background: section === 'timetable' ? 'white' : 'transparent',
                      color: section === 'timetable' ? '#4c51bf' : 'white',
                      fontWeight: '700', cursor: 'pointer', transition: '0.3s'
                    }}
                  >
                    🗓️ Timetable
                  </button>
                  <button 
                    onClick={() => { setSection('lms'); setActiveTab('lms-main'); }}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: 'none',
                      background: section === 'lms' ? 'white' : 'transparent',
                      color: section === 'lms' ? '#4c51bf' : 'white',
                      fontWeight: '700', cursor: 'pointer', transition: '0.3s'
                    }}
                  >
                    📚 LMS
                  </button>
                  <button 
                    onClick={() => { setSection('attendance'); setActiveTab('attendance-main'); }}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: 'none',
                      background: section === 'attendance' ? 'white' : 'transparent',
                      color: section === 'attendance' ? '#4c51bf' : 'white',
                      fontWeight: '700', cursor: 'pointer', transition: '0.3s'
                    }}
                  >
                    📝 Attendance
                  </button>
                  <button 
                    onClick={() => { setSection('jobs'); setActiveTab('job-main'); }}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: 'none',
                      background: section === 'jobs' ? 'white' : 'transparent',
                      color: section === 'jobs' ? '#4c51bf' : 'white',
                      fontWeight: '700', cursor: 'pointer', transition: '0.3s'
                    }}
                  >
                    💼 Jobs
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {(viewingCollege || user.role === 'COLLEGE_ADMIN') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '10px', fontSize: '13px' }}>
                    <span style={{ opacity: 0.8 }}>Viewing As:</span>
                    <select 
                      value={viewMode} 
                      onChange={(e) => {
                        const newMode = e.target.value;
                        setViewMode(newMode);
                        if (section === 'timetable') {
                            setActiveTab(newMode === 'hod' ? 'admin' : (newMode === 'faculty' ? 'faculty-view' : 'student-view'));
                        }
                      }}
                      style={{ background: 'transparent', color: 'white', border: 'none', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="hod" style={{color: '#333'}}>Super Admin (HOD)</option>
                      <option value="faculty" style={{color: '#333'}}>Faculty</option>
                      <option value="student" style={{color: '#333'}}>Student</option>
                    </select>
                  </div>
                )}

                {viewingCollege && (
                  <button onClick={backToCentral} style={{ background: '#f56565', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Exit
                  </button>
                )}

                <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '15px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '800' }}>{user.name || user.username}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase' }}>{user.role.replace('_', ' ')}</div>
                </div>
                <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Logout">
                  🚪
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Secondary Ribbon Navigation (Tabs) */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ padding: '0 20px', display: 'flex', gap: '5px', overflowX: 'auto' }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '15px 20px', border: 'none', background: 'transparent',
                color: currentTabId === tab.id ? '#4c51bf' : '#718096',
                fontWeight: '600', cursor: 'pointer', position: 'relative',
                transition: '0.2s', whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
              {currentTabId === tab.id && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: '#4c51bf' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main style={{ padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minHeight: 'calc(100vh - 200px)' }}>
            <ActiveComponent user={user} onSelectCollege={selectCollege} viewingAs={viewMode} role={viewMode} setIsQuizMode={setIsQuizMode} />
        </div>
      </main>
      
      <Chatbot isHidden={isQuizMode} user={user} />
      
      <footer style={{ textAlign: 'center', padding: '40px 20px', color: '#a0aec0', fontSize: '14px' }}>
        &copy; 2026 Admin Pro Scheduler & LMS. All rights reserved.
      </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
