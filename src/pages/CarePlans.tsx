import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { patientAPI, type PostDischargeStatus } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import NotificationBadge from '../components/NotificationBadge';
import NotificationsPanel from '../components/NotificationsPanel';
import Sidebar from '../components/Sidebar';

export default function CarePlans() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  const [carePlan, setCarePlan] = useState<PostDischargeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Chat state (from remote logic)
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const {
    notifications,
    unreadCount,
    refresh: refreshNotifications,
    markAsRead,
    dismiss,
  } = useNotifications({ pollInterval: 30000 });

  const loadCarePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const plan = await patientAPI.getMyCarePlan();
      setCarePlan(plan);
    } catch (err: unknown) {
      console.error('Failed to load care plan:', err);
      setError('Unable to load your care plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCarePlan();
  }, []);

  // Chat submit handler (remote endpoint logic)
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const token = localStorage.getItem('cp_token');

      // Get current user info
      const userResponse = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!userResponse.ok) throw new Error('Failed to get user info');
      const userData = await userResponse.json();

      // Submit to patient response endpoint
      const response = await fetch(`${baseUrl}/patients/${userData.patient_id}/care-plan-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ patient_response: userMessage })
      });

      if (!response.ok) throw new Error('Failed to submit response');
      const result = await response.json();

      // Add assistant response based on classification
      let assistantMessage = '';
      if (result.classification === 'URGENT') {
        assistantMessage = `I've detected this is urgent. Your care team has been notified and we're scheduling an appointment for you. Please wait for further instructions.`;
      } else if (result.classification === 'CONCERN') {
        assistantMessage = `Thank you for letting me know. I've updated your care plan based on your concerns. Your care team will review this and may reach out to you.`;
      } else {
        assistantMessage = `Thank you for the update! I've recorded this in your care plan. Keep up the good work with your recovery.`;
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

      // Reload care plan to show updates
      await loadCarePlan();
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact your care team.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const displayName = state.patient?.name ?? state.patient?.username ?? 'Patient';

  /**
   * Sidebar + main shell, shared by every state of this page.
   * Plain function (not a component) so <Sidebar> keeps its identity
   * across re-renders and doesn't lose its search / loaded chat state.
   */
  const shell = (children: ReactNode) => (
    <div className="cpd-layout">
      <div className={`chat-sidebar-desktop${state.sidebarOpen ? '' : ' chat-sidebar-hidden'}`}>
        <Sidebar onNewChat={() => navigate('/chat')} />
      </div>

      {drawerOpen && (
        <div className="cpd-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="cpd-drawer" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNewChat={() => { navigate('/chat'); setDrawerOpen(false); }} />
          </div>
        </div>
      )}

      <main className="cpd-page">{children}</main>
    </div>
  );

  /** Page header — shared across states. */
  const header = (subtitle: string) => (
    <header className="cpd-header">
      <button
        className="cpd-header__menu"
        aria-label="Toggle sidebar"
        onClick={() => {
          if (window.innerWidth < 768) setDrawerOpen(v => !v);
          else dispatch({ type: 'TOGGLE_SIDEBAR' });
        }}
      >
        ☰
      </button>
      <button className="cpd-header__back" aria-label="Back to chat" onClick={() => navigate('/chat')}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 5L7 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className="cpd-header__text">
        <h1 className="cpd-header__title">Care Plan Details</h1>
        <p className="cpd-header__subtitle">{subtitle}</p>
      </div>
      <div className="cpd-header__actions">
        <div style={{ position: 'relative' }}>
          <NotificationBadge
            count={unreadCount}
            onClick={() => setShowNotifications(!showNotifications)}
          />
          {showNotifications && (
            <>
              <div className="cpd-overlay" onClick={() => setShowNotifications(false)} />
              <div className="cpd-notifications-dropdown">
                <NotificationsPanel
                  notifications={notifications}
                  onMarkAsRead={markAsRead}
                  onDismiss={dismiss}
                  onRefresh={refreshNotifications}
                />
              </div>
            </>
          )}
        </div>
        <div className="cpd-header__user">
          <span className="cpd-header__greeting">Hi, {displayName}</span>
          <span className="cpd-header__role">Patient</span>
        </div>
      </div>
    </header>
  );

  // Loading state
  if (loading) {
    return shell(
      <>
        {header('Post-Discharge Care Plan')}
        <div className="cpd-loading">
          <div className="cpd-loading__spinner" />
          <p className="cpd-loading__text">Loading your care plan...</p>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return shell(
      <>
        {header('Post-Discharge Care Plan')}
        <div className="cpd-empty">
          <div className="cpd-empty__icon">⚠️</div>
          <h2 className="cpd-empty__title">Something went wrong</h2>
          <p className="cpd-empty__desc">{error}</p>
          <button className="cpd-btn cpd-btn--primary" onClick={loadCarePlan}>
            Try Again
          </button>
        </div>
      </>
    );
  }

  // No care plan
  if (!carePlan || !carePlan.care_plan || carePlan.care_plan.tasks.length === 0) {
    return shell(
      <>
        {header('Post-Discharge Care Plan')}
        <div className="cpd-empty">
          <div className="cpd-empty__icon">📋</div>
          <h2 className="cpd-empty__title">No Active Care Plan</h2>
          <p className="cpd-empty__desc">Your care team hasn't assigned a post-discharge care plan yet. Complete your intake assessment to receive a personalized plan.</p>
          <button className="cpd-btn cpd-btn--primary" onClick={() => navigate('/chat')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H9l-3 2.5V12H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            Chat with CarePath
          </button>
        </div>
      </>
    );
  }

  // Data
  const tasks = carePlan.care_plan.tasks;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const planStatus = carePlan.care_plan.status;
  const isAtRisk = planStatus === 'at_risk';
  const isCompleted = planStatus === 'completed';

  const keyInfo = carePlan.response_analyser?.key_info ?? {};
  const dischargeDestination = (keyInfo.discharge_destination as string) ?? 'Home';
  const adherenceRate = (keyInfo.adherence_rate as string) ?? '—';
  const triageFlag = (keyInfo.triage_flag as string) ?? 'NORMAL';
  const clinicalNotes = (keyInfo.reported_symptoms as string) ?? '';

  const appointmentDate = carePlan.appointment?.date;
  const hasAppointment = carePlan.appointment?.is_appointment ?? false;
  const lastCheckin = carePlan.follow_up?.last_checkin;

  // Generate plan ID from patient_id
  const planId = `CP-${(carePlan.patient_id || '').slice(-8).toUpperCase()}`;

  // Timeline items based on real data
  const timelineItems = buildTimeline(carePlan);

  return shell(
    <>
      {header('AI Generated / Post-Discharge Care Plan')}

      {/* Content */}
      <div className="cpd-content">
        {/* Plan ID + Status Badge */}
        <div className="cpd-plan-id-row">
          <span className="cpd-plan-id">
            Plan ID: <strong>{planId}</strong>
          </span>
          <span className={`cpd-status-badge cpd-status-badge--${isCompleted ? 'completed' : isAtRisk ? 'risk' : 'active'}`}>
            {isCompleted ? '✓ COMPLETED' : isAtRisk ? '⚠ AT RISK' : '● ACTIVE'}
          </span>
        </div>

        {/* Patient Info Card */}
        <div className="cpd-patient-card">
          <div className="cpd-patient-card__left">
            <div className="cpd-patient-card__avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="cpd-patient-card__info">
              <h2 className="cpd-patient-card__name">{displayName}</h2>
              <p className="cpd-patient-card__meta">Patient ID: {carePlan.patient_id}</p>
              <div className="cpd-patient-card__badges">
                <span className={`cpd-risk-badge cpd-risk-badge--${triageFlag === 'HIGH_RISK' ? 'high' : triageFlag === 'ATTENTION_REQUIRED' ? 'medium' : 'low'}`}>
                  Risk: {triageFlag === 'HIGH_RISK' ? 'HIGH' : triageFlag === 'ATTENTION_REQUIRED' ? 'MEDIUM' : 'LOW'}
                </span>
                <span className={`cpd-intensity-badge cpd-intensity-badge--${isAtRisk ? 'intensive' : 'standard'}`}>
                  Intensity: {isAtRisk ? 'INTENSIVE' : 'STANDARD'}
                </span>
              </div>
            </div>
          </div>
          <div className="cpd-patient-card__right">
            <div className="cpd-patient-card__detail">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12v8H2z" stroke="currentColor" strokeWidth="1.4"/><path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.4"/></svg>
              <span>Discharge: <strong>{capitalize(dischargeDestination)}</strong></span>
            </div>
            <div className="cpd-patient-card__detail">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 1.5V4M11 1.5V4M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <span>Adherence: <strong>{adherenceRate}</strong></span>
            </div>
            {lastCheckin && (
              <div className="cpd-patient-card__detail">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                <span>Last Check-in: <strong>{formatDate(lastCheckin)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Plan Summary */}
        {clinicalNotes && (
          <div className="cpd-summary-card">
            <div className="cpd-summary-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="var(--cp-coral)" strokeWidth="1.5"/>
                <path d="M8 8h8M8 12h8M8 16h4" stroke="var(--cp-coral)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="cpd-summary-card__text">
              <h3>Plan Summary</h3>
              <p>{clinicalNotes}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Tasks + Timeline */}
        <div className="cpd-grid">
          {/* Plan Tasks */}
          <div className="cpd-tasks-section">
            <h3 className="cpd-section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="2" width="14" height="16" rx="2" stroke="var(--cp-coral)" strokeWidth="1.4"/>
                <path d="M7 7h6M7 10h6M7 13h4" stroke="var(--cp-coral)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Plan Tasks
            </h3>

            {/* Progress bar */}
            <div className="cpd-progress">
              <div className="cpd-progress__bar">
                <div className="cpd-progress__fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="cpd-progress__label">{completedCount}/{tasks.length} completed</span>
            </div>

            {/* Tasks table */}
            <div className="cpd-tasks-table">
              <div className="cpd-tasks-table__header">
                <span>Task</span>
                <span>Status</span>
              </div>
              {tasks.map((task, idx) => {
                const isDone = task.status === 'completed';
                const isInProgress = task.status === 'in_progress';
                return (
                  <div key={idx} className={`cpd-task-row ${isDone ? 'cpd-task-row--done' : ''}`}>
                    <div className="cpd-task-row__left">
                      <div className={`cpd-task-row__icon ${isDone ? 'cpd-task-row__icon--done' : isInProgress ? 'cpd-task-row__icon--progress' : ''}`}>
                        {isDone ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                        )}
                      </div>
                      <span className={`cpd-task-row__text ${isDone ? 'cpd-task-row__text--done' : ''}`}>
                        {task.task}
                      </span>
                    </div>
                    <span className={`cpd-task-status cpd-task-status--${isDone ? 'done' : isInProgress ? 'progress' : 'pending'}`}>
                      {isDone ? 'COMPLETED' : isInProgress ? 'IN PROGRESS' : 'PENDING'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan Timeline */}
          <div className="cpd-timeline-section">
            <h3 className="cpd-section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="var(--cp-coral)" strokeWidth="1.4"/>
                <path d="M10 6v4l3 2" stroke="var(--cp-coral)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Plan Timeline
            </h3>
            <div className="cpd-timeline">
              {timelineItems.map((item, idx) => (
                <div key={idx} className="cpd-timeline__item">
                  <div className={`cpd-timeline__dot cpd-timeline__dot--${item.color}`} />
                  {idx < timelineItems.length - 1 && <div className="cpd-timeline__line" />}
                  <div className="cpd-timeline__content">
                    <span className="cpd-timeline__label">{item.label}</span>
                    <span className="cpd-timeline__date">{item.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Care Plan Chat Section (remote endpoint logic integrated) */}
        <div className="cpd-info-card cpd-info-card--chat" style={{ marginTop: '1.5rem' }}>
          <h4 className="cpd-info-card__title">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2h14a1 1 0 011 1v9a1 1 0 01-1 1H10l-3 2.5V13H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="var(--cp-coral)" strokeWidth="1.4"/>
            </svg>
            Chat with Your Care Team
          </h4>

          {/* Chat Messages */}
          <div className="cpd-chat-messages" style={{
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '12px',
            background: 'var(--cp-bg-secondary, #f9fafb)',
            borderRadius: '8px',
            marginBottom: '12px'
          }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--cp-text-muted, #9ca3af)' }}>
                <p>💬 How are you feeling today?</p>
                <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                  Share your progress, concerns, or ask questions about your care plan
                </p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: '10px'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: msg.role === 'user' ? 'var(--cp-coral, #3b82f6)' : 'var(--cp-success, #10b981)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div style={{
                    background: msg.role === 'user' ? 'var(--cp-coral, #3b82f6)' : 'white',
                    color: msg.role === 'user' ? 'white' : 'var(--cp-text, #1f2937)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    maxWidth: '75%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    fontSize: '0.875rem'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--cp-success, #10b981)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>AI</div>
                <div style={{
                  background: 'white',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  fontSize: '0.875rem'
                }}>
                  <span style={{ opacity: 0.6 }}>Analyzing your response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              disabled={chatLoading}
              className="cpd-chat-input"
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--cp-border, #d1d5db)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="cpd-btn cpd-btn--primary"
            >
              Send
            </button>
          </form>
          <p style={{ fontSize: '0.7rem', color: 'var(--cp-text-muted, #6b7280)', marginTop: '6px', fontStyle: 'italic' }}>
            Your messages are analyzed by AI to update your care plan
          </p>
        </div>

        {/* Bottom Cards: Discharge Notes + Quick Tips */}
        <div className="cpd-bottom-grid">
          {/* Discharge Notes */}
          <div className="cpd-info-card cpd-info-card--notes">
            <h4 className="cpd-info-card__title">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2" stroke="var(--cp-coral)" strokeWidth="1.4"/>
                <path d="M5 6h8M5 9h8M5 12h5" stroke="var(--cp-coral)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Discharge Notes
            </h4>
            <p className="cpd-info-card__body">
              {clinicalNotes || 'Continue prescribed medications. Monitor symptoms. Report any concerns to your care team immediately.'}
            </p>
            {lastCheckin && (
              <span className="cpd-info-card__meta">Updated on: {formatDate(lastCheckin)}</span>
            )}
          </div>

          {/* Quick Tips */}
          <div className="cpd-info-card cpd-info-card--tips">
            <h4 className="cpd-info-card__title">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="var(--cp-coral)" strokeWidth="1.4"/>
                <path d="M9 5v4M9 12h.01" stroke="var(--cp-coral)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Quick Tips for You
            </h4>
            <ul className="cpd-tips-list">
              <li><span className="cpd-tips-list__check">✓</span> Take medications as prescribed</li>
              <li><span className="cpd-tips-list__check">✓</span> Monitor symptoms and report changes</li>
              <li><span className="cpd-tips-list__check">✓</span> Keep all follow-up appointments</li>
              {isAtRisk && <li><span className="cpd-tips-list__check">⚠</span> Contact care team if symptoms worsen</li>}
            </ul>
          </div>
        </div>

        {/* Next Appointment */}
        {hasAppointment && appointmentDate && (
          <div className="cpd-appointment-card">
            <div className="cpd-appointment-card__left">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="var(--cp-coral)" strokeWidth="1.5"/>
                <path d="M7 2v4M17 2v4M3 9h18" stroke="var(--cp-coral)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div>
                <h4>Next Follow-up Appointment</h4>
                <p>{formatDateFull(appointmentDate)}</p>
              </div>
            </div>
            <button className="cpd-btn cpd-btn--outline" onClick={() => navigate('/appointments')}>
              View Appointments
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="cpd-footer-actions">
          <button className="cpd-btn cpd-btn--primary cpd-btn--lg" onClick={() => navigate('/chat')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H9l-3 2.5V12H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            Chat with CarePath Assistant
          </button>
        </div>

        {/* Security Footer */}
        <div className="cpd-security-footer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L2 3v4c0 3.5 2.5 5.5 5 6.5 2.5-1 5-3 5-6.5V3L7 1z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5 7l2 2 3-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>All data is secure and HIPAA compliant.</span>
          <span className="cpd-security-footer__source">Data Source: EHR System</span>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface TimelineItem {
  label: string;
  date: string;
  color: 'green' | 'orange' | 'red' | 'gray' | 'blue';
}

function buildTimeline(plan: PostDischargeStatus): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Plan created
  if (plan.follow_up?.last_checkin) {
    items.push({
      label: 'Plan Created',
      date: formatDate(plan.follow_up.last_checkin),
      color: 'green',
    });
  }

  // Completed tasks
  const completedTasks = plan.care_plan.tasks.filter(t => t.status === 'completed');
  completedTasks.forEach(t => {
    items.push({
      label: `${t.task.substring(0, 30)}${t.task.length > 30 ? '...' : ''} - Done`,
      date: 'Completed',
      color: 'green',
    });
  });

  // In-progress tasks
  const inProgressTasks = plan.care_plan.tasks.filter(t => t.status === 'in_progress');
  inProgressTasks.forEach(t => {
    items.push({
      label: `${t.task.substring(0, 30)}${t.task.length > 30 ? '...' : ''}`,
      date: 'In Progress',
      color: 'orange',
    });
  });

  // Follow-up scheduled
  if (plan.follow_up?.next_checkin) {
    items.push({
      label: 'Next Follow-up',
      date: formatDate(plan.follow_up.next_checkin),
      color: plan.follow_up.is_scheduled ? 'blue' : 'gray',
    });
  }

  // Appointment
  if (plan.appointment?.is_appointment && plan.appointment.date) {
    items.push({
      label: 'Follow-up Appointment',
      date: formatDate(plan.appointment.date),
      color: 'blue',
    });
  }

  // Pending tasks
  const pendingTasks = plan.care_plan.tasks.filter(t => t.status === 'pending');
  if (pendingTasks.length > 0) {
    items.push({
      label: `${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''} pending`,
      date: 'Awaiting completion',
      color: 'gray',
    });
  }

  return items.length > 0 ? items : [{ label: 'Plan initiated', date: 'Today', color: 'green' }];
}
