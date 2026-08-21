/**
 * CarePath — Global Application Context
 * Manages auth state, patient info, conversation, and triage phase.
 * Integrates with backend Chat History API for persistence.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type {
  PatientInfo,
  IntakeFeatures,
  RedFlagsPayload,
  SafetyEvaluationResponse,
} from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppPhase =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'chat'
  | 'intake'
  | 'safety'
  | 'verdict';

export type Theme = 'light' | 'dark' | 'system';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  sessionId: string | null;
  /** Backend chat history session ID (CHAT_xxxx) for persistence */
  chatSessionId: string | null;
  isPinned: boolean;
  intakeFeatures: IntakeFeatures | null;
  redFlags: Partial<RedFlagsPayload> | null;
  safetyResult: SafetyEvaluationResponse | null;
  phase: AppPhase;
  createdAt: Date;
}

export interface AppState {
  phase: AppPhase;
  token: string | null;
  patient: PatientInfo | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  theme: Theme;
  sidebarOpen: boolean;
  /** Whether initial chat list has been loaded from backend */
  chatsLoaded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_PHASE'; payload: AppPhase }
  | { type: 'LOGIN'; payload: { token: string; patient: PatientInfo } }
  | { type: 'LOGOUT' }
  | { type: 'SET_PATIENT'; payload: PatientInfo }
  | { type: 'NEW_CONVERSATION'; payload: Conversation }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'SET_SESSION_ID'; payload: { conversationId: string; sessionId: string } }
  | { type: 'SET_CHAT_SESSION_ID'; payload: { conversationId: string; chatSessionId: string } }
  | { type: 'SET_INTAKE_FEATURES'; payload: { conversationId: string; features: IntakeFeatures } }
  | { type: 'SET_CONVERSATION_PHASE'; payload: { conversationId: string; phase: AppPhase } }
  | { type: 'SET_RED_FLAGS'; payload: { conversationId: string; redFlags: Partial<RedFlagsPayload> } }
  | { type: 'SET_SAFETY_RESULT'; payload: { conversationId: string; result: SafetyEvaluationResponse } }
  | { type: 'LOAD_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'PIN_CONVERSATION'; payload: { conversationId: string; isPinned: boolean } }
  | { type: 'RENAME_CONVERSATION'; payload: { conversationId: string; title: string } }
  | { type: 'SET_CHATS_LOADED'; payload: boolean }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

const initialState: AppState = {
  phase: localStorage.getItem('cp_token') ? 'chat' : 'splash',
  token: localStorage.getItem('cp_token'),
  patient: null,
  conversations: [],
  activeConversationId: null,
  theme: (localStorage.getItem('cp_theme') as Theme) ?? 'light',
  sidebarOpen: true,
  chatsLoaded: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.payload };

    case 'LOGIN':
      localStorage.setItem('cp_token', action.payload.token);
      return {
        ...state,
        token: action.payload.token,
        patient: action.payload.patient,
        phase: 'chat',
      };

    case 'LOGOUT':
      localStorage.removeItem('cp_token');
      return {
        ...initialState,
        token: null,
        patient: null,
        conversations: [],
        activeConversationId: null,
        phase: 'auth',
        theme: state.theme,
        sidebarOpen: true,
        chatsLoaded: false,
      };

    case 'SET_PATIENT':
      return { ...state, patient: action.payload };

    case 'NEW_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        activeConversationId: action.payload.id,
        phase: 'intake',
      };

    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversationId: action.payload };

    case 'ADD_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, messages: [...c.messages, action.payload.message] }
            : c,
        ),
      };

    case 'SET_SESSION_ID':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, sessionId: action.payload.sessionId }
            : c,
        ),
      };

    case 'SET_CHAT_SESSION_ID':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, chatSessionId: action.payload.chatSessionId }
            : c,
        ),
      };

    case 'SET_INTAKE_FEATURES':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, intakeFeatures: action.payload.features }
            : c,
        ),
      };

    case 'SET_CONVERSATION_PHASE':
      return {
        ...state,
        phase: action.payload.phase,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, phase: action.payload.phase }
            : c,
        ),
      };

    case 'SET_RED_FLAGS':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, redFlags: action.payload.redFlags }
            : c,
        ),
      };

    case 'SET_SAFETY_RESULT':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, safetyResult: action.payload.result }
            : c,
        ),
      };

    case 'LOAD_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload,
        chatsLoaded: true,
      };

    case 'DELETE_CONVERSATION': {
      const remaining = state.conversations.filter((c) => c.id !== action.payload);
      return {
        ...state,
        conversations: remaining,
        activeConversationId:
          state.activeConversationId === action.payload
            ? (remaining[0]?.id ?? null)
            : state.activeConversationId,
      };
    }

    case 'PIN_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, isPinned: action.payload.isPinned }
            : c,
        ),
      };

    case 'RENAME_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.conversationId
            ? { ...c, title: action.payload.title }
            : c,
        ),
      };

    case 'SET_CHATS_LOADED':
      return { ...state, chatsLoaded: action.payload };

    case 'SET_THEME':
      localStorage.setItem('cp_theme', action.payload);
      return { ...state, theme: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  activeConversation: Conversation | null;
  generateId: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const activeConversation =
    state.conversations.find((c) => c.id === state.activeConversationId) ?? null;

  const generateId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  return (
    <AppContext.Provider value={{ state, dispatch, activeConversation, generateId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
