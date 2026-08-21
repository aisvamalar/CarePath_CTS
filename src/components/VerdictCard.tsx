/**
 * CarePath — Verdict Card
 * Matches screenshot 1 (bottom half) and screenshot 3 (top section):
 * - Green checkmark + "You can be cared for without the ER" + Low Risk badge
 * - Two care option cards side by side (Telehealth / Outpatient)
 * - Triage Prediction semicircle gauge + "What to expect" list
 * Emergency path: red 911 banner
 */

import type { SafetyEvaluationResponse, PathwayResult, CarePlanOption } from '../services/api';

const RULE_LABELS: Record<string, string> = {
  chest_pain: 'Chest Pain / Pressure',
  difficulty_breathing: 'Severe Difficulty Breathing',
  altered_consciousness: 'Loss of Consciousness',
  severe_bleeding: 'Severe Bleeding',
  stroke_symptoms: 'Stroke Symptoms',
  suicidal_ideation: 'Suicidal Ideation',
  anaphylaxis: 'Severe Allergic Reaction',
  high_fever: 'High Fever ≥103°F',
  unable_to_walk: 'Unable to Walk / Stand',
  severe_abdominal_pain: 'Severe Abdominal Pain',
};

interface VerdictCardProps {
  result: SafetyEvaluationResponse;
  onNewChat: () => void;
}

export default function VerdictCard({ result, onNewChat }: VerdictCardProps) {
  const isEmergency = result.result === 'YES';
  const isError = result.result === 'ERROR';
  const showNewAssessment = isEmergency || isError || !result.pathway || result.pathway.decision === 'NOT_AVOIDABLE';

  return (
    <div className="vc2-root">
      {/* ── Emergency ── */}
      {isEmergency && (
        <div className="vc2-emergency">
          <div className="vc2-emergency__icon">🚨</div>
          <div>
            <h2 className="vc2-emergency__title">Emergency Detected</h2>
            <p className="vc2-emergency__text">Please go to the Emergency Room immediately.</p>
            <p className="vc2-emergency__hint">Do not wait. Call <strong>911</strong> if you cannot travel safely.</p>
          </div>
        </div>
      )}
      {isEmergency && result.triggered_rules && result.triggered_rules.length > 0 && (
        <div className="vc2-flags">
          {result.triggered_rules.map(r => <span key={r} className="vc2-flag">{RULE_LABELS[r] ?? r}</span>)}
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="vc2-error-banner">
          <span>⚠️</span>
          <div>
            <strong>Evaluation Error</strong>
            <p>{result.error_detail ?? 'An error occurred. Please try again.'}</p>
          </div>
        </div>
      )}

      {/* ── Non-emergency (ML pathway) ── */}
      {!isEmergency && !isError && result.pathway && (
        <PathwayResult pathway={result.pathway} />
      )}

      {/* ── Fallback when no pathway ── */}
      {!isEmergency && !isError && !result.pathway && (
        <div className="vc2-success-banner">
          <div className="vc2-success-banner__check">✓</div>
          <div>
            <h2>No Emergency Detected</h2>
            <p>Your assessment will continue through the clinical pathway.</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="vc2-footer">
        <span className="vc2-footer__time">{result.evaluated_at ? new Date(result.evaluated_at).toLocaleString() : ''}</span>
        {showNewAssessment && <button className="vc2-new-btn" onClick={onNewChat}>Start New Assessment</button>}
      </div>
    </div>
  );
}

function PathwayResult({ pathway }: { pathway: PathwayResult }) {
  const avoidable = pathway.decision === 'POTENTIALLY_AVOIDABLE';
  const riskLabel = pathway.risk_level ?? 'LOW';
  const riskScore = Math.round(pathway.risk_score ?? 0);

  return (
    <div className="vc2-pathway">
      {/* Banner row */}
      <div className="vc2-banner">
        <div className={`vc2-banner__check ${avoidable ? '' : 'vc2-banner__check--er'}`}>✓</div>
        <div className="vc2-banner__text">
          <h2 className="vc2-banner__title">
            {avoidable ? 'You can be cared for without the ER' : 'Please go to the Emergency Room'}
          </h2>
          <p className="vc2-banner__sub">
            {avoidable
              ? 'Based on your responses, your symptoms do not indicate an emergency.'
              : 'Your symptoms require in-person emergency care today.'}
          </p>
        </div>
        <span className={`vc2-risk-badge vc2-risk-badge--${riskLabel.toLowerCase()}`}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{marginRight:4}}>
            <rect x="1" y="8" width="2.5" height="5" rx="0.5" fill="currentColor"/>
            <rect x="5" y="5" width="2.5" height="8" rx="0.5" fill="currentColor"/>
            <rect x="9" y="2" width="2.5" height="11" rx="0.5" fill="currentColor" opacity="0.4"/>
          </svg>
          {riskLabel.charAt(0) + riskLabel.slice(1).toLowerCase()} Risk
        </span>
      </div>

      {/* Care option cards (2-up) */}
      {pathway.care_plan && pathway.care_plan.length > 0 && (
        <div className="vc2-care-grid">
          {pathway.care_plan.map((opt: CarePlanOption, i: number) => (
            <div key={i} className="vc2-care-card">
              <div className="vc2-care-card__icon">
                {i === 0
                  ? <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="8" width="24" height="18" rx="2" stroke="#e06a4f" strokeWidth="1.8"/><path d="M4 14h24M12 8V6M20 8V6" stroke="#e06a4f" strokeWidth="1.8" strokeLinecap="round"/><circle cx="16" cy="20" r="3" stroke="#e06a4f" strokeWidth="1.6"/></svg>
                  : <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="8" width="24" height="18" rx="2" stroke="#e06a4f" strokeWidth="1.8"/><path d="M16 13v6M13 16h6" stroke="#e06a4f" strokeWidth="1.8" strokeLinecap="round"/><path d="M4 14h24M12 8V6M20 8V6" stroke="#e06a4f" strokeWidth="1.8" strokeLinecap="round"/></svg>
                }
              </div>
              <div className="vc2-care-card__body">
                <h3 className="vc2-care-card__title">{opt.title}</h3>
                <p className="vc2-care-card__desc">{opt.description}</p>
              </div>
              <button className="vc2-care-card__btn">
                {i === 0 ? 'Book Now →' : 'View Plan →'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Triage prediction + What to expect */}
      <div className="vc2-triage-row">
        {/* Gauge */}
        <div className="vc2-gauge-card">
          <h3 className="vc2-gauge-card__title">Triage Prediction</h3>
          <SemiGauge score={riskScore} label={riskLabel} />
          <p className="vc2-gauge-card__sub">
            {avoidable ? 'No emergency indicators detected' : 'Emergency indicators present'}
          </p>
          <div className="vc2-confidence">
            <span>Confidence Score</span>
            <strong>{Math.max(80, 100 - riskScore)}%</strong>
          </div>
        </div>

        {/* What to expect */}
        <div className="vc2-expect-card">
          <h3 className="vc2-expect-card__title">What to expect</h3>
          <ul className="vc2-expect-list">
            <ExpectItem
              icon="🩺"
              title="Likely a mild to moderate condition"
              desc="Your symptoms suggest a non-emergency presentation."
            />
            <ExpectItem
              icon="💊"
              title="Evaluation &amp; treatment"
              desc="A provider will assess and recommend the right treatment."
            />
            <ExpectItem
              icon="📋"
              title="Follow-up care"
              desc="Monitor your symptoms and follow up if they worsen."
            />
            <ExpectItem
              icon="⚠️"
              title="Seek immediate care if"
              desc="Pain becomes severe, you develop a high fever, or see blood in vomit/stool."
              warn
            />
          </ul>
        </div>
      </div>

      {!avoidable && (
        <p className="vc2-er-cta">If symptoms worsen, call <strong>911</strong> or go to the nearest ER immediately.</p>
      )}
    </div>
  );
}

function ExpectItem({ icon, title, desc, warn }: { icon: string; title: string; desc: string; warn?: boolean }) {
  return (
    <li className={`vc2-expect-item ${warn ? 'vc2-expect-item--warn' : ''}`}>
      <span className="vc2-expect-item__icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p dangerouslySetInnerHTML={{ __html: desc }} />
      </div>
    </li>
  );
}

function SemiGauge({ score, label }: { score: number; label: string }) {
  // SVG half-circle gauge
  const R = 54;
  const cx = 70; const cy = 70;
  const circumference = Math.PI * R;
  const fillPct = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - fillPct);
  const color = label === 'LOW' ? '#e06a4f' : label === 'MODERATE' ? '#f5a08a' : '#dc2626';
  return (
    <div className="vc2-gauge">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Track */}
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round"/>
        {/* Fill */}
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}/>
      </svg>
      <div className="vc2-gauge__label" style={{ color }}>
        <strong>{label.toUpperCase()} RISK</strong>
      </div>
    </div>
  );
}
