import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
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

  const handleLogout = () => { dispatch({ type: 'LOGOUT' }); navigate('/login'); };

  const now = new Date();
  const filtered = state.conversations.filter(c =>
    search ? c.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  const groups = filtered.reduce<Record<string, Conversation[]>>((acc, c) => {
    const diff = Math.floor((now.getTime() - c.createdAt.getTime()) / 86400000);
    const key = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff <= 7 ? 'This Week' : 'Older';
    acc[key] = [...(acc[key] ?? []), c];
    return acc;
  }, {});

  const displayName = state.patient?.name ?? state.patient?.username ?? 'Patient';
  const initial = displayName.trim()[0]?.toUpperCase() ?? 'P';

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
      </div>

      <div className="sb-divider" />

      {/* Appointments */}
      <button className="sb-menu-btn" onClick={() => { navigate('/appointments'); onClose?.(); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 1.5V4M11 1.5V4M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Appointments
        <span className="sb-badge sb-badge--warn">1 Pending</span>
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

      {/* Recent Chats */}
      <p className="sb-section-label">RECENT CHATS</p>
      <nav className="sb-chat-list" aria-label="Recent conversations">
        {state.conversations.length === 0 ? (
          <p className="sb-empty">No conversations yet.</p>
        ) : (
          Object.values(groups).flat().map(c => (
            <button
              key={c.id}
              className={`sb-chat-item${state.activeConversationId === c.id ? ' sb-chat-item--active' : ''}`}
              onClick={() => {
                dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: c.id });
                dispatch({ type: 'SET_CONVERSATION_PHASE', payload: { conversationId: c.id, phase: c.phase } });
                onClose?.();
              }}
              title={c.title}
            >
              <span className="sb-chat-item__title">{c.title}</span>
              <span className="sb-chat-item__date">
                {c.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {c.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))
        )}
      </nav>

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
