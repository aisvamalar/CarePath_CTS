import { useState, useEffect, useRef } from 'react';
import { BASE_URL } from '../services/apiClient';

interface AgentStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  description: string;
  details?: string[];
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [steps, setSteps] = useState<AgentStep[]>([
    { id: 'care_plan', title: 'Care Plan Agent', status: 'pending', description: 'Analyzing patient conditions and creating care plan...', details: [] },
    { id: 'followup', title: 'Follow-up Agent', status: 'pending', description: 'Scheduling patient check-ins...', details: [] },
    { id: 'response_analyser', title: 'Response Analyser Agent', status: 'pending', description: 'Analyzing patient response patterns...', details: [] },
    { id: 'appointment', title: 'Appointment Agent', status: 'pending', description: 'Evaluating appointment needs...', details: [] },
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
  }, [steps]);

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
        setSteps((prev) =>
          prev.map((step) =>
            step.id === data.agent
              ? { ...step, status: 'active' }
              : step
          )
        );
        setCurrentMessage(data.message);
        break;

      case 'tool_call':
        // Add high-level tool descriptions
        const toolDescriptions: Record<string, string> = {
          'risk_classification': 'Assessing patient risk level',
          'schedule_checkin': 'Scheduling follow-up check-in',
          'create_care_plan': 'Creating personalized care tasks',
          'book_appointment': 'Booking medical appointment',
        };
        
        if (toolDescriptions[data.tool]) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === data.agent
                ? { ...step, details: [...(step.details || []), toolDescriptions[data.tool]] }
                : step
            )
          );
        }
        break;

      case 'tool_result':
        // Update step with meaningful results
        if (data.result && !data.result.includes('function') && !data.result.includes('error')) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === data.agent
                ? { ...step, description: data.result }
                : step
            )
          );
        }
        break;

      case 'llm_chunk':
        // Skip raw LLM output
        break;

      case 'agent_complete':
        const completionDescriptions: Record<string, string> = {
          'care_plan': 'Care plan created with personalized tasks',
          'followup': 'Check-in schedule configured',
          'response_analyser': 'Patient monitoring system ready',
          'appointment': 'Appointment requirements evaluated',
        };
        
        setSteps((prev) =>
          prev.map((step) =>
            step.id === data.agent
              ? { ...step, status: 'complete', description: completionDescriptions[data.agent] || 'Task completed' }
              : step
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
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'pending', details: [] })));
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
          <div className="careplan-modal__header-content">
            <svg className="careplan-modal__header-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Generating Care Plan for {patientName}</h2>
          </div>
          {phase !== 'generating' && (
            <button className="careplan-modal__close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {phase === 'generating' && (
          <div className="careplan-modal__body">
            {/* Chain of Thought Header */}
            <div className="cot-header" onClick={() => setIsExpanded(!isExpanded)}>
              <svg className="cot-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 3.5c3.59 0 6.5 2.46 6.5 5.5s-2.91 5.5-6.5 5.5a7.5 7.5 0 01-2.8-.55L3.5 15.5l1.05-3.2A4.9 4.9 0 013.5 9c0-3.04 2.91-5.5 6.5-5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="7" cy="9" r="0.75" fill="currentColor"/>
                <circle cx="10" cy="9" r="0.75" fill="currentColor"/>
                <circle cx="13" cy="9" r="0.75" fill="currentColor"/>
              </svg>
              <span className="cot-title">Agent Workflow</span>
              <svg className={`cot-chevron ${isExpanded ? 'cot-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
              <div className="cot-content">
                {steps.map((step, index) => (
                  <div key={step.id} className={`cot-step cot-step--${step.status}`}>
                    <div className="cot-step__line-wrapper">
                      <div className="cot-step__icon">
                        {step.status === 'complete' && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {step.status === 'active' && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                        {step.status === 'pending' && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                          </svg>
                        )}
                      </div>
                      {index < steps.length - 1 && <div className="cot-step__line" />}
                    </div>
                    
                    <div className="cot-step__content">
                      <div className="cot-step__header">
                        <span className="cot-step__title">{step.title}</span>
                        {step.status === 'complete' && (
                          <span className="cot-step__badge cot-step__badge--complete">Complete</span>
                        )}
                        {step.status === 'active' && (
                          <span className="cot-step__badge cot-step__badge--active">Working...</span>
                        )}
                      </div>
                      
                      {(step.status === 'active' || step.status === 'complete') && (
                        <div className="cot-step__description">{step.description}</div>
                      )}
                      
                      {step.details && step.details.length > 0 && (
                        <div className="cot-step__details">
                          {step.details.map((detail, idx) => (
                            <span key={idx} className="cot-detail-badge">{detail}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* Current Status Message */}
            <div className="careplan-modal__status-bar">
              <svg className="spinner-icon" width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="37.7" strokeDashoffset="28" strokeLinecap="round"/>
              </svg>
              <span>{currentMessage}</span>
            </div>
          </div>
        )}

        {phase === 'review' && summary && (
          <div className="careplan-modal__body">
            <div className="careplan-modal__success">
              <svg className="success-icon-svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" fill="#d1fae5" stroke="#10b981" strokeWidth="2"/>
                <path d="M20 32l8 8 16-16" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
                  <div className="appointment-alert__header">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M3 17c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <h5>Appointment Required</h5>
                  </div>
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
                {sending ? (
                  <>
                    <svg className="btn-spinner" width="16" height="16" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="37.7" strokeDashoffset="28" strokeLinecap="round"/>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 2L7 9M14 2l-4 12-3-6-6-3 12-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Send to Patient
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="careplan-modal__body">
            <div className="careplan-modal__error">
              <svg className="error-icon-svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" fill="#fee2e2" stroke="#ef4444" strokeWidth="2"/>
                <path d="M22 22l20 20M42 22L22 42" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <h3>Generation Failed</h3>
              <p>{error}</p>
            </div>

            <div className="careplan-modal__actions">
              <button className="btn btn--secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn--primary" onClick={handleRetry}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 8a5 5 0 11-1.5-3.5M13 2v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Retry
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
          border-bottom: 1px solid #f2d4ca;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #fff5f2 0%, #ffffff 100%);
        }

        .careplan-modal__header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .careplan-modal__header-icon {
          color: #f2846b;
        }

        .careplan-modal__header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #2d1a14;
        }

        .careplan-modal__close {
          background: none;
          border: none;
          cursor: pointer;
          color: #a8a8a8;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .careplan-modal__close:hover {
          color: #2d1a14;
          background: #fff5f2;
        }

        .careplan-modal__body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        /* Chain of Thought Header */
        .cot-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          background: #fff5f2;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 20px;
          border: 1.5px solid #f2d4ca;
        }

        .cot-header:hover {
          background: #ffeee7;
          border-color: #f2846b;
        }

        .cot-icon {
          color: #f2846b;
        }

        .cot-title {
          flex: 1;
          font-weight: 600;
          color: #6b5650;
          font-size: 0.9375rem;
        }

        .cot-chevron {
          color: #a8a8a8;
          transition: transform 0.3s ease;
        }

        .cot-chevron--open {
          transform: rotate(90deg);
        }

        /* Chain of Thought Content */
        .cot-content {
          padding: 0 4px;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Individual Step */
        .cot-step {
          display: flex;
          gap: 12px;
          padding-bottom: 24px;
        }

        .cot-step:last-child {
          padding-bottom: 0;
        }

        .cot-step__line-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .cot-step__icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          color: #d9d4d1;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .cot-step--active .cot-step__icon {
          background: #ffeee7;
          color: #f2846b;
          animation: pulse 2s ease-in-out infinite;
        }

        .cot-step--complete .cot-step__icon {
          background: #e8f5f0;
          color: #7cc4a4;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .cot-step__line {
          width: 2px;
          flex: 1;
          background: #f2d4ca;
          margin-top: 4px;
          min-height: 20px;
        }

        .cot-step--complete .cot-step__line {
          background: #c9e4d9;
        }

        .cot-step--active .cot-step__line {
          background: linear-gradient(180deg, #f5a08a 0%, #f2d4ca 100%);
        }

        .cot-step__content {
          flex: 1;
          min-width: 0;
        }

        .cot-step__header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .cot-step__title {
          font-weight: 600;
          color: #374151;
          font-size: 0.9375rem;
        }

        .cot-step__badge {
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 8px;
          font-weight: 600;
        }

        .cot-step__badge--complete {
          background: #e8f5f0;
          color: #4d9d7b;
        }

        .cot-step__badge--active {
          background: #ffeee7;
          color: #f2846b;
        }

        .cot-step__description {
          color: #6b7280;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        .cot-step__details {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .cot-detail-badge {
          background: #f3f4f6;
          color: #6b7280;
          font-size: 0.75rem;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 500;
        }

        /* Status Bar */
        .careplan-modal__status-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: #fff5f2;
          border-radius: 10px;
          margin-top: 20px;
          border: 1.5px solid #f2d4ca;
        }

        .spinner-icon {
          color: #f2846b;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .careplan-modal__status-bar span {
          color: #6b5650;
          font-size: 0.9375rem;
          font-weight: 500;
        }

        .careplan-modal__success {
          text-align: center;
          margin-bottom: 32px;
        }

        .success-icon-svg {
          margin-bottom: 16px;
        }

        .careplan-modal__success h3 {
          color: #4d9d7b;
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
          background: #fff5f2;
          border: 2px solid #f2846b;
          border-radius: 10px;
          padding: 18px;
          margin-top: 18px;
        }

        .appointment-alert__header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #e06a4f;
          margin-bottom: 12px;
        }

        .appointment-alert h5 {
          margin: 0;
          color: #6b5650;
          font-size: 1rem;
          font-weight: 600;
        }

        .appointment-alert p {
          margin: 8px 0;
          color: #6b5650;
        }

        .appointment-alert ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .appointment-alert li {
          color: #6b5650;
          padding: 4px 0;
        }

        .careplan-modal__error {
          text-align: center;
          margin-bottom: 32px;
        }

        .error-icon-svg {
          margin-bottom: 16px;
        }

        .careplan-modal__error h3 {
          color: #e06a4f;
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
          background: #f2846b;
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn--primary:hover:not(:disabled) {
          background: #e06a4f;
        }

        .btn-spinner {
          animation: spin 1s linear infinite;
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
