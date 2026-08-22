import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MessageBubble, { TypingIndicator } from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import SafetyChecklist from '../components/SafetyChecklist';
import SmartSafetyQuestions from '../components/SmartSafetyQuestions';
import VerdictCard from '../components/VerdictCard';
import CareNavigation from '../components/CareNavigation';
import { useApp } from '../context/AppContext';
import { intakeAPI, safetyAPI, chatAPI } from '../services/api';
import type { RedFlagsPayload, IntakeFeatures, SafetyEvaluationResponse } from '../services/api';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';

let robotImg: string;
try { robotImg = new URL('../assets/robot.png', import.meta.url).href; }
catch { robotImg = new URL('../assets/hero.png', import.meta.url).href; }

export default function Chat() {
  const { state, dispatch, activeConversation, generateId } = useApp();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [useSmartSafety] = useState(true); // Toggle between smart and full checklist

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!state.token) {
      navigate('/login');
    }
  }, [state.token, navigate]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, loading, state.phase]);

  const addMessage = useCallback(
    (conversationId: string, role: 'user' | 'assistant', content: string) => {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          conversationId,
          message: { id: generateId(), role, content, timestamp: new Date() },
        },
      });
    },
    [dispatch, generateId],
  );

  // ── Start a new conversation / intake session ──
  const handleNewChat = useCallback(async () => {
    if (!state.patient?.patient_id) {
      setError('Patient information unavailable. Please log in again.');
      return;
    }

    setError('');
    setLoading(true);

    const convId = generateId();
    const newConv = {
      id: convId,
      title: 'New Assessment',
      messages: [],
      sessionId: null,
      chatSessionId: null,
      isPinned: false,
      intakeFeatures: null,
      redFlags: null,
      safetyResult: null,
      phase: 'intake' as const,
      createdAt: new Date(),
    };

    dispatch({ type: 'NEW_CONVERSATION', payload: newConv });

    try {
      // Create backend chat history session for persistence
      const chatSession = await chatAPI.create({ patient_id: state.patient.patient_id, title: 'New Assessment' });
      dispatch({ type: 'SET_CHAT_SESSION_ID', payload: { conversationId: convId, chatSessionId: chatSession.session_id } });

      // Create intake session for triage
      const session = await intakeAPI.createSession(state.patient.patient_id);
      dispatch({ type: 'SET_SESSION_ID', payload: { conversationId: convId, sessionId: session.session_id } });

      const firstQ = session.next_question ?? 'Hello! I\'m your CarePath triage assistant. What is your main symptom today?';
      const greeting = `Hello! I'm your CarePath triage assistant.\n\n${firstQ}`;
      addMessage(convId, 'assistant', greeting);

      // Persist greeting to chat history
      try {
        await chatAPI.sendMessage(chatSession.session_id, greeting, { role_override: 'assistant' });
      } catch { /* non-critical */ }
    } catch {
      addMessage(convId, 'assistant', 'Hello! I\'m your CarePath triage assistant. I\'m having trouble connecting to the server. Please check your connection and try again.');
      setError('Failed to start session. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [state.patient, dispatch, generateId, addMessage]);

  // ── Send a message during intake ──
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeConversation || loading) return;
      const { id: convId, sessionId, chatSessionId } = activeConversation;

      if (!sessionId) {
        setError('Session not started. Please start a new chat.');
        return;
      }

      setError('');
      addMessage(convId, 'user', content);
      setLoading(true);

      // Persist user message to chat history (fire-and-forget)
      if (chatSessionId) {
        chatAPI.sendMessage(chatSessionId, content).catch(() => { /* non-critical */ });
      }

      // Update conversation title from first user message
      if (activeConversation.messages.filter((m) => m.role === 'user').length === 0) {
        const titleWords = content.split(' ').slice(0, 5).join(' ');
        const newTitle = titleWords.length > 3 ? titleWords : content.slice(0, 30);
        dispatch({ type: 'RENAME_CONVERSATION', payload: { conversationId: convId, title: newTitle } });
        // Also update title in backend
        if (chatSessionId) {
          chatAPI.updateTitle(chatSessionId, newTitle).catch(() => { /* non-critical */ });
        }
      }

      try {
        const res = await intakeAPI.sendMessage(sessionId, content);

        if (res.status === 'ERROR') {
          const errMsg = res.error_detail ?? 'Something went wrong. Please try again.';
          addMessage(convId, 'assistant', errMsg);
          return;
        }

        if (res.extracted) {
          dispatch({ type: 'SET_INTAKE_FEATURES', payload: { conversationId: convId, features: res.extracted } });
          // Update title from chief complaint
          if (res.extracted.chief_complaint) {
            dispatch({ type: 'RENAME_CONVERSATION', payload: { conversationId: convId, title: res.extracted.chief_complaint } });
            if (chatSessionId) {
              chatAPI.updateTitle(chatSessionId, res.extracted.chief_complaint).catch(() => { /* non-critical */ });
            }
          }
        }

        if (res.status === 'COMPLETE') {
          // Use the backend's completion message verbatim so the two stay in sync;
          // fall back to a local message only if the backend didn't provide one.
          const completeMsg = res.next_question?.trim()
            ? res.next_question
            : 'Thank you — I have all the information I need.\n\nNow I need to ask you a few quick YES/NO questions about severe symptoms. Please answer honestly — this helps determine if you need immediate emergency care.';
          addMessage(convId, 'assistant', completeMsg);
          dispatch({ type: 'SET_CONVERSATION_PHASE', payload: { conversationId: convId, phase: 'safety' } });
        } else {
          if (res.next_question) {
            addMessage(convId, 'assistant', res.next_question);
          }
        }
      } catch {
        addMessage(convId, 'assistant', 'Something went wrong. Please try again.');
        setError('Message failed. Please check your connection.');
      } finally {
        setLoading(false);
      }
    },
    [activeConversation, loading, addMessage, dispatch],
  );

  // ── Safety checklist submit ──
  const handleSafetySubmit = useCallback(
    async (flags: RedFlagsPayload) => {
      if (!activeConversation?.sessionId) return;
      const { id: convId, sessionId } = activeConversation;

      setSafetyLoading(true);
      setError('');
      dispatch({ type: 'SET_RED_FLAGS', payload: { conversationId: convId, redFlags: flags } });

      try {
        await safetyAPI.submitRedFlags(sessionId, flags);
        // The backend now runs the avoidable-ED model inside /evaluate and returns the
        // pathway (decision + risk + care plan) embedded in the response.
        const evalResult = await safetyAPI.evaluate(sessionId);
        dispatch({ type: 'SET_SAFETY_RESULT', payload: { conversationId: convId, result: evalResult } });
        dispatch({ type: 'SET_CONVERSATION_PHASE', payload: { conversationId: convId, phase: 'verdict' } });
      } catch {
        setError('Safety evaluation failed. Please try again.');
      } finally {
        setSafetyLoading(false);
      }
    },
    [activeConversation, dispatch, state.patient],
  );

  // ── Render the main chat area based on phase ──
  const renderMainArea = () => {
    const phase = activeConversation?.phase ?? state.phase;

    // Debug logging
    console.log('[Chat] renderMainArea:', {
      phase,
      hasActiveConv: !!activeConversation,
      sessionId: activeConversation?.sessionId,
      chiefComplaint: activeConversation?.intakeFeatures?.chief_complaint,
      useSmartSafety,
    });

    // Empty state — no active conversation
    if (!activeConversation) {
      return <EmptyState onSuggestion={handleSuggestion} onNewChat={handleNewChat} />;
    }

    // Verdict phase — show messages + verdict + care navigation all inline
    if (phase === 'verdict' && activeConversation.safetyResult) {
      return (
        <div style={styles.scrollArea}>
          {/* Preserve the conversation above */}
          <div style={styles.messages}>
            <div className="mb-date-sep">Today</div>
            {activeConversation.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>

          {/* Verdict appears as a bot-side card continuing the conversation */}
          <VerdictCard
            result={activeConversation.safetyResult}
            onNewChat={handleNewChat}
          />

          {/* Care navigation + booking flows inline below the verdict */}
          {activeConversation.safetyResult.result === 'NO' &&
            activeConversation.safetyResult.pathway?.decision === 'POTENTIALLY_AVOIDABLE' && (
              <CareNavigation
                mrn={state.patient?.mrn ?? state.patient?.ehr?.mrn ?? null}
                patientId={state.patient?.patient_id ?? null}
                intakeFeatures={activeConversation.intakeFeatures}
                patientAge={state.patient?.ehr?.age ?? null}
                patientGender={state.patient?.ehr?.gender ?? null}
                onNewConversation={handleNewChat}
              />
            )}
          <div ref={messagesEndRef} />
        </div>
      );
    }

    // Safety checklist phase
    if (phase === 'safety') {
      return (
        <div style={styles.scrollArea}>
          {/* Show intake messages above */}
          <div style={styles.messages}>
            {activeConversation.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
          
          {/* Smart safety questions or fallback to full checklist */}
          {useSmartSafety && activeConversation.sessionId && activeConversation.intakeFeatures?.chief_complaint ? (
            <SmartSafetyQuestions
              sessionId={activeConversation.sessionId}
              chiefComplaint={activeConversation.intakeFeatures.chief_complaint}
              extractedFeatures={activeConversation.intakeFeatures}
              onSubmit={handleSafetySubmit}
              loading={safetyLoading}
            />
          ) : (
            <SafetyChecklist onSubmit={handleSafetySubmit} loading={safetyLoading} />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      );
    }

    // Intake / chat phase
    return (
      <div style={styles.scrollArea}>
        <div style={styles.messages}>
          <div className="mb-date-sep">Today</div>
          {activeConversation.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {loading && <TypingIndicator />}
        </div>
        <div ref={messagesEndRef} />
      </div>
    );
  };

  // Handle suggestion card click
  const handleSuggestion = async (text: string) => {
    await handleNewChat();
    // We need to wait for the conversation to be set up, then send
    // Use a small timeout to let state update
    setTimeout(() => {
      // Find the newest conversation
      const newest = state.conversations[0];
      if (newest) {
        handleSendMessageById(text, newest.id, newest.sessionId);
      }
    }, 1500);
  };

  // Send message to a specific conversation (for suggestions)
  const handleSendMessageById = async (
    content: string,
    convId: string,
    sessionId: string | null,
  ) => {
    if (!sessionId) return;
    addMessage(convId, 'user', content);
    setLoading(true);

    // Persist to chat history
    const conv = state.conversations.find(c => c.id === convId);
    if (conv?.chatSessionId) {
      chatAPI.sendMessage(conv.chatSessionId, content).catch(() => { /* non-critical */ });
    }

    try {
      const res = await intakeAPI.sendMessage(sessionId, content);
      if (res.status === 'COMPLETE') {
        const completeMsg = res.next_question?.trim()
          ? res.next_question
          : 'Thank you — I have all the information I need.\n\nNow I need to ask you a few YES/NO questions about severe symptoms.';
        addMessage(convId, 'assistant', completeMsg);
        dispatch({ type: 'SET_CONVERSATION_PHASE', payload: { conversationId: convId, phase: 'safety' } });
      } else if (res.next_question) {
        addMessage(convId, 'assistant', res.next_question);
      }
    } catch {
      addMessage(convId, 'assistant', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showChatInput =
    activeConversation &&
    activeConversation.phase !== 'verdict' &&
    activeConversation.phase !== 'safety';

  return (
    <div style={styles.layout}>
      {/* Desktop Sidebar — hidden on mobile via CSS */}
      <div className={`chat-sidebar-desktop${state.sidebarOpen ? '' : ' chat-sidebar-hidden'}`}>
        <Sidebar onNewChat={handleNewChat} />
      </div>

      {/* Mobile Drawer overlay */}
      {sidebarDrawerOpen && (
        <div style={styles.drawerOverlay} onClick={() => setSidebarDrawerOpen(false)} role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <Sidebar onNewChat={() => { handleNewChat(); setSidebarDrawerOpen(false); }} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={styles.main} aria-label="Chat area">
        {/* Top bar */}
        <div style={styles.topBar}>
          <button
            className="chat-action-btn"
            onClick={() => {
              if (window.innerWidth < 768) setSidebarDrawerOpen(v => !v);
              else dispatch({ type: 'TOGGLE_SIDEBAR' });
            }}
            aria-label="Toggle navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Robot avatar — small */}
          <div style={styles.topBarIdentity}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={robotImg} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
              <span style={styles.topBarOnlineDot} aria-hidden="true" />
            </div>
            <div>
              <div style={styles.topBarName}>
                {activeConversation ? activeConversation.title : 'New Assessment'}
              </div>
              <div style={styles.topBarSub}>AI Triage Assistant · CarePath</div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={styles.topBarActions}>
            <button className="chat-action-btn" onClick={handleNewChat} aria-label="New assessment" title="New chat">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M13 2H5a2 2 0 00-2 2v9a2 2 0 002 2h2l2 2 2-2h2a2 2 0 002-2V4a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 6v4M7 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="chat-action-btn" onClick={() => navigate('/profile')} aria-label="Profile" title="Profile">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 16c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner} role="alert" aria-live="polite">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="#D92D20" strokeWidth="1.5"/>
              <path d="M7 4v4M7 10h.01" stroke="#D92D20" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
            <button style={styles.errorClose} onClick={() => setError('')} aria-label="Dismiss error">✕</button>
          </div>
        )}

        {/* Chat body */}
        <div style={styles.chatBody}>
          {renderMainArea()}
        </div>

        {/* Chat input */}
        {showChatInput && (
          <ChatInput
            onSend={handleSendMessage}
            disabled={loading}
            placeholder={
              loading ? 'CarePath is thinking…' : 'Describe your symptoms…'
            }
          />
        )}
      </main>

      {/* ── Right Panel (desktop only) ── */}
      <aside className="chat-right-panel">
        <RightPanel
          phase={activeConversation?.phase ?? state.phase}
          intakeFeatures={activeConversation?.intakeFeatures ?? null}
          safetyResult={activeConversation?.safetyResult ?? null}
          patientId={state.patient?.patient_id ?? null}
          onNavigate={navigate}
        />
      </aside>
    </div>
  );
}

// ── Empty state — centered with floating icons ──
function EmptyState({
  onNewChat,
}: {
  onSuggestion: (text: string) => void;
  onNewChat: () => void;
}) {
  return (
    <div className="ce-root">
      {/* Robot with floating health icons */}
      <div className="ce-hero">
        <span className="ce-icon ce-icon--1">❤️</span>
        <span className="ce-icon ce-icon--2">💊</span>
        <span className="ce-icon ce-icon--3">📋</span>
        <span className="ce-icon ce-icon--4">💬</span>
        <img src={robotImg} alt="CarePath AI" className="ce-hero__robot" />
      </div>

      {/* Title */}
      <h2 className="ce-title">CarePath <em>Assistant</em></h2>
      <p className="ce-sub">I'm here to understand your health<br/>and guide you with the right care.</p>

      {/* Input display — clickable */}
      <div className="ce-input-display" onClick={onNewChat} role="button" tabIndex={0} aria-label="Start new chat">
        <span className="ce-input-display__sparkle">✦✦</span>
        <span className="ce-input-display__text">Describe how you're feeling or ask anything...</span>
        <span className="ce-input-display__mic">
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M4 10a6 6 0 0012 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M10 16v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </span>
      </div>
    </div>
  );
}

// ── Real Calendar Component ──
function RealCalendar({ appointmentDays = [] }: { appointmentDays?: number[] }) {
  const [month, setMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = new Date();
  const year = month.getFullYear();
  const mo = month.getMonth();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const firstDay = new Date(year, mo, 1).getDay();
  const monthName = month.toLocaleString('default', { month: 'short', year: 'numeric' });

  const prev = () => setMonth(new Date(year, mo - 1, 1));
  const next = () => setMonth(new Date(year, mo + 1, 1));

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === mo && today.getDate() === day;
  const hasAppt = (day: number) => appointmentDays.includes(day);

  return (
    <>
      <div className="crp-section__header">
        <h3 className="crp-section__title">{monthName}</h3>
        <div className="crp-cal-nav">
          <button className="crp-cal-nav__btn" onClick={prev}>‹</button>
          <button className="crp-cal-nav__btn" onClick={next}>›</button>
        </div>
      </div>
      <div className="crp-calendar">
        <div className="crp-cal__header">
          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
        </div>
        <div className="crp-cal__grid">
          {[...Array(firstDay)].map((_, i) => <span key={`e${i}`} className="crp-cal__day crp-cal__day--empty" />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            return (
              <span key={day} className={`crp-cal__day${isToday(day) ? ' crp-cal__day--today' : ''}${hasAppt(day) ? ' crp-cal__day--appt' : ''}`}>
                {day}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Right Panel — driven by real conversation state ──────────────────────────

type PanelPhase = 'splash' | 'onboarding' | 'auth' | 'chat' | 'intake' | 'safety' | 'verdict';

interface RightPanelProps {
  phase: PanelPhase;
  intakeFeatures: IntakeFeatures | null;
  safetyResult: SafetyEvaluationResponse | null;
  patientId: string | null;
  onNavigate: (path: string) => void;
}

// Map conversation phase + safety result to journey step index (0–3)
function journeyStep(phase: PanelPhase, safetyResult: SafetyEvaluationResponse | null): number {
  if (phase === 'intake') return 0;
  if (phase === 'safety') return 1;
  if (phase === 'verdict') {
    const hasAppt = appointmentStore.list().some(a => a.status === 'BOOKED' || a.status === 'RESCHEDULED');
    return hasAppt ? 3 : 2;
  }
  return 0;
}

function RightPanel({ phase, intakeFeatures, safetyResult, patientId, onNavigate }: RightPanelProps) {
  const [appts, setAppts] = React.useState<StoredAppointment[]>(() =>
    appointmentStore.list(patientId ?? undefined)
  );

  // Subscribe to appointment store changes
  React.useEffect(() => {
    const refresh = () => setAppts(appointmentStore.list(patientId ?? undefined));
    refresh();
    return appointmentStore.subscribe(refresh);
  }, [patientId]);

  const step = journeyStep(phase, safetyResult);
  const progressPct = [0, 33, 66, 100][step] ?? 0;

  // Real appointment days for calendar highlight
  const apptDays = appts
    .filter(a => a.status === 'BOOKED' || a.status === 'RESCHEDULED')
    .map(a => {
      const d = a.slot?.start_time ? new Date(a.slot.start_time)
        : a.date ? new Date(a.date) : null;
      return d ? d.getDate() : null;
    })
    .filter((d): d is number => d !== null);

  // Upcoming booked appointment
  const nextAppt = appts.find(a => a.status === 'BOOKED' || a.status === 'RESCHEDULED') ?? null;

  // Banner: attention if in early phases, success if appointment booked, assessment info otherwise
  const isEmergency = safetyResult?.result === 'YES';
  const isAvoidable = safetyResult?.pathway?.decision === 'POTENTIALLY_AVOIDABLE';
  const complaint = intakeFeatures?.chief_complaint;

  const bannerIcon  = isEmergency ? '🚨' : nextAppt ? '✅' : complaint ? '🩺' : '🔔';
  const bannerTitle = isEmergency ? 'Emergency Detected'
    : nextAppt ? 'Appointment Booked'
    : complaint ? `Assessing: ${complaint}`
    : phase === 'intake' || phase === 'chat' || phase === 'splash' || phase === 'onboarding' || phase === 'auth'
      ? 'Attention Required'
      : 'Assessment in Progress';
  const bannerSub = isEmergency ? 'Please go to the nearest ER now.'
    : nextAppt ? `${nextAppt.provider_name ?? 'Your provider'} confirmed.`
    : complaint ? `Pain scale: ${intakeFeatures?.pain_scale ?? '—'}/10`
    : 'Complete your symptom assessment';
  const bannerClass = isEmergency
    ? 'crp-emergency crp-emergency--alert'
    : nextAppt ? 'crp-emergency crp-emergency--success'
    : 'crp-emergency';

  // Journey node labels and states
  const JOURNEY = ['Assessment', 'Review', 'Appt', 'Follow-up'];

  return (
    <>
      {/* ── Status banner ── */}
      <div className={bannerClass}>
        <span className="crp-emergency__icon">{bannerIcon}</span>
        <div className="crp-emergency__text">
          <strong>{bannerTitle}</strong>
          <span>{bannerSub}</span>
        </div>
      </div>

      {/* ── Real calendar — appointment days highlighted ── */}
      <section className="crp-section crp-section--compact">
        <RealCalendar appointmentDays={apptDays} />
      </section>

      {/* ── Care Journey — driven by conversation phase ── */}
      <section className="crp-section crp-section--compact crp-section--journey">
        <h3 className="crp-section__title">Care Journey</h3>
        <div className="crp-journey-track">
          <div className="crp-journey-track__line">
            <div className="crp-journey-track__fill" style={{ width: `${progressPct}%` }} />
          </div>
          {JOURNEY.map((label, i) => (
            <div
              key={label}
              className={`crp-jnode${i < step ? ' crp-jnode--done' : i === step ? ' crp-jnode--active' : ''}`}
              title={label}
            >
              {i < step
                ? <span>✓</span>
                : i === step
                  ? <span className="crp-jnode__pulse" />
                  : null}
            </div>
          ))}
        </div>
        <div className="crp-journey-labels">
          {JOURNEY.map((label, i) => (
            <span
              key={label}
              className={`crp-jlabel${i < step ? ' crp-jlabel--done' : i === step ? ' crp-jlabel--active' : ''}`}
            >{label}</span>
          ))}
        </div>
      </section>

      {/* ── Appointment — real data from store ── */}
      <section className="crp-section crp-section--compact">
        <div className="crp-section__header">
          <h3 className="crp-section__title">Appointment</h3>
          <button className="crp-view-all" onClick={() => onNavigate('/appointments')}>View →</button>
        </div>
        {nextAppt ? (
          <div className="crp-appointment">
            <div className="crp-appointment__date">
              <span className="crp-appointment__month">
                {nextAppt.slot?.start_time
                  ? new Date(nextAppt.slot.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                  : nextAppt.date ? new Date(nextAppt.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                  : 'TBD'}
              </span>
              <span className="crp-appointment__day">
                {nextAppt.slot?.start_time
                  ? new Date(nextAppt.slot.start_time).getDate()
                  : nextAppt.date ? new Date(nextAppt.date).getDate()
                  : '—'}
              </span>
            </div>
            <div className="crp-appointment__info">
              <strong>{nextAppt.provider_name ?? 'Your Provider'}</strong>
              <span>
                {[nextAppt.specialty ?? nextAppt.care_type,
                  nextAppt.slot?.start_time
                    ? new Date(nextAppt.slot.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : nextAppt.time]
                  .filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
        ) : (
          <p className="crp-no-appt">
            {isAvoidable
              ? 'Complete booking to schedule your appointment.'
              : 'No upcoming appointments.'}
          </p>
        )}
      </section>

      {/* ── Today / symptom summary ── */}
      <section className="crp-section crp-section--compact">
        <h3 className="crp-section__title">Today</h3>
        {complaint ? (
          <div className="crp-plan-items">
            <div className="crp-plan-item crp-plan-item--active">
              <span className="crp-plan-dot crp-plan-dot--active" />
              <span>{complaint}</span>
              <span className="crp-plan-meta">
                {intakeFeatures?.pain_scale != null ? `${intakeFeatures.pain_scale}/10` : ''}
              </span>
            </div>
            {intakeFeatures?.symptom_onset && (
              <div className="crp-plan-item">
                <span className="crp-plan-dot" />
                <span>Onset: {intakeFeatures.symptom_onset}</span>
              </div>
            )}
            {intakeFeatures?.location && (
              <div className="crp-plan-item">
                <span className="crp-plan-dot" />
                <span>Location: {intakeFeatures.location}</span>
              </div>
            )}
            {safetyResult?.result === 'NO' && (
              <div className="crp-plan-item crp-plan-item--done">
                <span className="crp-plan-dot crp-plan-dot--done" />
                <span>Safety screening</span>
                <span className="crp-plan-meta">✓</span>
              </div>
            )}
          </div>
        ) : (
          <div className="crp-plan-items">
            <div className="crp-plan-item">
              <span className="crp-plan-dot" />
              <span>Start a symptom assessment</span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'linear-gradient(145deg, #fef3ed 0%, #fce4d6 50%, #f8d0c4 100%)',
  },
  drawerOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 200,
    display: 'flex',
    backdropFilter: 'blur(3px)',
  },
  drawer: {
    width: '300px',
    maxWidth: '85vw',
    boxShadow: '4px 0 32px rgba(0,0,0,0.12)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    background: '#fffaf7',
    borderRadius: '28px',
    margin: '12px 12px 12px 0',
    boxShadow: '0 4px 32px rgba(242,132,107,0.08), 0 0 0 1px rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    borderBottom: '1px solid rgba(242,132,107,0.08)',
    backgroundColor: '#fffaf7',
    flexShrink: 0,
    minHeight: '64px',
  },
  topBarIdentity: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  topBarAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  topBarOnlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: '#4caf50',
    border: '2px solid #fffaf7',
  },
  topBarName: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#2d2d2d',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  topBarSub: {
    fontSize: '0.75rem',
    color: '#a8a8a8',
    marginTop: 1,
  },
  topBarActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'rgba(242,132,107,0.08)',
    borderBottom: '1px solid rgba(242,132,107,0.15)',
    fontSize: '0.875rem',
    color: '#e06a4f',
    flexShrink: 0,
  },
  errorClose: {
    marginLeft: 'auto',
    background: 'transparent',
    border: 'none',
    color: '#e06a4f',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0 4px',
    fontFamily: 'inherit',
  },
  chatBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
  },
  messages: {
    width: '100%',
    padding: '24px 32px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
};
