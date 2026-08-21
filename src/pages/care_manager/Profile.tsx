import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { careManagerAPI } from '../../services/api';
import Logo from '../../components/Logo';

interface ProfileData {
  id: number;
  username: string;
  role: string;
  created_at: string | null;
}

export default function CareManagerProfile() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state.token) { navigate('/login'); return; }
    loadProfile();
  }, [state.token, navigate]);

  const loadProfile = async () => {
    try {
      const data = await careManagerAPI.profile();
      setProfile(data);
    } catch (err) {
      setError('Failed to load profile.');
      console.error('[CareManager Profile]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  return (
    <div className="cm-layout">
      {/* Sidebar */}
      <aside className="cm-sidebar">
        <div className="cm-sidebar__logo">
          <Logo size={28} textSize="1rem" />
        </div>

        <nav className="cm-sidebar__nav">
          <button className="cm-nav-btn" onClick={() => navigate('/care-manager')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            Dashboard
          </button>
          <button className="cm-nav-btn cm-nav-btn--active">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2 14c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Profile
          </button>
        </nav>

        <div className="cm-sidebar__bottom">
          <button className="cm-nav-btn cm-nav-btn--logout" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="cm-main">
        <header className="cm-header">
          <h1 className="cm-header__title">My Profile</h1>
          <p className="cm-header__sub">Care Manager Account Details</p>
        </header>

        {loading && (
          <div className="cm-loading">
            <span className="af-spinner" /> Loading profile...
          </div>
        )}

        {error && (
          <div className="cm-error" role="alert">{error}</div>
        )}

        {!loading && !error && profile && (
          <div className="cm-profile-card">
            <div className="cm-profile-card__avatar">
              {profile.username[0]?.toUpperCase() ?? 'C'}
            </div>
            <div className="cm-profile-card__details">
              <div className="cm-profile-card__row">
                <span className="cm-profile-card__label">Username</span>
                <span className="cm-profile-card__value">{profile.username}</span>
              </div>
              <div className="cm-profile-card__row">
                <span className="cm-profile-card__label">Role</span>
                <span className="cm-profile-card__value">{profile.role}</span>
              </div>
              <div className="cm-profile-card__row">
                <span className="cm-profile-card__label">User ID</span>
                <span className="cm-profile-card__value">#{profile.id}</span>
              </div>
              {profile.created_at && (
                <div className="cm-profile-card__row">
                  <span className="cm-profile-card__label">Member Since</span>
                  <span className="cm-profile-card__value">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
