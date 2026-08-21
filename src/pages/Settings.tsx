import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useApp } from '../context/AppContext';
import type { Theme } from '../context/AppContext';

export default function Settings() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const themes: Array<{ value: Theme; label: string; desc: string }> = [
    { value: 'light', label: 'Light', desc: 'Clean white interface' },
    { value: 'dark', label: 'Dark', desc: 'Reduced brightness' },
    { value: 'system', label: 'System', desc: 'Follows your OS setting' },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button
          className="btn-ghost"
          style={styles.backBtn}
          onClick={() => navigate('/chat')}
          aria-label="Back to chat"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <Logo size={28} textSize="1.125rem" />
      </div>

      <div style={styles.content}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your CarePath preferences</p>

        {/* Appearance */}
        <section style={styles.section} aria-labelledby="appearance-heading">
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3" stroke="#12617E" strokeWidth="1.5"/>
                <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.22 4.22l1.42 1.42M12.36 12.36l1.42 1.42M4.22 13.78l1.42-1.42M12.36 5.64l1.42-1.42"
                  stroke="#12617E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 id="appearance-heading" style={styles.sectionTitle}>Appearance</h2>
              <p style={styles.sectionDesc}>Choose your preferred color scheme</p>
            </div>
          </div>

          <div style={styles.themeOptions} role="radiogroup" aria-labelledby="appearance-heading">
            {themes.map((t) => (
              <label
                key={t.value}
                style={{
                  ...styles.themeOption,
                  ...(state.theme === t.value ? styles.themeOptionActive : {}),
                }}
              >
                <input
                  type="radio"
                  name="theme"
                  value={t.value}
                  checked={state.theme === t.value}
                  onChange={() => dispatch({ type: 'SET_THEME', payload: t.value })}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                <div style={styles.themePreview(t.value)} aria-hidden="true" />
                <div style={styles.themeText}>
                  <span style={styles.themeLabel}>{t.label}</span>
                  <span style={styles.themeDesc}>{t.desc}</span>
                </div>
                {state.theme === t.value && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="7" fill="#12617E"/>
                    <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </label>
            ))}
          </div>
        </section>

        {/* Account */}
        <section style={styles.section} aria-labelledby="account-heading">
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="6" r="3" stroke="#12617E" strokeWidth="1.5"/>
                <path d="M3 15c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#12617E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 id="account-heading" style={styles.sectionTitle}>Account</h2>
              <p style={styles.sectionDesc}>Your patient information</p>
            </div>
          </div>

          {state.patient ? (
            <div style={styles.accountInfo}>
              <div style={styles.accountRow}>
                <span style={styles.accountLabel}>Username</span>
                <span style={styles.accountValue}>{state.patient.username ?? '—'}</span>
              </div>
              {state.patient.mrn && (
                <div style={styles.accountRow}>
                  <span style={styles.accountLabel}>MRN</span>
                  <span style={styles.accountValue}>{state.patient.mrn}</span>
                </div>
              )}
              {state.patient.patient_id && (
                <div style={styles.accountRow}>
                  <span style={styles.accountLabel}>Patient ID</span>
                  <span style={styles.accountValue}>{state.patient.patient_id}</span>
                </div>
              )}
            </div>
          ) : (
            <p style={styles.noInfo}>No account information available.</p>
          )}
        </section>

        {/* About */}
        <section style={styles.section} aria-labelledby="about-heading">
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#12617E" strokeWidth="1.5"/>
                <path d="M9 8v5M9 6h.01" stroke="#12617E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 id="about-heading" style={styles.sectionTitle}>About CarePath</h2>
              <p style={styles.sectionDesc}>Application information</p>
            </div>
          </div>
          <div style={styles.accountInfo}>
            <div style={styles.accountRow}>
              <span style={styles.accountLabel}>Version</span>
              <span style={styles.accountValue}>1.0.0</span>
            </div>
            <div style={styles.accountRow}>
              <span style={styles.accountLabel}>Platform</span>
              <span style={styles.accountValue}>Web Application</span>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section style={{ ...styles.section, borderColor: '#fecaca' }} aria-labelledby="danger-heading">
          <h2 id="danger-heading" style={{ ...styles.sectionTitle, color: '#d92d20', marginBottom: '12px' }}>
            Account Actions
          </h2>
          <button
            className="btn-secondary"
            style={{ borderColor: '#fecaca', color: '#d92d20', width: '100%' }}
            onClick={() => {
              dispatch({ type: 'LOGOUT' });
              navigate('/login');
            }}
            aria-label="Log out"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Log Out
          </button>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f0f8fa',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e3e8ea',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  } as React.CSSProperties,
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  content: {
    maxWidth: '620px',
    margin: '0 auto',
    padding: '32px 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  } as React.CSSProperties,
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#172b35',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '0.9375rem',
    color: '#6b7c84',
    marginTop: '-8px',
  } as React.CSSProperties,
  section: {
    backgroundColor: '#ffffff',
    border: '1px solid #e3e8ea',
    borderRadius: '16px',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  } as React.CSSProperties,
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  } as React.CSSProperties,
  sectionIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#f0f8fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#172b35',
    marginBottom: '2px',
  } as React.CSSProperties,
  sectionDesc: {
    fontSize: '0.8125rem',
    color: '#6b7c84',
  } as React.CSSProperties,
  themeOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,
  themeOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    border: '1.5px solid #e3e8ea',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
    position: 'relative',
  } as React.CSSProperties,
  themeOptionActive: {
    borderColor: '#12617e',
    backgroundColor: '#f0f8fa',
  } as React.CSSProperties,
  themePreview: (theme: string): React.CSSProperties => ({
    width: '32px',
    height: '24px',
    borderRadius: '6px',
    border: '1px solid #e3e8ea',
    flexShrink: 0,
    backgroundColor: theme === 'dark' ? '#1a1a2e' : theme === 'system' ? '#c4e5e8' : '#ffffff',
  }),
  themeText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  } as React.CSSProperties,
  themeLabel: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#172b35',
  } as React.CSSProperties,
  themeDesc: {
    fontSize: '0.8125rem',
    color: '#6b7c84',
  } as React.CSSProperties,
  accountInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  } as React.CSSProperties,
  accountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f0f4f5',
  } as React.CSSProperties,
  accountLabel: {
    fontSize: '0.875rem',
    color: '#6b7c84',
    fontWeight: 500,
  } as React.CSSProperties,
  accountValue: {
    fontSize: '0.875rem',
    color: '#172b35',
    fontWeight: 600,
  } as React.CSSProperties,
  noInfo: {
    fontSize: '0.875rem',
    color: '#6b7c84',
  } as React.CSSProperties,
};
