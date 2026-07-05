import React, { useState, useEffect } from 'react';
import { PlusCircle, FileText, Send, Eye, ShieldAlert, X, Check, AlertTriangle } from 'lucide-react';

export default function StudentDashboard({ apiFetch, csrfToken }) {
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    department: 'CS',
    urgency: 'medium',
    is_anonymous: false
  });
  const [attachment, setAttachment] = useState(null);

  // Reopen Form State
  const [reopenNotes, setReopenNotes] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);

  const departments = ['CS', 'IT', 'ECE', 'Civil', 'Administration', 'IT Support', 'Library'];

  useEffect(() => {
    fetchComplaints();
    fetchCategories();
  }, []);

  const fetchComplaints = async () => {
    try {
      const data = await apiFetch('/api/complaints/');
      if (Array.isArray(data)) {
        setComplaints(data);
        // Refresh active complaint details if open
        if (activeComplaint) {
          const updated = data.find(c => c.id === activeComplaint.id);
          if (updated) setActiveComplaint(updated);
        }
      }
    } catch (err) {
      console.error("Error fetching complaints", err);
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!formData.category) {
      alert("Please select a category");
      return;
    }
    setLoading(true);

    try {
      // Use FormData to support file upload
      const data = new FormData();
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('category', formData.category);
      data.append('department', formData.department);
      data.append('urgency', formData.urgency);
      data.append('is_anonymous', formData.is_anonymous);
      if (attachment) {
        data.append('attachments', attachment);
      }

      const response = await fetch('/api/complaints/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken
        },
        body: data
      });

      if (response.ok) {
        setFormData({
          title: '',
          description: '',
          category: '',
          department: 'CS',
          urgency: 'medium',
          is_anonymous: false
        });
        setAttachment(null);
        setShowSubmitForm(false);
        fetchComplaints();
      } else {
        const errData = await response.json();
        alert("Error filing complaint: " + JSON.stringify(errData));
      }
    } catch (err) {
      console.error("Submission failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptResolution = async (id) => {
    if (!window.confirm("Are you sure you want to accept this resolution and close the complaint?")) return;
    try {
      const data = await apiFetch(`/api/complaints/${id}/close/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      });
      fetchComplaints();
    } catch (err) {
      console.error("Error closing complaint", err);
    }
  };

  const handleRejectResolution = async (e) => {
    e.preventDefault();
    if (!reopenNotes.trim()) {
      alert("Feedback note is required to reopen the complaint.");
      return;
    }
    try {
      await apiFetch(`/api/complaints/${activeComplaint.id}/close/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', notes: reopenNotes })
      });
      setReopenNotes('');
      setShowReopenForm(false);
      fetchComplaints();
    } catch (err) {
      console.error("Error reopening complaint", err);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2>Student Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Submit and track your college complaints.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSubmitForm(true)}>
          <PlusCircle size={18} /> Submit New Complaint
        </button>
      </div>

      {/* Complaint Details view / List */}
      <div className="detail-grid">
        {/* Left pane: Complaint List */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>My Complaints ({complaints.length})</h3>
          {complaints.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>You have not submitted any complaints yet.</p>
          ) : (
            <div className="complaints-list">
              {complaints.map(c => (
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
                      <span>Submitted: {new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div>
                    <span className={`badge badge-${c.status}`}>{c.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right pane: Active Details */}
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
                    {activeComplaint.assigned_to_details?.full_name || 'Not Assigned Yet'}
                  </p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Category</h5>
                  <p style={{ marginTop: '0.25rem' }}>{activeComplaint.category_details?.name}</p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Anonymity</h5>
                  <p style={{ marginTop: '0.25rem' }}>{activeComplaint.is_anonymous ? 'Anonymous (ID Hidden)' : 'Public'}</p>
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
                        <FileText size={14} /> {att.file_name} ({att.file_size_kb} KB)
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Area */}
              {activeComplaint.status === 'resolved' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '12px' }}>
                  <h4 style={{ color: 'var(--color-resolved)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Check size={18} /> Faculty Resolution Details
                  </h4>
                  <p style={{ fontSize: '0.95rem', fontStyle: 'italic', marginBottom: '1rem' }}>"{activeComplaint.resolution_text}"</p>
                  
                  {!showReopenForm ? (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-primary" style={{ background: 'var(--color-resolved)' }} onClick={() => handleAcceptResolution(activeComplaint.id)}>
                        Accept & Close
                      </button>
                      <button className="btn btn-secondary" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={() => setShowReopenForm(true)}>
                        Reject & Reopen
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRejectResolution}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#f87171' }}>Reason for Reopening / Feedback</label>
                        <textarea 
                          className="form-input" 
                          rows="3" 
                          value={reopenNotes} 
                          onChange={(e) => setReopenNotes(e.target.value)} 
                          placeholder="Provide details on why the resolution was not satisfactory..."
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-critical)' }}>Submit Feedback</button>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowReopenForm(false); setReopenNotes(''); }}>Cancel</button>
                      </div>
                    </form>
                  )}
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
              <p>Select a complaint from the list to view its real-time tracking timeline and details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Submission Modal */}
      {showSubmitForm && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Submit Complaint</h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowSubmitForm(false)} />
            </div>
            <form onSubmit={handleSubmitComplaint}>
              <div className="form-group">
                <label className="form-label">Complaint Title</label>
                <input 
                  type="text" 
                  name="title" 
                  className="form-input" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                  placeholder="Summarize the issue briefly..."
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select name="category" className="form-input" value={formData.category} onChange={handleInputChange} required>
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target Department</label>
                  <select name="department" className="form-input" value={formData.department} onChange={handleInputChange} required>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Urgency Level</label>
                  <select name="urgency" className="form-input" value={formData.urgency} onChange={handleInputChange} required>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      name="is_anonymous" 
                      checked={formData.is_anonymous} 
                      onChange={handleInputChange}
                      style={{ transform: 'scale(1.2)' }} 
                    />
                    <span>Submit Anonymously</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Identity will be hidden from faculty, but visible to admin.
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  name="description" 
                  className="form-input" 
                  rows="4" 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  placeholder="Provide complete details about the issue..."
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">File Attachment (Optional, Max 5MB)</label>
                <input 
                  type="file" 
                  className="form-input" 
                  onChange={handleFileChange} 
                  accept=".pdf,image/*" 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  <Send size={16} /> {loading ? "Filing..." : "Submit Complaint"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
