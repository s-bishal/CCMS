import React, { useState, useEffect } from 'react';
import { LogOut, User, Bell, LayoutDashboard, ShieldAlert, KeyRound, Building, Phone } from 'lucide-react';
import StudentDashboard from './components/StudentDashboard';
import FacultyDashboard from './components/FacultyDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [csrfToken, setCsrfToken] = useState(() => {
    return localStorage.getItem('csrf_token') || '';
  });

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'profile'
  
  // Auth Form State
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student',
    department: 'CS',
    phone: ''
  });

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    department: '',
    phone: ''
  });
  const [profileMsg, setProfileMsg] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Setup notifications polling (every 5 seconds)
      const interval = setInterval(fetchNotifications, 5000);
      setProfileForm({
        full_name: user.full_name || '',
        department: user.department || '',
        phone: user.phone || ''
      });
      return () => clearInterval(interval);
    }
  }, [user]);

  const apiFetch = async (url, options = {}) => {
    const headers = options.headers || {};
    
    // Add CSRF token for mutating requests
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase())) {
      headers['X-CSRFToken'] = csrfToken;
    }
    
    // Ensure credentials cookie is sent
    options.credentials = 'include';
    options.headers = headers;

    const response = await fetch(url, options);
    
    if (response.status === 401) {
      // Unauthenticated: clear session
      handleLogoutLocal();
      throw new Error("Session expired");
    }
    
    if (response.status === 403) {
      const err = await response.json();
      throw new Error(err.error || "Permission denied");
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return await response.json();
    }
    return response;
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch('/api/notifications/');
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error("Notifications fetch failed", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      // Step 1: Obtain a fresh CSRF cookie from Django before POSTing
      const csrfRes = await fetch('/api/auth/csrf/', { credentials: 'include' });
      const csrfData = await csrfRes.json();
      const freshCsrf = csrfData.csrf_token;

      // Step 2: POST credentials with that token
      const response = await fetch('/api/auth/login/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': freshCsrf,
        },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setCsrfToken(data.csrf_token);
        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('csrf_token', data.csrf_token);
        setActiveTab('dashboard');
      } else {
        const err = await response.json();
        setAuthError(err.error || 'Invalid login credentials.');
      }
    } catch (err) {
      setAuthError('Server communication failed. Is the backend running?');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      // Step 1: Get a fresh CSRF cookie before POSTing
      const csrfRes = await fetch('/api/auth/csrf/', { credentials: 'include' });
      const csrfData = await csrfRes.json();
      const freshCsrf = csrfData.csrf_token;

      // Step 2: POST registration data with that token
      const response = await fetch('/api/auth/register/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': freshCsrf,
        },
        body: JSON.stringify(registerForm),
      });

      if (response.ok) {
        setAuthError('');
        setAuthView('login');
        setLoginEmail(registerForm.email);
        setLoginPassword('');
        // Show success inline instead of alert
        setAuthError('✅ Account created! Please sign in.');
      } else {
        const err = await response.json();
        setAuthError(Object.values(err).flat().join(' ') || 'Registration failed.');
      }
    } catch (err) {
      setAuthError('Registration server connection failed. Is the backend running?');
    }
  };

  const handleLogoutLocal = () => {
    setUser(null);
    setCsrfToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('csrf_token');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout/', { method: 'POST' });
    } catch (err) {
      console.error("Logout failed at server", err);
    } finally {
      handleLogoutLocal();
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      const data = await apiFetch('/api/auth/profile/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      if (data && !data.error) {
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setProfileMsg("Profile updated successfully!");
      }
    } catch (err) {
      setProfileMsg("Error updating profile: " + err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all/', { method: 'POST' });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      await apiFetch(`/api/notifications/${notif.id}/read/`, { method: 'POST' });
      fetchNotifications();
      setShowNotifications(false);
      // If we are Student, Faculty, or Admin we'll trigger data fetch inside the child dashboard automatically 
      // because child components fetch on mount, and we will trigger tab switch to dashboard if on profile.
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Unauthenticated Layout
  if (!user) {
    return (
      <div className="auth-container">
        <div className="glass-card auth-card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ background: 'var(--primary-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '1.75rem', fontWeight: 800 }}>
              NEC CCMS
            </h1>
            <p style={{ color: 'var(--nec)', fontSize: '0.85rem', marginTop: '0.25rem',fontWeight:800 }}>
              Nepal Engineering College — Complaint Portal
            </p>
          </div>

          {authError && (
            <div style={{
              padding: '0.75rem 1rem',
              background: authError.startsWith('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${authError.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '8px',
              color: authError.startsWith('✅') ? '#34d399' : '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              {authError}
            </div>
          )}

          {authView === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">College Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={loginEmail} 
                  onChange={e => setLoginEmail(e.target.value)} 
                  placeholder="student@nec.edu.np or faculty@nec.edu.np" 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={loginPassword} 
                  onChange={e => setLoginPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required 
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Sign In
              </button>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--register)' }}>Don't have an account? </span>
                <span style={{ color: 'var(--register)', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setAuthView('register')}>
                  Register Here
                </span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={registerForm.full_name} 
                  onChange={e => setRegisterForm({...registerForm, full_name: e.target.value})} 
                  placeholder="Your name" 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">College Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={registerForm.email} 
                  onChange={e => setRegisterForm({...registerForm, email: e.target.value})} 
                  placeholder="name@nec.edu.np" 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={registerForm.password} 
                  onChange={e => setRegisterForm({...registerForm, password: e.target.value})} 
                  placeholder="Min 8 characters" 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Portal Role</label>
                  <select 
                    className="form-input" 
                    value={registerForm.role} 
                    onChange={e => setRegisterForm({...registerForm, role: e.target.value})}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select 
                    className="form-input" 
                    value={registerForm.department} 
                    onChange={e => setRegisterForm({...registerForm, department: e.target.value})}
                  >
                    <option value="CS">Computer Science</option>
                    <option value="IT">Information Tech</option>
                    <option value="ECE">Electronics Eng</option>
                    <option value="Civil">Civil Engineering</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Contact</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={registerForm.phone} 
                  onChange={e => setRegisterForm({...registerForm, phone: e.target.value})} 
                  placeholder="e.g. 984xxxxxxx" 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Create Account
              </button>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Already registered? </span>
                <span style={{ color: 'white', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setAuthView('login')}>
                  Sign In
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Authenticated Layout
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo">
          <ShieldAlert size={22} style={{ color: 'white' }} />
          <span>NEC CCMS</span>
        </div>

        <nav className="nav-links">
          <li 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </li>
          <li 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} />
            <span>My Profile</span>
          </li>
        </nav>

        {/* Notifications Tray Bell */}
        <div className="sidebar-footer">
          <div className="notification-bell-container" style={{ alignSelf: 'flex-start' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', borderRadius: '50%', position: 'relative' }}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Notifications</span>
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                    onClick={handleMarkAllRead}
                  >
                    Mark read
                  </button>
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <p style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No notifications.</p>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(n)}
                        style={{ cursor: 'pointer' }}
                      >
                        <p style={{ margin: 0 }}>{n.message}</p>
                        <span style={{ fontSize: '0.65rem', color: 'black' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-badge">
            <span className="user-badge-name">{user.full_name}</span>
            <span className="user-badge-role">{user.role}</span>
          </div>

          <button className="btn btn-secondary" style={{ color: '#f87171', justifyContent: 'flex-start' }} onClick={handleLogout}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {activeTab === 'dashboard' ? (
          <>
            {user.role === 'student' && <StudentDashboard apiFetch={apiFetch} csrfToken={csrfToken} />}
            {user.role === 'faculty' && <FacultyDashboard apiFetch={apiFetch} />}
            {user.role === 'admin' && <AdminDashboard apiFetch={apiFetch} csrfToken={csrfToken} />}
          </>
        ) : (
          <div style={{ maxWidth: '600px' }}>
            <div className="dashboard-header">
              <h2>My Profile</h2>
            </div>
            <div className="glass-card">
              <h3 style={{ marginBottom: '1.5rem' }}>Update Profile Details</h3>
              {profileMsg && (
                <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', fontSize: '1rem', marginBottom: '1rem', color: '#ffffff', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  {profileMsg}
                </div>
              )}
              <form onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: '2.5rem' }}
                      value={profileForm.full_name} 
                      onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Role (Non-editable)</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: '2.5rem', opacity: '0.5' }}
                      value={user.role.toUpperCase()} 
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Affiliated Department</label>
                  <div style={{ position: 'relative' }}>
                    <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: '2.5rem' }}
                      value={profileForm.department} 
                      onChange={e => setProfileForm({...profileForm, department: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: '2.5rem' }}
                      value={profileForm.phone} 
                      onChange={e => setProfileForm({...profileForm, phone: e.target.value})} 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Save Profile Changes
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
