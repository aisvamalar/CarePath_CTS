import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

interface ProfileMenuProps {
  onClose: () => void;
}

export default function ProfileMenu({ onClose }: ProfileMenuProps) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const patient = state.patient;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    onClose();
    navigate('/login');
  };

  const initials = (patient?.name ?? patient?.username ?? 'P')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={menuRef}
      style={styles.menu}
      role="menu"
      aria-label="Profile menu"
      className="fade-in-scale"
    >
      {/* Patient info header */}
      <div style={styles.header}>
        <div style={styles.avatar} aria-hidden="true">{initials}</div>
        <div style={styles.info}>
          <span style={styles.name}>
            {patient?.name ?? patient?.username ?? 'Patient'}
          </span>
          {patient?.mrn && (
            <span style={styles.mrn}>MRN: {patient.mrn}</span>
          )}
        </div>
      </div>

      <div style={styles.divider} />

      {/* Menu items */}
      <button
        style={styles.menuItem}
        role="menuitem"
        onClick={() => { onClose(); navigate('/settings'); }}
        aria-label="Go to settings"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Settings
      </button>

      <div style={styles.divider} />

      <button
        style={{ ...styles.menuItem, color: '#d92d20' }}
        role="menuitem"
        onClick={handleLogout}
        aria-label="Log out"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Log Out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'absolute',
    bottom: '64px',
    right: '16px',
    width: '240px',
    backgroundColor: '#ffffff',
    border: '1px solid #e3e8ea',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(18,97,126,0.12)',
    overflow: 'hidden',
    zIndex: 100,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#12617e',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  name: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#172b35',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mrn: {
    fontSize: '0.8125rem',
    color: '#6b7c84',
  },
  divider: {
    height: '1px',
    backgroundColor: '#e3e8ea',
    margin: '0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    color: '#172b35',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
    fontFamily: 'inherit',
  },
};
