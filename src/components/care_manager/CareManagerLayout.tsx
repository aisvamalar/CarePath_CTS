/**
 * CarePath — Care Manager application shell.
 * Sidebar + top header + main content + optional right workspace panel.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import Logo from '../Logo';
import GlobalSearch from './GlobalSearch';

interface NavItem {
  key: string;
  label: string;
  path?: string;
  icon: React.ReactNode;
  badge?: number;
  /** Sections with no backend endpoint yet are shown but not clickable. */
  unavailable?: boolean;
}

const I = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="10" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  patients: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <circle cx="7" cy="6" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.8 15.2c0-3 2.3-4.8 5.2-4.8s5.2 1.8 5.2 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.6 4.1a2.6 2.6 0 010 4.6M14.4 15.2c0-1.7-.5-3-1.4-3.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  readmission: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M2.5 11.5l3.5-4 3 2.6 3-4.1 3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6 8.9h2.9V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  postDischarge: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M4 2.5h7.5L14.5 5.5V15a.9.9 0 01-.9.9H4.9A.9.9 0 014 15V3.4a.9.9 0 01.9-.9z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.4 9.4l1.6 1.6 3.2-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  analytics: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M3 15V8.5M7.6 15V3.5M12.2 15v-4.5M16 15V6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  inbox: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M2.5 9.5V14a1 1 0 001 1h11a1 1 0 001-1V9.5L13 3.5H5L2.5 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.5 9.5h3.2l1 2h4.6l1-2h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  carePlans: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="2.5" width="12" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6.5h6M6 9.2h6M6 11.9h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  tasks: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M2.8 5.4l1.6 1.6 2.6-2.6M2.8 12.4l1.6 1.6 2.6-2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.6 5.6h5.6M9.6 12.6h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  reports: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M4.5 2.5h6L14 6v9.5H4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 10.5h4M7 12.8h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  team: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <circle cx="6.2" cy="6.4" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.4" cy="7.4" r="1.9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 14.6c0-2.4 1.9-3.8 4.2-3.8s4.2 1.4 4.2 3.8M11.6 11.2c2 0 3.4 1.1 3.4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  resources: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M9 4.2S7.4 2.8 5.2 2.8c-1.2 0-2 .3-2 .3v11s.8-.4 2-.4c2.2 0 3.8 1.5 3.8 1.5s1.6-1.5 3.8-1.5c1.2 0 2 .4 2 .4v-11s-.8-.3-2-.3C10.6 2.8 9 4.2 9 4.2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 4.2v11.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  settings: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 2v1.8M9 14.2V16M2 9h1.8M14.2 9H16M4.1 4.1l1.3 1.3M12.6 12.6l1.3 1.3M13.9 4.1l-1.3 1.3M5.4 12.6l-1.3 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  help: (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="6.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.2 7a1.9 1.9 0 013.6.8c0 1.3-1.8 1.5-1.8 2.8M9 12.9h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const PRIMARY_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/care-manager', icon: I.dashboard },
  { key: 'patients', label: 'Patients', path: '/care-manager/patients', icon: I.patients },
  { key: 'readmission', label: 'Readmission', path: '/care-manager/readmission', icon: I.readmission },
  { key: 'post-discharge', label: 'Post Discharge', path: '/care-manager/post-discharge', icon: I.postDischarge },
  { key: 'analytics', label: 'Analytics', path: '/care-manager/analytics', icon: I.analytics },
];

export default function CareManagerLayout({
  breadcrumb,
  children,
  rightPanel,
}: {
  breadcrumb: string;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = state.patient?.name ?? state.patient?.username ?? 'Care Manager';
  const initial = displayName.trim()[0]?.toUpperCase() ?? 'C';

  // Close the profile dropdown on any outside click.
  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [profileOpen]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const isActive = (item: NavItem) => {
    if (!item.path) return false;
    if (item.path === '/care-manager') return location.pathname === '/care-manager';
    return location.pathname.startsWith(item.path);
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  const sidebar = (
    <aside className="cmx-sidebar" aria-label="Care Manager navigation">
      <div className="cmx-sidebar__brand">
        <Logo size={36} textSize="1.25rem" />
        <span className="cmx-sidebar__role">Care Manager</span>
      </div>

      <div className="cmx-sidebar__divider" />

      <nav className="cmx-nav">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.key}
              type="button"
              className={`cmx-nav__item${active ? ' cmx-nav__item--active' : ''}`}
              onClick={() => item.path && navigate(item.path)}
              aria-current={active ? 'page' : undefined}
              title={item.label}
            >
              <span className="cmx-nav__icon" aria-hidden="true">{item.icon}</span>
              <span className="cmx-nav__label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="cmx-sidebar__foot">
        <button className="cmx-nav__item" onClick={handleLogout}>
          <span className="cmx-nav__icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
              <path d="M7 15H4a1 1 0 01-1-1V4a1 1 0 011-1h3M11 12.5l3.5-3.5L11 5.5M14.5 9H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="cmx-nav__label">Sign out</span>
        </button>

        <button className="cmx-userchip" onClick={() => navigate('/care-manager/profile')}>
          <span className="cmx-userchip__avatar">{initial}</span>
          <span className="cmx-userchip__text">
            <span className="cmx-userchip__name">{displayName}</span>
            <span className="cmx-userchip__role">Care Manager</span>
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="cmx-root">
      {/* Desktop / tablet sidebar */}
      <div className="cmx-sidebar-slot">{sidebar}</div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="cmx-drawer-overlay" onClick={() => setDrawerOpen(false)} role="presentation">
          <div className="cmx-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Navigation">
            {sidebar}
          </div>
        </div>
      )}

      <div className="cmx-body">
        {/* ── Top header ── */}
        <header className="cmx-header">
          <button
            className="cmx-header__menu"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Open navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>

          <nav className="cmx-crumb" aria-label="Breadcrumb">
            <span className="cmx-crumb__root">CarePath AI</span>
            <span className="cmx-crumb__sep" aria-hidden="true">/</span>
            <span className="cmx-crumb__current">{breadcrumb}</span>
          </nav>

          <GlobalSearch />

          <div className="cmx-header__actions">
            <button className="cmx-iconbtn" aria-label="Notifications" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2.5a4 4 0 00-4 4v2.6L3.8 11.4h10.4L13 9.1V6.5a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M7.2 13.4a1.9 1.9 0 003.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button className="cmx-iconbtn" aria-label="Messages" title="Messages">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M15 3.5H3a1 1 0 00-1 1v7a1 1 0 001 1h2.5v2.4l2.9-2.4H15a1 1 0 001-1v-7a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="cmx-profile" ref={profileRef}>
              <button
                className="cmx-profile__btn"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="cmx-profile__avatar">{initial}</span>
                <span className="cmx-profile__text">
                  <span className="cmx-profile__name">{displayName}</span>
                  <span className="cmx-profile__role">Care Manager</span>
                </span>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {profileOpen && (
                <div className="cmx-profile__menu" role="menu">
                  <button role="menuitem" onClick={() => { setProfileOpen(false); navigate('/care-manager/profile'); }}>
                    My profile
                  </button>
                  <button role="menuitem" onClick={() => { setProfileOpen(false); navigate('/care-manager'); }}>
                    Dashboard
                  </button>
                  <div className="cmx-profile__divider" />
                  <button role="menuitem" className="cmx-profile__menu-danger" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Content + right panel ── */}
        <div className={`cmx-content${rightPanel ? '' : ' cmx-content--wide'}`}>
          <main className="cmx-main">{children}</main>
          {rightPanel && <aside className="cmx-rail" aria-label="Care Manager workspace">{rightPanel}</aside>}
        </div>
      </div>
    </div>
  );
}
