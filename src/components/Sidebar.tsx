import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { chatAPI } from '../services/api';
import { appointmentStore } from '../services/appointmentStore';
import type { Conversation } from '../context/AppContext';
import Logo from './Logo';

interface SidebarProps {
  onNewChat: () => void;
  onClose?: () => void;
}

export default function Sidebar({ onNewChat, onClose }: SidebarProps) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = () => { dispatch({ type: 'LOGOUT' }); navigate('/login'); };

  // ── Live count of active appointments for the sidebar badge ──
  const patientId = state.patient?.patient_id;
  const [apptCount, setApptCount] = useState(() => appointmentStore.activeCount(patientId));
  useEffect(() => {
    const refresh = () => setApptCount(appointmentStore.activeCount(patientId));
    refresh();
    return appointmentStore.subscribe(refresh);
  }, [patientId]);

  // ── Load chats from backend on mount ──
  useEffect(() => {
    if (state.token && !state.chatsLoaded) {
      loadChatsFromBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.token, state.chatsLoaded]);

  const loadChatsFromBackend = useCallback(async () => {
    try {
      const res = await chatAPI.list({ limit: 50 });
      const conversations: Conversation[] = res.chats.map((chat) => ({
        id: chat.session_id,
        title: chat.title,
        messages: [],
        sessionId: null,
        chatSessionId: chat.session_id,
        isPinned: chat.is_pinned,
        intakeFeatures: null,
        redFlags: null,
        safetyResult: null,
        phase: 'chat' as const,
        createdAt: new Date(chat.created_at),
      }));
      dispatch({ type: 'LOAD_CONVERSATIONS', payload: conversations });
    } catch (err) {
      console.error('[Sidebar] Failed to load chats from backend:', err);
      dispatch({ type: 'SET_CHATS_LOADED', payload: true });
    }
  }, [dispatch]);

  // ── Search with debounce ──
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!search.trim()) {
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await chatAPI.search(search.trim(), { limit: 20 });
        // Map search results into sidebar display — results contain session_id, title, etc.
        const results: Conversation[] = (res.results ?? []).map((r: Record<string, unknown>) => ({
          id: (r.session_id as string) ?? (r.id as string),
          title: (r.title as string) ?? 'Untitled',
          messages: [],
          sessionId: null,
          chatSessionId: (r.session_id as string) ?? null,
          isPinned: (r.is_pinned as boolean) ?? false,
          intakeFeatures: null,
          redFlags: null,
          safetyResult: null,
          phase: 'chat' as const,
          createdAt: new Date((r.created_at as string) ?? Date.now()),
        }));
        // Temporarily show search results without overwriting conversations
        dispatch({ type: 'LOAD_CONVERSATIONS', payload: results });
      } catch {
        // Fall back to local filter on search failure
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, dispatch]);

  // ── Reload full list when search is cleared ──
  useEffect(() => {
    if (!search.trim() && state.chatsLoaded) {
      loadChatsFromBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Context menu actions ──
  const handlePin = async (convId: string) => {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv?.chatSessionId) return;
    const newPinned = !conv.isPinned;
    try {
      await chatAPI.pin(conv.chatSessionId, newPinned);
      dispatch({ type: 'PIN_CONVERSATION', payload: { conversationId: convId, isPinned: newPinned } });
    } catch (err) {
      console.error('[Sidebar] Pin failed:', err);
    }
    setContextMenu(null);
  };

  const handleDelete = async (convId: string) => {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv?.chatSessionId) return;
    try {
      await chatAPI.delete(conv.chatSessionId);
      dispatch({ type: 'DELETE_CONVERSATION', payload: convId });
    } catch (err) {
      console.error('[Sidebar] Delete failed:', err);
    }
    setContextMenu(null);
  };

  const handleRenameStart = (convId: string) => {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv) return;
    setRenamingId(convId);
    setRenameValue(conv.title);
    setContextMenu(null);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleRenameConfirm = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    const conv = state.conversations.find(c => c.id === renamingId);
    if (!conv?.chatSessionId) { setRenamingId(null); return; }
    try {
      await chatAPI.updateTitle(conv.chatSessionId, renameValue.trim());
      dispatch({ type: 'RENAME_CONVERSATION', payload: { conversationId: renamingId, title: renameValue.trim() } });
    } catch (err) {
      console.error('[Sidebar] Rename failed:', err);
    }
    setRenamingId(null);
  };

  // ── Load messages when selecting a past conversation ──
  const handleSelectConversation = async (conv: Conversation) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conv.id });
    dispatch({ type: 'SET_CONVERSATION_PHASE', payload: { conversationId: conv.id, phase: conv.phase } });

    // If conversation has no messages loaded and has a backend session, fetch them
    if (conv.messages.length === 0 && conv.chatSessionId) {
      try {
        const res = await chatAPI.getMessages(conv.chatSessionId, { limit: 100, order: 'asc' });
        const messages = (res.messages ?? []).map((m: Record<string, unknown>) => ({
          id: (m.message_id as string) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: (m.role as 'user' | 'assistant') ?? 'assistant',
          content: (m.content as string) ?? '',
          timestamp: new Date((m.created_at as string) ?? Date.now()),
        }));
        // Add each message to the conversation
        messages.forEach((msg: { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }) => {
          dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: conv.id, message: msg } });
        });
      } catch (err) {
        console.error('[Sidebar] Failed to load messages:', err);
      }
    }
    onClose?.();
  };

  // ── Close context menu on outside click ──
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  // ── Group conversations ──
  const now = new Date();
  const pinned = state.conversations.filter(c => c.isPinned);
  const unpinned = state.conversations.filter(c => !c.isPinned);

  const groups = unpinned.reduce<Record<string, Conversation[]>>((acc, c) => {
    const diff = Math.floor((now.getTime() - c.createdAt.getTime()) / 86400000);
    const key = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff <= 7 ? 'This Week' : 'Older';
    acc[key] = [...(acc[key] ?? []), c];
    return acc;
  }, {});

  const displayName = state.patient?.name ?? state.patient?.username ?? 'Patient';
  const initial = displayName.trim()[0]?.toUpperCase() ?? 'P';

  const renderChatItem = (c: Conversation) => (
    <div key={c.id} className="sb-chat-item-wrap" style={{ position: 'relative' }}>
      {renamingId === c.id ? (
        <div className="sb-chat-item sb-chat-item--renaming">
          <input
            ref={renameInputRef}
            className="sb-rename-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
          />
        </div>
      ) : (
        <button
          className={`sb-chat-item${state.activeConversationId === c.id ? ' sb-chat-item--active' : ''}${c.isPinned ? ' sb-chat-item--pinned' : ''}`}
          onClick={() => handleSelectConversation(c)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }); }}
          title={c.title}
        >
          {c.isPinned && <span className="sb-pin-icon" aria-label="Pinned">📌</span>}
          <span className="sb-chat-item__title">{c.title}</span>
          <span className="sb-chat-item__date">
            {c.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            className="sb-chat-item__menu-btn"
            onClick={(e) => { e.stopPropagation(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }); }}
            aria-label="Chat options"
          >
            ⋯
          </button>
        </button>
      )}
    </div>
  );

  return (
    <aside className="sb-sidebar" aria-label="Sidebar">
      {/* Logo */}
      <div className="sb-logo-area">
        <Logo size={28} textSize="1rem" />
      </div>

      {/* New Chat */}
      <button className="sb-menu-btn" onClick={() => { onNewChat(); onClose?.(); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13 2H3a1 1 0 00-1 1v9l3-2h8a1 1 0 001-1V3a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M6 6.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        New Chat
      </button>

      {/* Search input */}
      <div className="sb-search-bar">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          placeholder="Search chats..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sb-search-bar__input"
        />
        {searchLoading && <span className="sb-search-spinner" />}
      </div>

      <div className="sb-divider" />

      {/* Appointments */}
      <button className="sb-menu-btn" onClick={() => { navigate('/appointments'); onClose?.(); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 1.5V4M11 1.5V4M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Appointments
        {apptCount > 0 && (
          <span className="sb-badge sb-badge--warn">{apptCount} Upcoming</span>
        )}
      </button>

      {/* Care Plans */}
      <button className="sb-menu-btn" onClick={() => { navigate('/care-plans'); onClose?.(); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Care Plans
        <span className="sb-badge sb-badge--success">2 Tasks</span>
      </button>

      <div className="sb-divider" />

      {/* Pinned Chats */}
      {pinned.length > 0 && (
        <>
          <p className="sb-section-label">PINNED</p>
          <nav className="sb-chat-list" aria-label="Pinned conversations">
            {pinned.map(renderChatItem)}
          </nav>
          <div className="sb-divider" />
        </>
      )}

      {/* Recent Chats */}
      <p className="sb-section-label">RECENT CHATS</p>
      <nav className="sb-chat-list" aria-label="Recent conversations">
        {state.conversations.length === 0 ? (
          <p className="sb-empty">No conversations yet.</p>
        ) : unpinned.length === 0 && pinned.length > 0 ? (
          <p className="sb-empty">All chats are pinned.</p>
        ) : (
          Object.entries(groups).map(([groupLabel, convs]) => (
            <div key={groupLabel}>
              <p className="sb-group-label">{groupLabel}</p>
              {convs.map(renderChatItem)}
            </div>
          ))
        )}
      </nav>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="sb-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed', zIndex: 999 }}
          onClick={e => e.stopPropagation()}
        >
          <button className="sb-context-menu__item" onClick={() => handlePin(contextMenu.id)}>
            {state.conversations.find(c => c.id === contextMenu.id)?.isPinned ? '📌 Unpin' : '📌 Pin'}
          </button>
          <button className="sb-context-menu__item" onClick={() => handleRenameStart(contextMenu.id)}>
            ✏️ Rename
          </button>
          <button className="sb-context-menu__item sb-context-menu__item--danger" onClick={() => handleDelete(contextMenu.id)}>
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Bottom: Settings + Logout + Profile */}
      <div className="sb-bottom">
        <button className="sb-bottom-btn" onClick={() => navigate('/settings')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="sb-bottom-btn sb-bottom-btn--logout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Profile */}
      <button className="sb-profile-btn" onClick={() => navigate('/profile')}>
        <div className="sb-profile-btn__avatar">{initial}</div>
        <span className="sb-profile-btn__name">{displayName}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', opacity: 0.4 }}>
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </aside>
  );
}
