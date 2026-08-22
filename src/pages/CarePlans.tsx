import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { patientAPI, type PostDischargeStatus } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import NotificationBadge from '../components/NotificationBadge';
import NotificationsPanel from '../components/NotificationsPanel';
import TaskReminderModal from '../components/TaskReminderModal';

export default function CarePlans() {
  const navigate = useNavigate();
  const { state } = useApp();
  
  const [carePlan, setCarePlan] = useState<PostDischargeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Chat state
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
    try {
      const plan = await patientAPI.getMyCarePlan();
      setCarePlan(plan);
    } catch (err) {
      console.error('Failed to load care plan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCarePlan();
  }, []);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    
    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    
    try {
      // Get current user info
      const userResponse = await fetch('http://localhost:8000/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }
      
      const userData = await userResponse.json();
      
      // Submit to patient response endpoint
      const response = await fetch(`http://localhost:8000/api/v1/patients/${userData.patient_id}/care-plan-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        },
        body: JSON.stringify({
          patient_response: userMessage
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit response');
      }
      
      const result = await response.json();
      
      // Add assistant response
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
      
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again or contact your care team.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="cp-plans-page">
        <div className="cp-plans-header">
          <button className="btn-ghost" onClick={() => navigate('/chat')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="cp-plans-title">Care Plans</h1>
        </div>
        <div className="cp-plans-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p>Loading your care plan...</p>
        </div>
      </div>
    );
  }

  if (!carePlan || !carePlan.care_plan || carePlan.care_plan.tasks.length === 0) {
    return (
      <div className="cp-plans-page">
        <div className="cp-plans-header">
          <button className="btn-ghost" onClick={() => navigate('/chat')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="cp-plans-title">Care Plans</h1>
        </div>
        <div className="cp-plans-content">
          <div className="cp-plan-card">
            <h2>No Active Care Plan</h2>
            <p>Your care team hasn't assigned a post-discharge care plan yet.</p>
            <button className="cp-help-btn" onClick={() => navigate('/chat')} style={{ marginTop: '16px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H9l-3 2.5V12H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Contact Care Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tasks = carePlan.care_plan.tasks;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const isAtRisk = carePlan.care_plan.status === 'at_risk';

  return (
    <div className="cp-plans-page">
      <div className="cp-plans-header">
        <button className="btn-ghost" onClick={() => navigate('/chat')} style={{ marginRight: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="cp-plans-title">Care Plans</h1>
        
        {/* Notification Badge */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <NotificationBadge 
            count={unreadCount} 
            onClick={() => setShowNotifications(!showNotifications)}
          />
          
          {showNotifications && (
            <>
              <div 
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 998,
                }}
                onClick={() => setShowNotifications(false)}
              />
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 999,
              }}>
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
      </div>

      <div className="cp-plans-content">
        {/* Status Badge */}
        <div className="cp-plan-badge">
          <span className={`apt-badge-dot apt-badge-dot--${isAtRisk ? 'warn' : 'success'}`} />
          {isAtRisk ? 'NEEDS ATTENTION' : 'ON TRACK'}
        </div>

        {/* Active Plan */}
        <section className="cp-plan-section">
          <div className="cp-plan-card">
            <h2 className="cp-plan-card__name">Post-Discharge Recovery Plan</h2>

            {/* Progress */}
            <div className="cp-plan-progress">
              <span className="cp-plan-progress__label">Progress:</span>
              <div className="cp-plan-progress__bar">
                <div className="cp-plan-progress__fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="cp-plan-progress__pct">{progressPct}% Complete</span>
            </div>
          </div>
        </section>

        {/* Tasks */}
        <section className="cp-plan-section">
          <h3 className="cp-plan-section__title">YOUR CARE TASKS</h3>

          <div className="cp-tasks">
            {tasks.map((task, idx) => {
              const isReframed = 'reframed' in task && task.reframed;
              const isDone = task.status === 'completed';
              
              return (
                <div
                  key={idx}
                  className={`cp-task cp-task--readonly${isDone ? ' cp-task--done' : ''}${isReframed ? ' cp-task--reframed' : ''}`}
                >
                  <div className={`cp-task__check${isDone ? ' cp-task__check--done' : ''}`}>
                    {isDone && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className={`cp-task__text${isDone ? ' cp-task__text--done' : ''}`}>
                      {task.task}
                    </span>
                    {isReframed && 'original_task' in task && (
                      <div className="cp-task__reframed-note">
                        <span className="cp-task__reframed-icon">🤖</span>
                        <span className="cp-task__reframed-text">
                          Adjusted by AI (was: {task.original_task})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="cp-tasks__count">
            {completedCount} of {tasks.length} tasks completed
          </p>
          <p className="cp-tasks__note">
            Your care manager tracks task completion. You'll receive reminders throughout the day.
          </p>
        </section>

        {/* Follow-Up Info */}
        {carePlan.follow_up && carePlan.follow_up.next_checkin && (
          <section className="cp-plan-section">
            <h3 className="cp-plan-section__title">NEXT CHECK-IN</h3>
            <div className="cp-plan-card">
              <p>
                <strong>{new Date(carePlan.follow_up.next_checkin).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}</strong>
              </p>
              {carePlan.follow_up.is_scheduled && (
                <p style={{ marginTop: '8px', color: '#179c88', fontSize: '0.875rem' }}>
                  ✓ Scheduled
                </p>
              )}
            </div>
          </section>
        )}

        {/* Care Plan Chat */}
        <section className="cp-plan-section">
          <h3 className="cp-plan-section__title">CHAT WITH YOUR CARE TEAM</h3>
          <div className="cp-plan-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Chat Messages */}
            <div style={{ 
              maxHeight: '400px', 
              overflowY: 'auto', 
              padding: '16px',
              background: '#f9fafb'
            }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                  <p>💬 How are you feeling today?</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                    Share your progress, concerns, or ask questions about your care plan
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div 
                    key={idx}
                    style={{
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      gap: '12px'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: msg.role === 'user' ? '#3b82f6' : '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}>
                      {msg.role === 'user' ? 'You' : 'AI'}
                    </div>
                    <div style={{
                      background: msg.role === 'user' ? '#3b82f6' : 'white',
                      color: msg.role === 'user' ? 'white' : '#1f2937',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      maxWidth: '75%',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}>
                    AI
                  </div>
                  <div style={{
                    background: 'white',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <span style={{ opacity: 0.6 }}>Analyzing your response...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} style={{ 
              padding: '16px', 
              borderTop: '1px solid #e5e7eb',
              background: 'white'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  style={{
                    padding: '12px 24px',
                    background: chatInput.trim() && !chatLoading ? '#3b82f6' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s'
                  }}
                >
                  Send
                </button>
              </div>
              <p style={{ 
                fontSize: '0.75rem', 
                color: '#6b7280', 
                marginTop: '8px',
                fontStyle: 'italic'
              }}>
                Your messages are analyzed by AI to update your care plan
              </p>
            </form>
          </div>
        </section>
      </div>

      <style jsx>{`
        .cp-task--reframed {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-left: 3px solid #3b82f6;
        }

        .cp-task__reframed-note {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 0.75rem;
          color: #1e40af;
          font-style: italic;
        }

        .cp-task__reframed-icon {
          font-size: 1rem;
        }

        .cp-task__reframed-text {
          line-height: 1.4;
        }

        .cp-tasks__note {
          margin-top: 8px;
          font-size: 0.8125rem;
          color: #6b7c84;
          text-align: center;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
