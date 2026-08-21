import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, patientAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';

let robotImg: string;
try { robotImg = new URL('../assets/robot.png', import.meta.url).href; }
catch { robotImg = new URL('../assets/hero.png', import.meta.url).href; }

export type UserRole = 'patient' | 'care_manager';

export default function Login() {
  return <AuthScreen initialTab="login" />;
}

export function SignupPage() {
  return <AuthScreen initialTab="signup" />;
}

// ─── Main Auth Screen ─────────────────────────────────────────────────────────

function AuthScreen({ initialTab }: { initialTab: 'login' | 'signup' }) {
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [role, setRole] = useState<UserRole>('patient');

  return (
    <div className="auth-screen">
      {/* Desktop: split layout with sliding panel */}
      <div className={`auth-desktop${tab === 'signup' ? ' auth-desktop--signup' : ''}`}>
        {/* Left form area */}
        <div className="auth-desktop__left">
          <div className="auth-desktop__form-wrap">
            <Logo size={32} />
            {/* Role Toggle */}
            <RoleToggle role={role} setRole={setRole} />
            <div className={`auth-desktop__form-slot${tab === 'login' ? ' auth-desktop__form-slot--visible' : ''}`}>
              <LoginForm onSwitch={() => setTab('signup')} role={role} />
            </div>
            <div className={`auth-desktop__form-slot${tab === 'signup' ? ' auth-desktop__form-slot--visible' : ''}`}>
              <SignupForm onSwitch={() => setTab('login')} role={role} />
            </div>
          </div>
          <p className="auth-desktop__footer">🔒 Your data is safe and secure with CarePath.</p>
        </div>

        {/* Right form area (shown when panel slides left) */}
        <div className="auth-desktop__right-form">
          <div className="auth-desktop__form-wrap">
            <Logo size={32} />
            {/* Role Toggle */}
            <RoleToggle role={role} setRole={setRole} />
            <div className={`auth-desktop__form-slot${tab === 'signup' ? ' auth-desktop__form-slot--visible' : ''}`}>
              <SignupForm onSwitch={() => setTab('login')} role={role} />
            </div>
            <div className={`auth-desktop__form-slot${tab === 'login' ? ' auth-desktop__form-slot--visible' : ''}`}>
              <LoginForm onSwitch={() => setTab('signup')} role={role} />
            </div>
          </div>
          <p className="auth-desktop__footer">🔒 Your data is safe and secure with CarePath.</p>
        </div>

        {/* Sliding coral visual panel */}
        <div className="auth-desktop__panel">
          <div className="auth-desktop__panel-content">
            <Logo size={28} />
            <h2 className="auth-desktop__headline">Your health.<br/><em>Your path.</em></h2>
            <p className="auth-desktop__body">
              {role === 'patient'
                ? 'Join CarePath and take control of your health journey.'
                : 'Manage patient care pathways and optimize outcomes.'}
            </p>
            <img src={robotImg} alt="CarePath AI" className="auth-desktop__robot" />
          </div>
          <div className="auth-desktop__panel-cta">
            {tab === 'login' ? (
              <>
                <span>New to CarePath?</span>
                <button className="auth-desktop__cta-btn" onClick={() => setTab('signup')}>Create your account →</button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <button className="auth-desktop__cta-btn" onClick={() => setTab('login')}>Sign in →</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="auth-mobile">
        <div className="auth-screen__header"><Logo size={32} /></div>
        <div className="auth-screen__robot"><img src={robotImg} alt="CarePath AI" className="auth-screen__robot-img" /></div>
        <div className="auth-screen__card">
          {/* Role Toggle */}
          <RoleToggle role={role} setRole={setRole} />
          <div className="auth-tabs">
            <button className={`auth-tabs__btn${tab === 'login' ? ' auth-tabs__btn--active' : ''}`} onClick={() => setTab('login')}>Log In</button>
            <button className={`auth-tabs__btn${tab === 'signup' ? ' auth-tabs__btn--active' : ''}`} onClick={() => setTab('signup')}>Sign Up</button>
          </div>
          {tab === 'login' ? <LoginForm onSwitch={() => setTab('signup')} role={role} /> : <SignupForm onSwitch={() => setTab('login')} role={role} />}
        </div>
      </div>
    </div>
  );
}

// ─── Role Toggle ──────────────────────────────────────────────────────────────

function RoleToggle({ role, setRole }: { role: UserRole; setRole: (r: UserRole) => void }) {
  return (
    <div className="auth-role-toggle">
      <button
        className={`auth-role-toggle__btn${role === 'patient' ? ' auth-role-toggle__btn--active' : ''}`}
        onClick={() => setRole('patient')}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M2 14c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Patient
      </button>
      <button
        className={`auth-role-toggle__btn${role === 'care_manager' ? ' auth-role-toggle__btn--active' : ''}`}
        onClick={() => setRole('care_manager')}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 1l1.5 3h3.5l-2.8 2.2 1 3.3L8 7.5 4.8 9.5l1-3.3L3 4h3.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
        Care Manager
      </button>
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({ onSwitch, role }: { onSwitch: () => void; role: UserRole }) {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = 'Username is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setApiError(''); setLoading(true);
    try {
      const res = await authAPI.login({ username: form.username, password: form.password });
      localStorage.setItem('cp_token', res.access_token);

      // Route based on backend role response or selected role
      const redirectTo = res.redirect_to ?? (role === 'care_manager' ? '/care-manager' : '/patient');

      if (redirectTo === '/care-manager' || res.role === 'CARE_MANAGER') {
        // Care Manager login
        dispatch({ type: 'LOGIN', payload: { token: res.access_token, patient: { patient_id: form.username, username: form.username, name: form.username } } });
        navigate('/care-manager');
      } else {
        // Patient login
        let patient;
        try { patient = await patientAPI.getMe(); }
        catch { patient = { patient_id: form.username, username: form.username }; }

        // Fetch the patient dashboard which includes the MRN (patient-accessible).
        if (patient.patient_id) {
          try {
            const dash = await patientAPI.dashboard();
            const mrn = dash?.patient?.mrn;
            if (mrn) {
              patient = { ...patient, mrn };
            }
          } catch {
            // Dashboard unavailable — MRN may be missing for care navigation.
          }
        }

        dispatch({ type: 'LOGIN', payload: { token: res.access_token, patient } });
        navigate('/chat');
      }
    } catch (err) { setApiError(extractErr(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-form-area fade-in">
      <div className="auth-form-area__header">
        <h1 className="auth-form-area__title">Welcome back! 👋</h1>
        <p className="auth-form-area__sub">
          {role === 'patient' ? 'Sign in to continue your health journey.' : 'Sign in to manage patient pathways.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="auth-fields">
        <div className="af-field">
          <label className="af-label">Username</label>
          <div className={`af-input-wrap${errors.username ? ' af-input-wrap--err' : ''}`}>
            <svg className="af-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2 14c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Enter your username" autoComplete="username"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              disabled={loading} className="af-input" />
          </div>
          {errors.username && <span className="af-err">{errors.username}</span>}
        </div>

        <div className="af-field">
          <label className="af-label">Password</label>
          <div className={`af-input-wrap${errors.password ? ' af-input-wrap--err' : ''}`}>
            <svg className="af-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input type={showPwd ? 'text' : 'password'} placeholder="Enter your password"
              autoComplete="current-password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              disabled={loading} className="af-input af-input--suf" />
            <button type="button" className="af-eye" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
              <EyeIcon closed={showPwd} />
            </button>
          </div>
          {errors.password && <span className="af-err">{errors.password}</span>}
          <button type="button" className="af-forgot">Forgot password?</button>
        </div>

        {apiError && <div className="af-api-error">{apiError}</div>}

        <button type="submit" className="af-submit" disabled={loading}>
          {loading ? <><span className="af-spinner" /> Signing in…</> : <>Log In <span>→</span></>}
        </button>
      </form>

      <p className="auth-form-area__switch">
        Don't have an account? <button type="button" className="af-link" onClick={onSwitch}>Sign up</button>
      </p>
    </div>
  );
}

// ─── Signup Form ──────────────────────────────────────────────────────────────

function SignupForm({ onSwitch, role }: { onSwitch: () => void; role: UserRole }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ mrn: '', username: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [done, setDone] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    // MRN only required for patients
    if (role === 'patient' && !form.mrn.trim()) e.mrn = 'MRN is required';
    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.length < 3) e.username = 'Min 3 characters';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Min 8 characters';
    if (!form.confirm) e.confirm = 'Please confirm';
    else if (form.password !== form.confirm) e.confirm = 'Passwords don\'t match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setApiError(''); setLoading(true);
    try {
      if (role === 'care_manager') {
        // Care Manager signup — no MRN
        await authAPI.signupCareManager({
          username: form.username,
          password: form.password,
          confirm_password: form.confirm,
        });
      } else {
        // Patient signup — includes MRN
        await authAPI.signup({
          mrn: form.mrn,
          username: form.username,
          password: form.password,
          confirm_password: form.confirm,
        });
      }
      setDone(true);
    } catch (err) { setApiError(extractErr(err)); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="auth-form-area auth-form-area--success fade-in">
        <div className="af-success-icon">✓</div>
        <h2 className="auth-form-area__title">Account Created!</h2>
        <p className="auth-form-area__sub">
          {role === 'care_manager'
            ? 'Your Care Manager account is ready. Sign in to begin.'
            : 'Your CarePath is ready. Sign in to begin.'}
        </p>
        <button className="af-submit" onClick={() => navigate('/login')}>Go to Login →</button>
      </div>
    );
  }

  return (
    <div className="auth-form-area fade-in">
      <div className="auth-form-area__header">
        <h1 className="auth-form-area__title">Create your account</h1>
        <p className="auth-form-area__sub">
          {role === 'patient'
            ? 'Start your personalized health journey.'
            : 'Join as a Care Manager to manage patient pathways.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="auth-fields">
        {/* MRN field — only for patients */}
        {role === 'patient' && (
          <div className="af-field">
            <label className="af-label">MRN Number</label>
            <div className={`af-input-wrap${errors.mrn ? ' af-input-wrap--err' : ''}`}>
              <svg className="af-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2 7h12M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Enter your MRN" autoComplete="off"
                value={form.mrn} onChange={e => setForm(f => ({ ...f, mrn: e.target.value }))}
                disabled={loading} className="af-input" />
            </div>
            {errors.mrn && <span className="af-err">{errors.mrn}</span>}
          </div>
        )}

        <div className="af-field">
          <label className="af-label">Username</label>
          <div className={`af-input-wrap${errors.username ? ' af-input-wrap--err' : ''}`}>
            <svg className="af-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2 14c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Choose a username" autoComplete="username"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              disabled={loading} className="af-input" />
          </div>
          {errors.username && <span className="af-err">{errors.username}</span>}
        </div>

        <div className="af-field">
          <label className="af-label">Password</label>
          <div className={`af-input-wrap${errors.password ? ' af-input-wrap--err' : ''}`}>
            <svg className="af-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input type={showPwd ? 'text' : 'password'} placeholder="Create a password"
              autoComplete="new-password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              disabled={loading} className="af-input af-input--suf" />
            <button type="button" className="af-eye" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
              <EyeIcon closed={showPwd} />
            </button>
          </div>
          {errors.password && <span className="af-err">{errors.password}</span>}
        </div>

        <div className="af-field">
          <label className="af-label">Confirm password</label>
          <div className={`af-input-wrap${errors.confirm ? ' af-input-wrap--err' : ''}`}>
            <svg className="af-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input type={showCon ? 'text' : 'password'} placeholder="Confirm your password"
              autoComplete="new-password"
              value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              disabled={loading} className="af-input af-input--suf" />
            <button type="button" className="af-eye" onClick={() => setShowCon(v => !v)} tabIndex={-1}>
              <EyeIcon closed={showCon} />
            </button>
          </div>
          {errors.confirm && <span className="af-err">{errors.confirm}</span>}
        </div>

        {apiError && <div className="af-api-error">{apiError}</div>}

        <button type="submit" className="af-submit" disabled={loading}>
          {loading ? <><span className="af-spinner" /> Creating…</> : <>Create Account <span>→</span></>}
        </button>
      </form>

      <p className="auth-form-area__switch">
        Already have an account? <button type="button" className="af-link" onClick={onSwitch}>Log in</button>
      </p>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function EyeIcon({ closed }: { closed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      {closed && <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>}
    </svg>
  );
}

function extractErr(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { data?: { detail?: string }; status?: number } };
    if (e.response?.data?.detail) return e.response.data.detail;
    if (e.response?.status === 401) return 'Incorrect username or password.';
    if (e.response?.status === 400) return 'Username already exists.';
  }
  return 'Something went wrong. Please try again.';
}

export { SignupPage as default_signup };
