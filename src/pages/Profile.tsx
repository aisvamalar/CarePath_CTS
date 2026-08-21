/**
 * Profile Page
 * Fetches user record from /auth/me (always accessible).
 * Then tries /ehr/patients/mrn/{mrn} for medical demographics.
 * Gracefully degrades — account info always shows, medical info shows if available.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
import client from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface UserRecord {
  id: number;
  username: string;
  role: string;
  patient_id?: string;
}

interface EHRData {
  id?: number;
  mrn?: string;
  patient_id?: string;
  name?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  bmi?: number;
  insurance_type?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Profile() {
  const { state } = useApp();
  const navigate = useNavigate();

  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [ehr, setEhr] = useState<EHRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ehrStatus, setEhrStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading');

  useEffect(() => {
    if (!state.token) { navigate('/login'); return; }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.token]);

  const loadProfile = async () => {
    setLoading(true);
    setEhrStatus('loading');

    try {
      const me = await authAPI.me();
      setUserRecord(me);

      // Try fetching EHR via patient_id string field
      // Backend uses integer PK for /ehr/patients/{id} but also has /ehr/patients/mrn/{mrn}
      // Try both — patient_id from auth/me is the PAT_XXXXXXXX string stored on PatientEHR
      const mrn = state.patient?.mrn as string | undefined;
      const patientId = me.patient_id;

      let fetched = false;

      // Attempt 1: by MRN
      if (!fetched && mrn) {
        try {
          const res = await client.get<EHRData>(`/ehr/patients/mrn/${mrn}`);
          setEhr(res.data);
          setEhrStatus('ok');
          fetched = true;
        } catch { /* try next */ }
      }

      // Attempt 2: by patient_id path (string match on patient_id column via custom search)
      if (!fetched && patientId) {
        try {
          // Some backends expose /ehr/patients?patient_id=PAT_XXX
          const res = await client.get<EHRData[]>(`/ehr/patients`, { params: { patient_id: patientId, limit: 1 } });
          const arr = Array.isArray(res.data) ? res.data : [];
          if (arr.length > 0) {
            setEhr(arr[0]);
            setEhrStatus('ok');
            fetched = true;
          }
        } catch { /* try next */ }
      }

      // Attempt 3: numeric id lookup — only if patient_id looks numeric
      if (!fetched && patientId && /^\d+$/.test(patientId)) {
        try {
          const res = await client.get<EHRData>(`/ehr/patients/${patientId}`);
          setEhr(res.data);
          setEhrStatus('ok');
          fetched = true;
        } catch { /* give up */ }
      }

      if (!fetched) setEhrStatus('unavailable');

    } catch {
      // /auth/me failed — expired token
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const displayName = ehr?.name ?? state.patient?.name ?? userRecord?.username ?? 'Patient';
  const mrn         = ehr?.mrn  ?? (state.patient?.mrn as string | undefined);
  const initial     = displayName.trim()[0]?.toUpperCase() ?? 'P';

  return (
    <div className="profile-page">
      {/* Top bar */}
      <div className="profile-topbar">
        <button className="btn-ghost profile-back-btn" onClick={() => navigate('/chat')} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <Logo size={24} textSize="0.95rem" />
      </div>

      <div className="profile-content fade-in">

        {loading ? (
          <div className="profile-loading-wrap" aria-live="polite">
            <div className="profile-spinner" aria-hidden="true" />
            <p>Loading your profile…</p>
          </div>
        ) : (
          <>
            {/* ── Hero ── */}
            <div className="profile-hero">
              <div className="profile-hero-avatar-ring">
                <div className="profile-hero-avatar" aria-hidden="true">{initial}</div>
              </div>
              <div className="profile-hero-text">
                <h1 className="profile-hero-name">{displayName}</h1>
                <div className="profile-hero-badges">
                  {mrn && <span className="profile-badge-pill profile-badge-pill--mrn">MRN: {mrn}</span>}
                  <span className="profile-badge-pill profile-badge-pill--role">
                    {formatRole(userRecord?.role)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Medical Profile card ── */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon profile-section-icon--medical">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                <h2 className="profile-section-title">Medical Profile</h2>
                {ehrStatus === 'loading' && <span className="profile-section-loading" />}
              </div>

              {ehrStatus === 'ok' && ehr ? (
                <div className="profile-grid">
                  <MedCard
                    icon="👤"
                    label="Full Name"
                    value={ehr.name ?? '—'}
                  />
                  <MedCard
                    icon="🎂"
                    label="Date of Birth"
                    value={ehr.date_of_birth ? formatDate(ehr.date_of_birth) : '—'}
                  />
                  <MedCard
                    icon="🗓"
                    label="Age"
                    value={ehr.age !== undefined ? `${ehr.age} yrs` : '—'}
                  />
                  <MedCard
                    icon={genderIcon(ehr.gender)}
                    label="Gender"
                    value={ehr.gender ? capitalize(ehr.gender) : '—'}
                  />
                  <MedCard
                    icon="⚖️"
                    label="BMI"
                    value={ehr.bmi !== undefined ? `${ehr.bmi.toFixed(1)} kg/m²` : '—'}
                    badge={ehr.bmi !== undefined ? bmiCategory(ehr.bmi) : undefined}
                  />
                  <MedCard
                    icon="🏥"
                    label="Insurance"
                    value={ehr.insurance_type ?? '—'}
                  />
                </div>
              ) : ehrStatus === 'unavailable' ? (
                <div className="profile-notice">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="#6b7c84" strokeWidth="1.4"/>
                    <path d="M8 7v4M8 5h.01" stroke="#6b7c84" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Medical profile is managed by your care team. Contact your care manager to view or update your records.
                </div>
              ) : (
                <div className="profile-grid profile-grid--skeleton">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="med-card-skeleton" />)}
                </div>
              )}
            </section>

            {/* ── Account section ── */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon profile-section-icon--account">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M2 13.5c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </span>
                <h2 className="profile-section-title">Account</h2>
              </div>
              <ul className="profile-detail-list">
                <ProfileRow label="Username"  value={userRecord?.username ?? '—'} mono />
                <ProfileRow label="Role"      value={formatRole(userRecord?.role)} />
                {mrn && <ProfileRow label="MRN" value={mrn} mono />}
                {userRecord?.patient_id && (
                  <ProfileRow label="Patient ID" value={userRecord.patient_id} mono />
                )}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MedCard({
  icon, label, value, badge,
}: {
  icon: string;
  label: string;
  value: string;
  badge?: { text: string; color: string };
}) {
  return (
    <div className="med-card">
      <span className="med-card-icon" aria-hidden="true">{icon}</span>
      <span className="med-card-label">{label}</span>
      <span className="med-card-value">
        {value}
        {badge && (
          <span
            className="profile-badge"
            style={{ backgroundColor: badge.color + '20', color: badge.color, marginLeft: '6px' }}
          >
            {badge.text}
          </span>
        )}
      </span>
    </div>
  );
}

function ProfileRow({
  label, value, mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <li className="profile-detail-row">
      <span className="profile-detail-label">{label}</span>
      <span className={`profile-detail-value${mono ? ' profile-detail-mono' : ''}`}>{value}</span>
    </li>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return d; }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatRole(role?: string): string {
  if (!role) return '—';
  if (role === 'PATIENT') return 'Patient';
  if (role === 'CARE_MANAGER') return 'Care Manager';
  return role;
}

function genderIcon(g?: string): string {
  if (!g) return '⚥';
  const l = g.toLowerCase();
  if (l === 'male') return '♂';
  if (l === 'female') return '♀';
  return '⚥';
}

function bmiCategory(bmi: number): { text: string; color: string } {
  if (bmi < 18.5) return { text: 'Underweight', color: '#e67e22' };
  if (bmi < 25)   return { text: 'Normal',       color: '#179c88' };
  if (bmi < 30)   return { text: 'Overweight',   color: '#e67e22' };
  return               { text: 'Obese',          color: '#d92d20' };
}
