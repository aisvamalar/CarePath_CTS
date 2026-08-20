import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MessageBubble, { TypingIndicator } from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import SafetyChecklist from '../components/SafetyChecklist';
import VerdictCard from '../components/VerdictCard';
import Logo from '../components/Logo';
import { useApp } from '../context/AppContext';
import { intakeAPI, safetyAPI, pathwayAPI } from '../services/api';
import type { RedFlagsPayload } from '../services/api';

let robotImg: string;
try { robotImg = new URL('../assets/robot.png', import.meta.url).href; }
catch { robotImg = new URL('../assets/hero.png', import.meta.url).href; }

const SUGGESTION_CARDS = [
  { text: 'Check my symptoms', icon: '🩺' },
  { text: 'Ask a health question', icon: '💬' },
  { text: 'My medications', icon: '💊' },
  { text: 'Prepare for an appointment', icon: '📅' },
];

export default function Chat() {
  const { state, dispatch, activeConversation, generateId } = useApp();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [pathwayLoading, setPathwayLoading] = useState(false);
  const [pathwayResult, setPathwayResult] = useState<Record<string, unknown> | null>(null);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);

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
      intakeFeatures: null,
      redFlags: null,
      safetyResult: null,
      phase: 'intake' as const,
      createdAt: new Date(),
    };

    dispatch({ type: 'NEW_CONVERSATION', payload: newConv });
    setPathwayResult(null);

    try {
      const session = await intakeAPI.createSession(state.patient.patient_id);
      dispatch({ type: 'SET_SESSION_ID', payload: { conversationId: convId, sessionId: session.session_id } });

      const firstQ = session.next_question ?? 'Hello! I\'m your CarePath triage assistant. What is your main symptom today?';
      addMessage(convId, 'assistant', `Hello! I'm your CarePath triage assistant.\n\n${firstQ}`);
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
      const { id: convId, sessionId } = activeConversation;

      if (!sessionId) {
        setError('Session not started. Please start a new chat.');
        return;
      }

      setError('');
      addMessage(convId, 'user', content);
      setLoading(true);

      // Update conversation title from first user message
      if (activeConversation.messages.filter((m) => m.role === 'user').length === 0) {
        const titleWords = content.split(' ').slice(0, 5).join(' ');
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            conversationId: convId,
            message: { id: 'TITLE_HACK', role: 'user', content: 'TITLE_HACK', timestamp: new Date() },
          },
        });
        // Patch title via a small hack — we'll update the conversation title
        const updatedConv = state.conversations.find((c) => c.id === convId);
        if (updatedConv) {
          updatedConv.title = titleWords.length > 3 ? titleWords : content.slice(0, 30);
        }
      }

      try {
        const res = await intakeAPI.sendMessage(sessionId, content);

        if (res.status === 'ERROR') {
          addMessage(convId, 'assistant', res.error_detail ?? 'Something went wrong. Please try again.');
          return;
        }

        if (res.extracted) {
          dispatch({ type: 'SET_INTAKE_FEATURES', payload: { conversationId: convId, features: res.extracted } });
          // Update title from chief complaint
          if (res.extracted.chief_complaint) {
            const updatedConv = state.conversations.find((c) => c.id === convId);
            if (updatedConv) updatedConv.title = res.extracted.chief_complaint;
          }
        }

        if (res.status === 'COMPLETE') {
          addMessage(
            convId,
            'assistant',
            'Thank you — I have all the information I need.\n\nNow I need to ask you a few quick YES/NO questions about severe symptoms. Please answer honestly — this helps determine if you need immediate emergency care.',
          );
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
    [activeConversation, loading, addMessage, dispatch, state.conversations],
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
        const evalResult = await safetyAPI.evaluate(sessionId);
        dispatch({ type: 'SET_SAFETY_RESULT', payload: { conversationId: convId, result: evalResult } });
        dispatch({ type: 'SET_CONVERSATION_PHASE', payload: { conversationId: convId, phase: 'verdict' } });

        // If no emergency, trigger pathway
        if (evalResult.result === 'NO' && state.patient?.patient_id) {
          setPathwayLoading(true);
          try {
            const pathway = await pathwayAPI.triggerPathway(state.patient.patient_id);
            setPathwayResult(pathway as Record<string, unknown>);
          } catch {
            // Pathway errors are non-critical
          } finally {
            setPathwayLoading(false);
          }
        }
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

    // Empty state — no active conversation
    if (!activeConversation) {
      return <EmptyState onSuggestion={handleSuggestion} onNewChat={handleNewChat} />;
    }

    // Verdict phase
    if (phase === 'verdict' && activeConversation.safetyResult) {
      return (
        <div style={styles.scrollArea}>
          <VerdictCard
            result={activeConversation.safetyResult}
            intakeFeatures={activeConversation.intakeFeatures}
            redFlags={activeConversation.redFlags ?? null}
            onNewChat={handleNewChat}
            pathwayLoading={pathwayLoading}
            pathwayResult={pathwayResult}
          />
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
          <SafetyChecklist onSubmit={handleSafetySubmit} loading={safetyLoading} />
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
    try {
      const res = await intakeAPI.sendMessage(sessionId, content);
      if (res.status === 'COMPLETE') {
        addMessage(convId, 'assistant', 'Thank you — I have all the information I need.\n\nNow I need to ask you a few YES/NO questions about severe symptoms.');
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
        {/* Top bar — matches reference: avatar + title + action icons */}
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

          {/* Assistant identity block */}
          <div style={styles.topBarIdentity}>
            <div style={styles.topBarAvatarWrap} aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 56 56" fill="none">
                <rect width="56" height="56" rx="14" fill="#f2846b"/>
                <path d="M28 11C28 11 16.5 18 16.5 27C16.5 34.5 22 40 28 42.5C34 40 39.5 34.5 39.5 27C39.5 18 28 11 28 11Z"
                  fill="white" fillOpacity="0.92"/>
                <path d="M22 27.5L26.5 32L34 22.5" stroke="#f2846b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={styles.topBarOnlineDot} aria-hidden="true" />
            </div>
            <div>
              <div style={styles.topBarName}>
                {activeConversation ? activeConversation.title : 'CarePath Assistant'}
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
    </div>
  );
}

// ── Empty state — matches reference design ──
function EmptyState({
  onSuggestion,
  onNewChat,
}: {
  onSuggestion: (text: string) => void;
  onNewChat: () => void;
}) {
  return (
    <div className="ce-root">
      {/* Robot + floating health icons */}
      <div className="ce-visual">
        <img src={robotImg} alt="CarePath AI" className="ce-robot" />
        {/* Floating icons around robot */}
        <span className="ce-float-icon ce-float-icon--1">❤️</span>
        <span className="ce-float-icon ce-float-icon--2">💊</span>
        <span className="ce-float-icon ce-float-icon--3">📋</span>
        <span className="ce-float-icon ce-float-icon--4">💬</span>
      </div>

      {/* Title */}
      <h2 className="ce-title">CarePath <em>Assistant</em></h2>
      <p className="ce-sub">I'm here to understand your health<br/>and guide you with the right care.</p>

      {/* Quick start section */}
      <p className="ce-quick-label">Quick start</p>
      <div className="ce-cards">
        {SUGGESTION_CARDS.map(s => (
          <button key={s.text} className="ce-card" onClick={() => onSuggestion(s.text)}>
            <span className="ce-card__icon">{s.icon}</span>
            <span className="ce-card__text">{s.text}</span>
            <span className="ce-card__arrow">›</span>
          </button>
        ))}
      </div>

      {/* Start button */}
      <button className="ce-start-btn" onClick={onNewChat}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Start New Assessment
      </button>

      <p className="ce-secure">🔒 Your information is secure and confidential.</p>
    </div>
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
    maxWidth: '720px',
    margin: '0 auto',
    padding: '24px 20px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
};
