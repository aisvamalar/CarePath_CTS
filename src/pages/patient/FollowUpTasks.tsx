import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBadge from '../../components/NotificationBadge';
import NotificationsPanel from '../../components/NotificationsPanel';

interface FollowUpTask {
  checkin_id: string;
  task_id: string;
  checkin_type: string;
  message: string;
  status: 'SCHEDULED' | 'SENT' | 'RESPONDED' | 'COMPLETED' | 'SKIPPED';
  scheduled_at: string;
  created_at: string;
  patient_response?: string;
  classification?: string;
}

export default function FollowUpTasks() {
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      // Get current user
      const userResponse = await fetch('http://localhost:8000/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }
      
      const userData = await userResponse.json();
      
      // Get patient's follow-up tasks
      const tasksResponse = await fetch(`http://localhost:8000/api/v1/patients/${userData.patient_id}/follow-up-tasks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        }
      });
      
      if (!tasksResponse.ok) {
        if (tasksResponse.status === 404) {
          setTasks([]);
          return;
        }
        throw new Error('Failed to load tasks');
      }
      
      const data = await tasksResponse.json();
      setTasks(data.checkins || []);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
      setError(err.message || 'Failed to load follow-up tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
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
        assistantMessage = `I've detected this is urgent. Your care team has been notified and we're arranging support for you. Please wait for further instructions.`;
      } else if (result.classification === 'CONCERN') {
        assistantMessage = `Thank you for letting me know. I've updated your care team about your concerns. They will review this and may adjust your follow-up plan.`;
      } else {
        assistantMessage = `Thank you for the update! I've recorded this. Keep up the good work with your recovery tasks.`;
      }
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      
      // Reload tasks to show updates
      await loadTasks();
      
    } catch (error: any) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again or contact your care team.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleMarkComplete = async (taskId: string) => {
    try {
      const userResponse = await fetch('http://localhost:8000/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }
      
      const userData = await userResponse.json();
      
      await fetch(`http://localhost:8000/api/v1/patients/${userData.patient_id}/care-plan-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        },
        body: JSON.stringify({
          patient_response: `I have completed the task`,
          checkin_id: taskId
        })
      });
      
      await loadTasks();
    } catch (error) {
      console.error('Failed to mark complete:', error);
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
          <h1 className="cp-plans-title">My Follow-Up Tasks</h1>
        </div>
        <div className="cp-plans-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'SCHEDULED' || t.status === 'SENT');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'RESPONDED');

  return (
    <div className="cp-plans-page">
      <div className="cp-plans-header">
        <button className="btn-ghost" onClick={() => navigate('/chat')} style={{ marginRight: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="cp-plans-title">My Follow-Up Tasks</h1>
        
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
        {tasks.length === 0 ? (
          <div className="cp-plan-card">
            <h2>No Follow-Up Tasks Yet</h2>
            <p>Your care team will send you tasks and check-ins as part of your recovery plan.</p>
          </div>
        ) : (
          <>
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <section className="cp-plan-section">
                <h3 className="cp-plan-section__title">PENDING TASKS ({pendingTasks.length})</h3>
                <div className="cp-tasks">
                  {pendingTasks.map((task) => (
                    <div key={task.checkin_id} className="cp-task">
                      <button
                        className="cp-task__check"
                        onClick={() => handleMarkComplete(task.checkin_id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span className="cp-task__text">{task.message}</span>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                          {task.checkin_type && <span>Type: {task.checkin_type}</span>}
                          {task.scheduled_at && <span> • Scheduled: {new Date(task.scheduled_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <section className="cp-plan-section">
                <h3 className="cp-plan-section__title">COMPLETED ({completedTasks.length})</h3>
                <div className="cp-tasks">
                  {completedTasks.map((task) => (
                    <div key={task.checkin_id} className="cp-task cp-task--done">
                      <div className="cp-task__check cp-task__check--done">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span className="cp-task__text cp-task__text--done">{task.message}</span>
                        {task.patient_response && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                            Your response: "{task.patient_response}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Chat Interface */}
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
                        Share your progress, concerns, or ask questions about your tasks
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
                      placeholder="Share your progress or concerns..."
                      disabled={chatLoading}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
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
                        cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed'
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
                    Your messages help your care team adjust your recovery plan
                  </p>
                </form>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
