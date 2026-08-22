import { useState, useEffect, useRef } from 'react';
import { BASE_URL } from '../services/apiClient';

interface Agent {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  logs: string[];
}

interface CarePlanGenerationModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSendSuccess: () => void;
}

export default function CareplanGenerationModal({
  patientId,
  patientName,
  onClose,
  onSendSuccess,
}: CarePlanGenerationModalProps) {
  const [phase, setPhase] = useState<'generating' | 'review' | 'error'>('generating');
  const [agents, setAgents] = useState<Agent[]>([
    { id: 'care_plan', title: '🤖 Care Plan Agent', status: 'pending', logs: [] },
    { id: 'followup', title: '🤖 Follow-up Agent', status: 'pending', logs: [] },
    { id: 'response_analyser', title: '🤖 Response Analyser Agent', status: 'pending', logs: [] },
    { id: 'appointment', title: '🤖 Appointment Agent', status: 'pending', logs: [] },
  ]);
  const [currentMessage, setCurrentMessage] = useState('Initializing...');
  const [carePlan, setCarePlan] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [appointmentContext, setAppointmentContext] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startGeneration();
    return () => {
      // Clean up on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [patientId]);

  useEffect(() => {
    // Auto-scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agents]);

  const startGeneration = () => {
    const token = localStorage.getItem('cp_token');
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      setPhase('error');
      return;
    }
    
    // EventSource doesn't support custom headers, so we need to pass token as query param
    // Or use fetch with streaming - let's use fetch for better auth support
    const url = `${BASE_URL}/care-manager/patients/${patientId}/generate-care-plan-stream`;
    
    const fetchStream = async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                handleEvent(data);
              } catch (err) {
                console.error('Failed to parse SSE event:', err, line);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Stream error:', err);
        setPhase('error');
        setError(err.message || 'Connection lost. Please try again.');
      }
    };

    fetchStream();
  };

  const handleEvent = (data: any) => {
    const { type } = data;

    switch (type) {
      case 'init':
        setCurrentMessage('Initializing care plan generation...');
        break;

      case 'loading':
        setCurrentMessage('Loading patient data...');
        break;

      case 'patient_loaded':
        setCurrentMessage(`Patient loaded: ${data.name} (MRN: ${data.mrn})`);
        break;

      case 'agent_start':
        // Translate technical agent messages to manager-friendly text
        const friendlyMessages: Record<string, string> = {
          'care_plan': 'Analyzing patient conditions and creating care plan...',
          'followup': 'Scheduling patient check-ins...',
          'response_analyser': 'Analyzing patient response patterns...',
          'appointment': 'Evaluating appointment needs...',
        };
        
        const friendlyMessage = friendlyMessages[data.agent] || data.message;
        
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === data.agent
              ? { ...agent, status: 'active', logs: [`▶ ${friendlyMessage}`] }
              : agent
          )
        );
        setCurrentMessage(friendlyMessage);
        break;

      case 'tool_call':
        // Skip showing technical tool calls to the manager
        // Only show if it's a high-level action
        const toolFriendlyMessages: Record<string, string> = {
          'risk_classification': '🔍 Assessing patient risk level...',
          'schedule_checkin': '📅 Scheduling check-in...',
          'create_care_plan': '📋 Creating care tasks...',
          'book_appointment': '⚕️ Booking appointment...',
        };
        
        if (toolFriendlyMessages[data.tool]) {
          setAgents((prev) =>
            prev.map((agent) =>
              agent.id === data.agent
                ? { ...agent, logs: [...agent.logs, toolFriendlyMessages[data.tool]] }
                : agent
            )
          );
        }
        break;

      case 'tool_result':
        // Only show meaningful results, not technical outputs
        if (data.result && !data.result.includes('function') && !data.result.includes('error')) {
          setAgents((prev) =>
            prev.map((agent) =>
              agent.id === data.agent
                ? { ...agent, logs: [...agent.logs, `✓ ${data.result}`] }
                : agent
            )
          );
        }
        break;

      case 'llm_chunk':
        // Skip showing raw LLM chunks - they're too technical
        // Just keep the agent in active state
        break;

      case 'agent_complete':
        // Show completion with friendly message
        const completionMessages: Record<string, string> = {
          'care_plan': '✅ Care plan created: 3 tasks assigned',
          'followup': '✅ Follow-up schedule set',
          'response_analyser': '✅ Patient monitoring configured',
          'appointment': '✅ Appointment evaluation complete',
        };
        
        const completionMsg = completionMessages[data.agent] || '✅ Task completed';
        
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === data.agent
              ? { ...agent, status: 'complete', logs: [...agent.logs, completionMsg] }
              : agent
          )
        );
        break;

      case 'saving':
        setCurrentMessage('Saving care plan to patient record...');
        break;

      case 'complete':
        setCurrentMessage('Care plan generated successfully!');
        setCarePlan(data.care_plan);
        setSummary(data.summary);
        
        // Check for appointment context
        if (data.appointment && data.appointment.appointment_context) {
          setAppointmentContext(data.appointment.appointment_context);
        }
        
        setPhase('review');
        break;

      case 'error':
        setError(data.message);
        setPhase('error');
        break;

      default:
        // Log unknown events for debugging but don't show to user
        console.log('Unknown event type:', type, data);
    }
  };

  const handleRetry = () => {
    setPhase('generating');
    setError(null);
    setAgents((prev) => prev.map((a) => ({ ...a, status: 'pending', logs: [] })));
    setCurrentMessage('Retrying...');
    startGeneration();
  };

  const handleSendToPatient = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('cp_token');
      const response = await fetch(`${BASE_URL}/care-manager/patients/${patientId}/send-care-plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send care plan');
      }

      const result = await response.json();
      console.log('Care plan sent:', result);
      
      onSendSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to send care plan:', err);
      setError(err.message || 'Failed to send care plan to patient');
      setSending(false);
    }
  };

  return (
    <div className="careplan-modal-overlay" onClick={(e) => e.target === e.currentTarget && phase !== 'generating' && onClose()}>
      <div className="careplan-modal">
        <div className="careplan-modal__header">
          <h2>🤖 Generating Care Plan for {patientName}</h2>
          {phase !== 'generating' && (
            <button className="careplan-modal__close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {phase === 'generating' && (
          <div className="careplan-modal__body">
            <div className="careplan-modal__status">
              <div className="spinner" />
              <p>{currentMessage}</p>
            </div>

            <div className="careplan-modal__agents">
              {agents.map((agent) => (
                <div key={agent.id} className={`agent-card agent-card--${agent.status}`}>
                  <div className="agent-card__header">
                    <div className="agent-card__title">
                      {agent.status === 'active' && <span className="agent-spinner">⏳</span>}
                      {agent.status === 'complete' && <span className="agent-check">✅</span>}
                      {agent.status === 'pending' && <span className="agent-pending">⚪</span>}
                      <span>{agent.title}</span>
                    </div>
                    {agent.status === 'complete' && (
                      <span className="agent-card__status">Complete</span>
                    )}
                    {agent.status === 'active' && (
                      <span className="agent-card__status agent-card__status--active">Working...</span>
                    )}
                  </div>
                  {agent.logs.length > 0 && agent.status !== 'pending' && (
                    <div className="agent-card__summary">
                      {/* Only show the most recent meaningful log entry */}
                      <div className="agent-summary-text">
                        {agent.logs[agent.logs.length - 1]}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {phase === 'review' && summary && (
          <div className="careplan-modal__body">
            <div className="careplan-modal__success">
              <div className="success-icon">✅</div>
              <h3>Care Plan Generated Successfully!</h3>
            </div>

            <div className="careplan-summary">
              <h4>📋 Care Plan Summary</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Total Tasks:</span>
                  <span className="summary-value">{summary.total_tasks}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Risk Status:</span>
                  <span className={`summary-value summary-value--${summary.status}`}>
                    {summary.status === 'at_risk' ? 'At Risk' : 'On Track'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Next Check-in:</span>
                  <span className="summary-value">
                    {summary.next_checkin ? new Date(summary.next_checkin).toLocaleString() : 'Not scheduled'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Appointment:</span>
                  <span className="summary-value">
                    {summary.appointment_scheduled ? 'Scheduled ✓' : 'Not required'}
                  </span>
                </div>
              </div>

              {carePlan && carePlan.tasks && (
                <div className="tasks-preview">
                  <h5>Tasks Created:</h5>
                  <ul>
                    {carePlan.tasks.map((task: any, idx: number) => (
                      <li key={idx}>{task.task}</li>
                    ))}
                  </ul>
                </div>
              )}

              {appointmentContext && appointmentContext.appointment_required && (
                <div className="appointment-alert">
                  <h5>⚕️ Appointment Required</h5>
                  <p><strong>Urgency:</strong> {appointmentContext.urgency}</p>
                  <p><strong>Reason:</strong> {appointmentContext.care_continuity?.reason}</p>
                  {appointmentContext.next_steps && (
                    <div>
                      <strong>Next Steps:</strong>
                      <ul>
                        {appointmentContext.next_steps.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="careplan-modal__actions">
              <button className="btn btn--secondary" onClick={onClose} disabled={sending}>
                Cancel
              </button>
              <button 
                className="btn btn--primary" 
                onClick={handleSendToPatient}
                disabled={sending}
              >
                {sending ? 'Sending...' : '📤 Send to Patient'}
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="careplan-modal__body">
            <div className="careplan-modal__error">
              <div className="error-icon">❌</div>
              <h3>Generation Failed</h3>
              <p>{error}</p>
            </div>

            <div className="careplan-modal__actions">
              <button className="btn btn--secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn--primary" onClick={handleRetry}>
                🔄 Retry
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .careplan-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }

        .careplan-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .careplan-modal__header {
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .careplan-modal__header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #111827;
        }

        .careplan-modal__close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 4px 8px;
        }

        .careplan-modal__close:hover {
          color: #111827;
        }

        .careplan-modal__body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .careplan-modal__status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .careplan-modal__agents {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .agent-card {
          border: 2px solid #d1d5db;
          border-radius: 12px;
          padding: 18px;
          transition: all 0.3s ease;
          background: white;
        }

        .agent-card--active {
          border-color: #60a5fa;
          background: linear-gradient(to bottom, #eff6ff, #ffffff);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .agent-card--complete {
          border-color: #10b981;
          background: linear-gradient(to bottom, #ecfdf5, #ffffff);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
        }

        .agent-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .agent-card__title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 1.05rem;
          color: #111827;
        }

        .agent-spinner {
          animation: pulse 1.5s ease-in-out infinite;
          font-size: 1.2rem;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .agent-check {
          font-size: 1.2rem;
        }

        .agent-pending {
          font-size: 1.2rem;
          opacity: 0.5;
        }

        .agent-card__status {
          font-size: 0.8125rem;
          color: #10b981;
          background: #d1fae5;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .agent-card__status--active {
          color: #2563eb;
          background: #dbeafe;
        }

        .agent-card--pending .agent-card__status {
          color: #6b7280;
          background: #f3f4f6;
        }

        .agent-card__summary {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 8px;
        }

        .agent-summary-text {
          color: #374151;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .careplan-modal__success {
          text-align: center;
          margin-bottom: 32px;
        }

        .success-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .careplan-modal__success h3 {
          color: #10b981;
          margin: 0;
          font-size: 1.5rem;
        }

        .careplan-summary {
          background: #f9fafb;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .careplan-summary h4 {
          margin: 0 0 16px 0;
          color: #111827;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-label {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
        }

        .summary-value {
          font-size: 1.125rem;
          color: #111827;
          font-weight: 600;
        }

        .summary-value--at_risk {
          color: #ef4444;
        }

        .summary-value--on_track {
          color: #10b981;
        }

        .tasks-preview {
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
        }

        .tasks-preview h5 {
          margin: 0 0 12px 0;
          color: #111827;
          font-size: 1rem;
        }

        .tasks-preview ul {
          margin: 0;
          padding-left: 20px;
        }

        .tasks-preview li {
          padding: 4px 0;
          color: #374151;
        }

        .appointment-alert {
          background: #fef3c7;
          border: 2px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }

        .appointment-alert h5 {
          margin: 0 0 12px 0;
          color: #92400e;
          font-size: 1rem;
        }

        .appointment-alert p {
          margin: 8px 0;
          color: #78350f;
        }

        .appointment-alert ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .appointment-alert li {
          color: #78350f;
          padding: 4px 0;
        }

        .careplan-modal__error {
          text-align: center;
          margin-bottom: 32px;
        }

        .error-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .careplan-modal__error h3 {
          color: #ef4444;
          margin: 0 0 12px 0;
          font-size: 1.5rem;
        }

        .careplan-modal__error p {
          color: #6b7280;
          margin: 0;
        }

        .careplan-modal__actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn--primary {
          background: #3b82f6;
          color: white;
        }

        .btn--primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn--secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn--secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
