import React, { useState, useEffect } from 'react';
import { FileText, Eye, UserPlus, XCircle, AlertTriangle, RefreshCw, BarChart2, Check, Download } from 'lucide-react';

export default function AdminDashboard({ apiFetch, csrfToken }) {
  const [complaints, setComplaints] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [kpis, setKpis] = useState({
    total_complaints: 0,
    status_counts: { submitted: 0, assigned: 0, in_progress: 0, resolved: 0, closed: 0 },
    urgency_counts: { low: 0, medium: 0, high: 0, critical: 0 },
    department_counts: {},
    category_counts: {},
    resolution_rate: 0,
    average_turnaround_hours: 0
  });

  const [activeComplaint, setActiveComplaint] = useState(null);
  
  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const [showForceCloseModal, setShowForceCloseModal] = useState(false);
  const [forceCloseJustification, setForceCloseJustification] = useState('');

  const [simMessage, setSimMessage] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchFaculty();
    fetchCategories();
  }, [statusFilter, categoryFilter, urgencyFilter]);

  const fetchData = async () => {
    try {
      // Fetch complaints with filters
      let url = '/api/complaints/?';
      if (statusFilter) url += `status=${statusFilter}&`;
      if (categoryFilter) url += `category=${categoryFilter}&`;
      if (urgencyFilter) url += `urgency=${urgencyFilter}&`;
      
      const compData = await apiFetch(url);
      if (Array.isArray(compData)) {
        setComplaints(compData);
        if (activeComplaint) {
          const updated = compData.find(c => c.id === activeComplaint.id);
          if (updated) setActiveComplaint(updated);
        }
      }

      // Fetch reports summary
      const summaryData = await apiFetch('/api/reports/summary/');
      if (summaryData && !summaryData.error) {
        setKpis(summaryData);
      }
    } catch (err) {
      console.error("Error fetching admin data", err);
    }
  };

  const fetchFaculty = async () => {
    try {
      const data = await apiFetch('/api/auth/users/?role=faculty');
      if (Array.isArray(data)) setFacultyList(data);
    } catch (err) {
      console.error("Error fetching faculty users", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiFetch('/api/categories/');
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.error("Error fetching categories", err);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      alert("Please select a faculty member.");
      return;
    }

    try {
      await apiFetch(`/api/complaints/${activeComplaint.id}/assign/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_to: selectedFacultyId,
          notes: assignmentNotes || undefined
        })
      });

      setShowAssignModal(false);
      setSelectedFacultyId('');
      setAssignmentNotes('');
      fetchData();
    } catch (err) {
      console.error("Assignment failed", err);
    }
  };

  const handleForceClose = async (e) => {
    e.preventDefault();
    if (!forceCloseJustification.trim()) {
      alert("Please provide a justification.");
      return;
    }

    try {
      await apiFetch(`/api/complaints/${activeComplaint.id}/close/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_close',
          notes: forceCloseJustification
        })
      });

      setShowForceCloseModal(false);
      setForceCloseJustification('');
      fetchData();
    } catch (err) {
      console.error("Force close failed", err);
    }
  };

  const triggerSimulation = async (type) => {
    setSimLoading(true);
    setSimMessage('');
    try {
      const data = await apiFetch('/api/reports/simulate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (data && data.message) {
        setSimMessage(data.message);
        fetchData();
      } else if (data && data.error) {
        setSimMessage("Error: " + data.error);
      }
    } catch (err) {
      setSimMessage("Simulation execution failed.");
    } finally {
      setSimLoading(false);
    }
  };

  const handleExportCSV = () => {
    // Standard CSV download trigger
    window.open('/api/reports/export/', '_blank');
  };

  // Filter complaints locally by search bar query
  const filteredComplaints = complaints.filter(c => {
    const term = search.toLowerCase();
    return (
      c.complaint_code.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      c.description.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p style={{ color: 'white', fontSize: '0.9rem' }}>Overview, Triaging, Audit logs, and System Analytics.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV Report
          </button>
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: '#ffffff' }}><FileText size={24} /></div>
          <div>
            <div className="stat-value">{kpis.total_complaints}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: 'var(--color-submitted)' }}><RefreshCw size={24} /></div>
          <div>
            <div className="stat-value">
              {kpis.status_counts.submitted + kpis.status_counts.assigned + kpis.status_counts.in_progress}
            </div>
            <div className="stat-label">Open/Pending</div>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: 'var(--color-resolved)' }}><Check size={24} /></div>
          <div>
            <div className="stat-value">{kpis.resolution_rate}%</div>
            <div className="stat-label">Resolution Rate</div>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: 'var(--color-closed)' }}><XCircle size={24} /></div>
          <div>
            <div className="stat-value">{kpis.status_counts.closed}</div>
            <div className="stat-label">Closed Cases</div>
          </div>
        </div>
      </div>

      {/* Analytics & Demo Control Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Simple CSS/SVG chart of complaints by Category */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} /> Complaints by Category
          </h3>
          <div className="chart-container">
            {categories.map(cat => {
              const count = kpis.category_counts[cat.name] || 0;
              const maxCount = Math.max(...Object.values(kpis.category_counts), 1);
              const heightPercent = totalComplaints => {
                if (kpis.total_complaints === 0) return 0;
                return (count / maxCount) * 100;
              };
              return (
                <div key={cat.id} className="chart-bar-wrapper">
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{count}</span>
                  <div 
                    className="chart-bar" 
                    style={{ height: `${heightPercent() * 1.4 + 5}px` }}
                  ></div>
                  <span className="chart-label" title={cat.name}>{cat.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Demo Simulation Panel */}
        <div className="glass-card" style={{ border: '1px dashed var(--color-assigned)' }}>
          <h3 style={{ color: 'var(--color-assigned)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />  Control Panel
          </h3>
          <p style={{ color: 'white', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Simulate the passage of time to demonstrate automatic background cron checks (normally scheduled at 48 hours and 7 days).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, borderColor: 'var(--color-in-progress)' }}
              onClick={() => triggerSimulation('escalate')}
              disabled={simLoading}
            >
              Trigger 48h Escalation Check
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, borderColor: 'var(--color-closed)' }}
              onClick={() => triggerSimulation('autoclose')}
              disabled={simLoading}
            >
              Trigger 7d Auto-Close Check
            </button>
          </div>
          {simMessage && (
            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '0.85rem', color: '#60a5fa', borderLeft: '3px solid #3b82f6' }}>
              {simMessage}
            </div>
          )}
        </div>
      </div>
      

      {/* Main Table triaging queue */}
      <div className="detail-grid">
        {/* Left Pane: Complaints Triage */}
        <div className="glass-card">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by ID, keyword..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select className="form-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="form-input" value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}>
              <option value="">All Urgencies</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <h3 style={{ marginBottom: '1rem' }}>Complaints Queue ({filteredComplaints.length})</h3>
          
          <div className="complaints-list">
            {filteredComplaints.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No complaints found matching filters.</p>
            ) : (
              filteredComplaints.map(c => (
                <div 
                  key={c.id} 
                  className={`complaint-row ${activeComplaint?.id === c.id ? 'active' : ''}`}
                  onClick={() => setActiveComplaint(c)}
                  style={{ borderLeft: `4px solid var(--color-${c.status})` }}
                >
                  <div className="complaint-info">
                    <div className="complaint-code-title">
                      <span className="complaint-code">{c.complaint_code}</span>
                      <span className="complaint-title">{c.title}</span>
                    </div>
                    <div className="complaint-meta">
                      <span>Category: {c.category_details?.name}</span>
                      <span>Dept: {c.department}</span>
                      <span>Urgency: <span className={`badge badge-${c.urgency}`}>{c.urgency}</span></span>
                      {c.is_escalated && <span style={{ color: 'var(--color-critical)', fontWeight: '700' }}>⚠️ ESCALATED</span>}
                    </div>
                  </div>
                  <div>
                    <span className={`badge badge-${c.status}`}>{c.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Admin Triage Actions & Timeline */}
        <div>
          {activeComplaint ? (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="complaint-code" style={{ fontSize: '1.2rem' }}>{activeComplaint.complaint_code}</span>
                  <h3 style={{ marginTop: '0.25rem' }}>{activeComplaint.title}</h3>
                </div>
                <span className={`badge badge-${activeComplaint.status}`}>{activeComplaint.status.replace('_', ' ')}</span>
              </div>

              {/* Triage Actions Panel */}
              <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--bg-card-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h5 style={{ color: '#ffffff', marginBottom: '0.25rem' }}>Admin Triage Panel</h5>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAssignModal(true)}>
                    <UserPlus size={16} /> Assign Faculty
                  </button>
                  {activeComplaint.status !== 'closed' && (
                    <button className="btn btn-secondary" style={{ color: 'var(--color-critical)', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={() => setShowForceCloseModal(true)}>
                      Force Close
                    </button>
                  )}
                </div>
              </div>

              {/* Identity Panel (Admin sees this, whether anonymous or not) */}
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--bg-card-border)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Student Submitter:</span>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>
                  {activeComplaint.student_details?.full_name} 
                  {activeComplaint.is_anonymous && (
                    <span style={{ color: 'var(--color-assigned)', fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                      (Submitted anonymously, hidden from Faculty)
                    </span>
                  )}
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Email: {activeComplaint.student_details?.email} | Department: {activeComplaint.student_details?.department}
                </span>
              </div>

              <div>
                <h5 style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Description</h5>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{activeComplaint.description}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Urgency</h5>
                  <span className={`badge badge-${activeComplaint.urgency}`} style={{ marginTop: '0.25rem' }}>{activeComplaint.urgency}</span>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Assigned Faculty</h5>
                  <p style={{ marginTop: '0.25rem', fontWeight: '600' }}>
                    {activeComplaint.assigned_to_details?.full_name || 'Not Assigned'}
                  </p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Category</h5>
                  <p style={{ marginTop: '0.25rem' }}>{activeComplaint.category_details?.name}</p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Escalation Status</h5>
                  <p style={{ marginTop: '0.25rem', color: activeComplaint.is_escalated ? 'var(--color-critical)' : 'inherit', fontWeight: activeComplaint.is_escalated ? '700' : 'normal' }}>
                    {activeComplaint.is_escalated ? '🚨 Escalated (48h inactivity)' : 'Normal'}
                  </p>
                </div>
              </div>

              {activeComplaint.attachments && activeComplaint.attachments.length > 0 && (
                <div>
                  <h5 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Attachments</h5>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {activeComplaint.attachments.map(att => (
                      <a 
                        key={att.id} 
                        href={att.file_path} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                      >
                        <FileText size={14} /> {att.file_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline (Audit Trail) */}
              <div>
                <h5 style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Complaint History</h5>
                <div className="timeline">
                  {activeComplaint.status_logs && activeComplaint.status_logs.map(log => (
                    <div key={log.id} className="timeline-item">
                      <div className="timeline-dot" style={{ backgroundColor: `var(--color-${log.new_status})` }}></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span style={{ fontWeight: '600', color: '#ffffff' }}>
                            Status: {log.new_status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span>{new Date(log.changed_at).toLocaleString()}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Updated by: {log.changed_by_name} ({log.changed_by_role})
                        </span>
                        {log.notes && (
                          <p className="timeline-notes">"{log.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-muted)' }}>
              <Eye size={48} style={{ marginBottom: '1rem', opacity: '0.5' }} />
              <p>Select a complaint from the triage queue to assign it, monitor status, or close.</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Assign Complaint</h3>
              <XCircle size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowAssignModal(false)} />
            </div>
            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label className="form-label">Select Faculty Member</label>
                <select 
                  className="form-input" 
                  value={selectedFacultyId} 
                  onChange={e => setSelectedFacultyId(e.target.value)} 
                  required
                >
                  <option value="">Select Faculty...</option>
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.full_name} ({f.department || 'No department'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assignment Note / Instructions (Optional)</label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  value={assignmentNotes} 
                  onChange={e => setAssignmentNotes(e.target.value)} 
                  placeholder="Provide any instructions for the faculty member..."
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Assign</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Close Modal */}
      {showForceCloseModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Force Close Complaint</h3>
              <XCircle size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowForceCloseModal(false)} />
            </div>
            <form onSubmit={handleForceClose}>
              <div className="form-group">
                <label className="form-label">Justification / Reason for Closure</label>
                <textarea 
                  className="form-input" 
                  rows="4" 
                  value={forceCloseJustification} 
                  onChange={e => setForceCloseJustification(e.target.value)} 
                  placeholder="Explain why this complaint is being forcibly closed..."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-critical)', flex: 1 }}>Force Close</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForceCloseModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
