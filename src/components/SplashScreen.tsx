import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import Logo from './Logo';

export default function SplashScreen() {
  const { state, dispatch } = useApp();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), 2000);
    const t2 = setTimeout(() => {
      dispatch({ type: 'SET_PHASE', payload: state.token ? 'chat' : 'onboarding' });
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [state.token, dispatch]);

  return (
    <div className={`spl-root${visible ? '' : ' spl-root--out'}`} role="main" aria-label="CarePath loading">
      <div className="spl-blob spl-blob--tl" aria-hidden="true" />
      <div className="spl-blob spl-blob--br" aria-hidden="true" />

      <div className={`spl-card${visible ? ' spl-card--in' : ' spl-card--out'}`}>
        <div className="spl-logo-wrap" aria-hidden="true">
          <div className="spl-logo-bg">
            <svg width="36" height="36" viewBox="0 0 56 56" fill="none">
              <path d="M28 10C28 10 15 17 15 27C15 35 20.5 40.5 28 43C35.5 40.5 41 35 41 27C41 17 28 10 28 10Z"
                fill="white" fillOpacity="0.95" />
              <path d="M22 27.5L26.5 32L34 22.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            </svg>
          </div>
          <div className="spl-logo-ring" />
        </div>

        <Logo size={72} textSize="2.5rem" />
        <p className="spl-tagline">Your health. Your <em>path</em>.</p>

        <div className="spl-dots" role="status" aria-label="Loading">
          <span className="spl-dot" style={{ animationDelay: '0s' }} />
          <span className="spl-dot" style={{ animationDelay: '0.2s' }} />
          <span className="spl-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}
