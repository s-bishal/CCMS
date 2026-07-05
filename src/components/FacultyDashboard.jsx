import React, { useState, useEffect } from 'react';
import { FileText, Eye, ShieldAlert, Check, Play, FileCheck } from 'lucide-react';

export default function FacultyDashboard({ apiFetch }) {
  const [complaints, setComplaints] = useState([]);
  const [activeComplaint, setActiveComplaint] = useState(null);
  
  // Action form state
  const [actionNotes, setActionNotes] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(null); // 'in_progress' or 'resolved'

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const data = await apiFetch('/api/complaints/');
      if (Array.isArray(data)) {
        setComplaints(data);
        if (activeComplaint) {
          const updated = data.find(c => c.id === activeComplaint.id);
          if (updated) setActiveComplaint(updated);
        }
      }
    } catch (err) {
      console.error("Error fetching faculty complaints", err);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (showStatusModal === 'resolved' && !resolutionText.trim()) {
      alert("Resolution text is required.");
      return;
    }
    
    try {
      const payload = {
        status: showStatusModal,
        notes: showStatusModal === 'resolved' ? resolutionText : actionNotes,
      };
      
      if (showStatusModal === 'resolved') {
        payload.resolution_text = resolutionText;
      }

      await apiFetch(`/api/complaints/${activeComplaint.id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setActionNotes('');
      setResolutionText('');
      setShowStatusModal(null);
      fetchComplaints();
    } catch (err) {
      console.error("Error updating status", err);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2>Faculty Workspace</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Investigate and resolve complaints assigned to your department.</p>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left Pane: Assigned Complaints List */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>Assigned Tasks ({complaints.length})</h3>
          {complaints.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No complaints have been assigned to you yet.</p>
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
                      <span>Urgency: <span className={`badge badge-${c.urgency}`}>{c.urgency}</span></span>
                      <span>Assigned: {new Date(c.updated_at).toLocaleDateString()}</span>
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

        {/* Right Pane: Detail View & Investigation Panel */}
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

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--bg-card-border)' }}>
                {activeComplaint.status === 'assigned' && (
                  <button className="btn btn-primary" onClick={() => setShowStatusModal('in_progress')}>
                    <Play size={16} /> Start Investigation
                  </button>
                )}
                {activeComplaint.status === 'in_progress' && (
                  <button className="btn btn-primary" style={{ background: 'var(--color-resolved)' }} onClick={() => setShowStatusModal('resolved')}>
                    <FileCheck size={16} /> Resolve Complaint
                  </button>
                )}
                {activeComplaint.status === 'resolved' && (
                  <p style={{ color: 'var(--color-resolved)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                    <Check size={16} /> Resolution submitted. Waiting for student confirmation.
                  </p>
                )}
                {activeComplaint.status === 'closed' && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                    This complaint is closed. No further action needed.
                  </p>
                )}
              </div>

              {/* Identity Protection Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: activeComplaint.is_anonymous ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--bg-card-border)', borderRadius: '8px' }}>
                <ShieldAlert size={18} style={{ color: activeComplaint.is_anonymous ? 'var(--color-assigned)' : 'var(--text-muted)' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Student Submitter:</span>
                  <p style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                    {activeComplaint.student_details?.full_name} 
                    {activeComplaint.is_anonymous && <span style={{ color: 'var(--color-assigned)', fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>(Protected)</span>}
                  </p>
                </div>
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
                  <h5 style={{ color: 'var(--text-muted)' }}>Target Department</h5>
                  <p style={{ marginTop: '0.25rem' }}>{activeComplaint.department}</p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Category</h5>
                  <p style={{ marginTop: '0.25rem' }}>{activeComplaint.category_details?.name}</p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-muted)' }}>Escalation Status</h5>
                  <p style={{ marginTop: '0.25rem', color: activeComplaint.is_escalated ? 'var(--color-critical)' : 'inherit', fontWeight: activeComplaint.is_escalated ? '700' : 'normal' }}>
                    {activeComplaint.is_escalated ? '🚨 Escalated to Admin' : 'Normal'}
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

              {/* Status Change Form overlays (rendered inline for simplicity and aesthetics) */}
              {showStatusModal && (
                <div style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid var(--primary)', borderRadius: '12px' }}>
                  <h4 style={{ marginBottom: '1rem' }}>
                    {showStatusModal === 'in_progress' ? "Investigate Complaint" : "Resolve Complaint"}
                  </h4>
                  <form onSubmit={handleUpdateStatus}>
                    {showStatusModal === 'in_progress' ? (
                      <div className="form-group">
                        <label className="form-label">Investigation Notes / First Steps</label>
                        <textarea 
                          className="form-input" 
                          rows="3" 
                          value={actionNotes} 
                          onChange={(e) => setActionNotes(e.target.value)} 
                          placeholder="Provide brief notes on the first steps of investigation..."
                          required
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Resolution Details</label>
                        <textarea 
                          className="form-input" 
                          rows="4" 
                          value={resolutionText} 
                          onChange={(e) => setResolutionText(e.target.value)} 
                          placeholder="Explain what steps were taken to resolve this issue and what the solution is..."
                          required
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary">Submit Update</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowStatusModal(null); setActionNotes(''); setResolutionText(''); }}>Cancel</button>
                    </div>
                  </form>
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
              <p>Select a complaint task to review details, view history, or update status.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
