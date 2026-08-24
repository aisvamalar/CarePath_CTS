/**
 * CarePath — Care Plan Agent Runner (inline, not a modal/drawer)
 *
 * Mounted directly inside the right panel of Post Discharge Care. As soon as
 * a patient is selected this starts streaming the real backend workflow —
 * POST /care-manager/patients/{id}/generate-care-plan-stream — and renders
 * the 3 agents the care manager cares about (care_plan → followup →
 * care-continuity/appointment) as a vertical multi-step list, each step's
 * "Thought for N seconds" reveal powered by the existing <Reasoning>
 * primitive (the same component used on the patient detail screen), not a
 * fabricated timer. The backend also emits a `response_analyser` agent
 * event, but that step has no output relevant to care-plan generation here,
 * so it is intentionally not rendered as a step (its events are ignored).
 *
 * Once every step completes, the step list is replaced by the result —
 * care plan + appointment details straight from the SSE `complete` event —
 * centered in the full panel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_URL } from '../../services/apiClient';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '../ai/Reasoning';

type StepId = 'care_plan' | 'followup' | 'appointment';
type StepStatus = 'pending' | 'active' | 'complete' | 'error';
type Phase = 'running' | 'complete' | 'error';

interface StepState {
  id: StepId;
  title: string;
  status: StepStatus;
  /** Short line shown next to the step while it runs / after it completes. */
  headline: string;
  /** Accumulated tool_call / llm_chunk / agent_complete lines for the reasoning panel. */
  notes: string[];
}

interface CarePlanRunnerProps {
  patientId: string;
  patientName: string;
  patientMrn?: string;
  /** Fired once the plan has been sent to the patient, so the queue can refresh its status badge. */
  onSendSuccess: () => void;
}

const STEP_DEFS: { id: StepId; title: string }[] = [
  { id: 'care_plan', title: 'Care Plan Agent' },
  { id: 'followup', title: 'Follow-up Agent' },
  { id: 'appointment', title: 'Care Continuity & Appointment Agent' },
];

const TOOL_LABELS: Record<string, string> = {
  risk_classification: 'Assessing patient risk level',
  schedule_checkin: 'Scheduling follow-up check-in',
  groq_llm_analysis: 'Classifying response severity with the LLM',
  appointment_bridge: 'Checking appointment requirements',
};

function freshSteps(): StepState[] {
  return STEP_DEFS.map((s) => ({ ...s, status: 'pending', headline: 'Waiting to start…', notes: [] }));
}

export default function CarePlanGenerator({ patientId, patientName, patientMrn, onSendSuccess }: CarePlanRunnerProps) {
  const [phase, setPhase] = useState<Phase>('running');
  const [globalStatus, setGlobalStatus] = useState('Initializing…');
  const [steps, setSteps] = useState<StepState[]>(freshSteps());
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ notifications: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const updateStep = useCallback((id: StepId, patch: Partial<StepState> | ((s: StepState) => Partial<StepState>)) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)));
  }, []);

  const addNote = useCallback((id: StepId, note: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, notes: [...s.notes, note] } : s)));
  }, []);

  const handleEvent = useCallback((data: Record<string, any>) => {
    const { type, agent: rawAgent } = data as { type: string; agent?: string };
    // The backend also emits a "response_analyser" agent — not one of our
    // rendered steps, so its events are simply not applied to any step.
    const agent = STEP_DEFS.some((s) => s.id === rawAgent) ? (rawAgent as StepId) : undefined;

    switch (type) {
      case 'init':
        setGlobalStatus('Initializing care plan generation…');
        break;
      case 'loading':
        setGlobalStatus(data.message ?? 'Starting the 4-agent workflow…');
        break;
      case 'patient_loaded':
        setGlobalStatus(`Loaded ${data.name ?? patientName} (MRN ${data.mrn ?? patientMrn ?? '—'})`);
        break;

      case 'agent_start':
        if (agent) {
          updateStep(agent, (s) => ({ status: 'active', headline: data.message ?? s.headline }));
          addNote(agent, data.message ?? 'Started');
        }
        break;

      case 'tool_call':
        if (agent) addNote(agent, TOOL_LABELS[data.tool] ?? data.message ?? `Calling ${data.tool}`);
        break;

      case 'tool_result':
        if (agent && data.result && typeof data.result === 'string') addNote(agent, data.result);
        break;

      case 'llm_chunk':
        if (agent && data.text) addNote(agent, data.text);
        break;

      case 'agent_complete':
        if (agent) {
          updateStep(agent, (s) => ({ status: 'complete', headline: data.message ?? s.headline }));
          if (data.message) addNote(agent, data.message);
        }
        break;

      case 'saving':
        setGlobalStatus(data.message ?? 'Saving care plan…');
        break;

      case 'notification':
        setGlobalStatus(data.message ?? 'Dashboard updated');
        break;

      case 'complete':
        setGlobalStatus('Care plan generated successfully.');
        setResult({
          carePlan: data.care_plan ?? null,
          followUp: data.follow_up ?? null,
          appointment: data.appointment ?? null,
          summary: data.summary ?? null,
        });
        setPhase('complete');
        break;

      case 'error':
        setError(data.message ?? 'Generation failed.');
        setPhase('error');
        break;

      default:
        break;
    }
  }, [addNote, patientMrn, patientName, updateStep]);

  const start = useCallback(() => {
    setPhase('running');
    setError(null);
    setResult(null);
    setSent(null);
    setSteps(freshSteps());
    setGlobalStatus('Initializing…');

    const token = localStorage.getItem('cp_token');
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      setPhase('error');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await fetch(`${BASE_URL}/care-manager/patients/${patientId}/generate-care-plan-stream`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              handleEvent(JSON.parse(line.slice(6)));
            } catch {
              // Malformed SSE line — skip rather than break the stream.
            }
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // patient switched — not a real error
        setError(err?.message || 'Connection lost. Please try again.');
        setPhase('error');
      }
    })();
  }, [handleEvent, patientId]);

  useEffect(() => {
    start();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleSendToPatient = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('cp_token');
      const response = await fetch(`${BASE_URL}/care-manager/patients/${patientId}/send-care-plan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to send care plan');
      const body = await response.json();
      setSent({ notifications: body.notifications_created ?? 0 });
      onSendSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to send care plan to patient');
    } finally {
      setSending(false);
    }
  };

  // Once the run finishes successfully, the step list makes way for the
  // centered result — the panel shows either the running steps OR the
  // finished result, never both stacked.
  if (phase === 'complete' && result) {
    return (
      <div className="pcg-run pcg-run--centered">
        <div className="pcg-result">
          <header className="pcg-result__head">
            <span className="pcg-result__check" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#eafaf0" stroke="#2e9e5b" strokeWidth="1" />
                <path d="M6.2 10.2l2.6 2.6L14 7.6" stroke="#2e9e5b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h2>Care plan ready for {patientName}</h2>
              {patientMrn && <p>{patientMrn}</p>}
            </div>
          </header>

          <section className="pcg-result__section">
            <h3>Care Plan</h3>
            <div className="pcg-result__row">
              <span>Risk level</span>
              <strong>{result.summary?.status ? String(result.summary.status).toUpperCase() : '—'}</strong>
            </div>
            <div className="pcg-result__row">
              <span>Total tasks</span>
              <strong>{result.summary?.total_tasks ?? result.carePlan?.tasks?.length ?? 0}</strong>
            </div>
            {result.carePlan?.tasks?.length > 0 && (
              <ul className="pcg-result__tasks">
                {result.carePlan.tasks.map((t: any, idx: number) => (
                  <li key={idx}>{t.description || t.task_type || t.task || 'Task'}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="pcg-result__section">
            <h3>Appointment</h3>
            {!result.appointment || result.appointment.status === 'not_required' ? (
              <p className="pcg-result__empty">No appointment required for this patient.</p>
            ) : (
              <>
                <div className="pcg-result__row">
                  <span>Status</span>
                  <strong>{String(result.appointment.status ?? '—').replace(/_/g, ' ')}</strong>
                </div>
                {result.appointment.destination && (
                  <div className="pcg-result__row"><span>Destination</span><strong>{result.appointment.destination}</strong></div>
                )}
                {result.appointment.specialty && (
                  <div className="pcg-result__row"><span>Specialty</span><strong>{result.appointment.specialty}</strong></div>
                )}
                {typeof result.appointment.provider_count === 'number' && (
                  <div className="pcg-result__row"><span>Providers found</span><strong>{result.appointment.provider_count}</strong></div>
                )}
                {result.appointment.appointment_id && (
                  <div className="pcg-result__row"><span>Appointment ID</span><strong>{result.appointment.appointment_id}</strong></div>
                )}
              </>
            )}
          </section>

          <div className="pcg-result__actions">
            {sent ? (
              <span className="pcg-result__sent">Sent to patient · {sent.notifications} reminder(s) created</span>
            ) : (
              <>
                <button className="cp-btn cp-btn--ghost cp-btn--sm" onClick={start}>Regenerate</button>
                <button className="cp-btn cp-btn--primary cp-btn--sm" onClick={handleSendToPatient} disabled={sending}>
                  {sending ? <><span className="cp-btn__spinner" /> Sending…</> : 'Send to Patient'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="pcg-run pcg-run--centered">
        <div className="pcg-error">
          <p>{error}</p>
          <button className="cp-btn cp-btn--primary cp-btn--sm" onClick={start}>Retry</button>
        </div>
      </div>
    );
  }

  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="pcg-run">
      {/* Patient header */}
      <header className="pcg-run__head">
        <span className="pcg-run__avatar">{patientName?.[0]?.toUpperCase() ?? 'P'}</span>
        <div className="pcg-run__headtext">
          <h2>{patientName}</h2>
          {patientMrn && <p>{patientMrn}</p>}
        </div>
        <span className="pcg-run__status">
          <span className="pcg-run__spinner" aria-hidden="true" />
          {globalStatus}
        </span>
      </header>

      {/* Overall progress across the 3 agent steps */}
      <div className="pcg-progress" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="pcg-progress__track">
          <span className="pcg-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="pcg-progress__label">{completedCount}/{steps.length} agents complete</span>
      </div>

      {/* Multi-step agent list */}
      <ol className="pcg-steps">
        {steps.map((step, i) => (
          <li key={step.id} className={`pcg-step pcg-step--${step.status}`}>
            <span className="pcg-step__col">
              <span className="pcg-step__node" aria-hidden="true">
                {step.status === 'complete' ? (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7.2l2.6 2.6L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : step.status === 'active' ? (
                  <span className="pcg-step__spin" />
                ) : step.status === 'error' ? (
                  '!'
                ) : (
                  i + 1
                )}
              </span>
              {i < steps.length - 1 && <span className="pcg-step__line" aria-hidden="true" />}
            </span>

            <div className="pcg-step__body">
              <div className="pcg-step__headrow">
                <span className="pcg-step__title">{step.title}</span>
                <span className="pcg-step__id">{step.id}</span>
              </div>

              {step.status === 'pending' ? (
                <p className="pcg-step__desc">Waiting to start…</p>
              ) : (
                <>
                  <p className="pcg-step__desc">{step.headline}</p>
                  <Reasoning isStreaming={step.status === 'active'} defaultOpen>
                    <ReasoningTrigger />
                    <ReasoningContent>{step.notes.join('\n')}</ReasoningContent>
                  </Reasoning>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
