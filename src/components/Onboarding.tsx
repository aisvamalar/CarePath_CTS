import { useApp } from '../context/AppContext';
import Logo from './Logo';
import CarePathNetworkBackground from './CarePathNetworkBackground';

let robotImg: string;
try { robotImg = new URL('../assets/robot.png', import.meta.url).href; }
catch { robotImg = new URL('../assets/hero.png', import.meta.url).href; }

export default function Onboarding() {
  const { dispatch } = useApp();
  const handleNext = () => dispatch({ type: 'SET_PHASE', payload: 'auth' });

  return (
    <div className="ob-root">
      {/* ── Desktop: White landing with network bg ── */}
      <div className="ob-web">
        <CarePathNetworkBackground />

        {/* Nav — logo left, login right */}
        <nav className="ob-web__nav">
          <Logo size={56} />
          <div className="ob-web__nav-right">
            <button className="ob-web__login-btn" onClick={handleNext}>
              Log in
            </button>
          </div>
        </nav>

        {/* Hero */}
        <div className="ob-web__hero">
          <div className="ob-web__badge">
            <span className="ob-web__badge-dot" />
            Trusted by 10,000+ patients
          </div>

          <h1 className="ob-web__headline">
            Elevate Your Health<br/>with <em>Smart AI Care</em>
          </h1>

          <p className="ob-web__sub">
            Transform your healthcare experience with CarePath's AI-powered triage,
            personalized care plans, and intelligent voice assistant. Get instant health
            guidance, anytime.
          </p>

          <button className="ob-web__cta" onClick={handleNext}>
            Get Started <span>→</span>
          </button>
        </div>
      </div>

      {/* ── Mobile: Robot + Card ── */}
      <div className="ob-mob">
        <div className="ob-blob ob-blob--1" aria-hidden="true" />
        <div className="ob-blob ob-blob--2" aria-hidden="true" />

        <div className="ob-robot-area">
          <img src={robotImg} alt="CarePath AI" className="ob-robot-img" />
          <span className="ob-sparkle ob-sparkle--1">✦</span>
          <span className="ob-sparkle ob-sparkle--2">♥</span>
          <span className="ob-sparkle ob-sparkle--3">✦</span>
        </div>

        <div className="ob-card fade-in">
          <Logo size={40} />
          <h1 className="ob-title">Meet Your AI<br/>Health Assistant</h1>
          <p className="ob-body">
            Effortlessly manage your health, understand symptoms, and get personalized care
            recommendations with simple voice commands.
          </p>
          <button className="ob-btn" onClick={handleNext}>Next <span className="ob-btn__arrow">→</span></button>
          <button className="ob-skip" onClick={handleNext}>Skip</button>
        </div>
      </div>
    </div>
  );
}
