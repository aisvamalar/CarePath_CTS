import React from 'react';
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

export default function VerdictCard({
  result,
  onNewChat,
}: VerdictCardProps) {
  const isEmergency = result.result === 'YES';
  const isError = result.result === 'ERROR';

  return (
    <div style={styles.container} className="fade-in">
      {/* Verdict Banner */}
      {isEmergency ? (
        <div style={styles.emergencyBanner} role="alert" aria-live="assertive">
          <div style={styles.emergencyIcon}>🚨</div>
          <div>
            <h2 style={styles.emergencyTitle}>Emergency Detected</h2>
            <p style={styles.emergencyBody}>
              Please go to the Emergency Room immediately.
            </p>
            <p style={styles.emergencyNote}>
              Do not wait. Call <strong>911</strong> if you cannot travel safely.
            </p>
          </div>
        </div>
      ) : isError ? (
        <div style={styles.errorBanner} role="alert">
          <div style={styles.errorIcon}>⚠️</div>
          <div>
            <h2 style={styles.errorTitle}>Evaluation Error</h2>
            <p style={styles.errorBody}>
              {result.error_detail ?? 'An error occurred during evaluation. Please try again or contact support.'}
            </p>
          </div>
        </div>
      ) : result.pathway ? null : (
        // Only shown as a fallback when the ML pathway result is unavailable.
        <div style={styles.successBanner} role="status">
          <div style={styles.successIcon}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" fill="#E1F7D5" stroke="#179C88" strokeWidth="2"/>
              <path d="M12 20L17 25L28 14" stroke="#179C88" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 style={styles.successTitle}>No Emergency Detected</h2>
            <p style={styles.successBody}>
              Your assessment will continue through the clinical pathway.
            </p>
          </div>
        </div>
      )}

      {/* Triggered Red Flags (emergency only) */}
      {isEmergency && result.triggered_rules && result.triggered_rules.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ marginRight: '6px' }}>
              <path d="M7 1L1 13h12L7 1z" stroke="#D92D20" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 6v3M7 11h.01" stroke="#D92D20" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Triggered Red Flags
          </h3>
          <div style={styles.flagList}>
            {result.triggered_rules.map((rule) => (
              <div key={rule} style={styles.flagItem}>
                <span style={styles.flagDot} aria-hidden="true" />
                <span style={styles.flagLabel}>{RULE_LABELS[rule] ?? rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avoidable-ED model result — embedded in the safety evaluation (no emergency) */}
      {!isEmergency && !isError && result.pathway && (
        <PathwayCard pathway={result.pathway} />
      )}

      {/* Session meta */}
      {result.evaluated_at && (
        <p style={styles.meta}>Evaluated: {new Date(result.evaluated_at).toLocaleString()}</p>
      )}

      {/* New chat */}
      <div style={styles.actions}>
        <button
          className="btn-primary"
          style={styles.newChatBtn}
          onClick={onNewChat}
          aria-label="Start a new assessment"
        >
          Start New Assessment
        </button>
      </div>
    </div>
  );
}

function PathwayCard({ pathway }: { pathway: PathwayResult }) {
  const edNeeded = pathway.decision === 'NOT_AVOIDABLE';

  return (
    <div style={edNeeded ? edStyles.needed : edStyles.avoidable} role="status">
      <div style={edStyles.head}>
        <span style={edStyles.icon}>{edNeeded ? '🏥' : '✅'}</span>
        <div>
          <h3 style={edNeeded ? edStyles.titleNeeded : edStyles.titleAvoidable}>
            {edNeeded ? 'Please go to the Emergency Room' : 'You can be cared for without the ER'}
          </h3>
          <p style={edStyles.sub}>
            {edNeeded
              ? 'Your symptoms are best checked in person at the emergency department today.'
              : 'You likely do not need the emergency room. We can help you book the right care below.'}
          </p>
        </div>
      </div>

      {pathway.care_plan && pathway.care_plan.length > 0 && (
        <div style={edStyles.planWrap}>
          <span style={edStyles.planHeading}>What to do next</span>
          {pathway.care_plan.map((opt: CarePlanOption, i) => (
            <div key={i} style={edStyles.planItem}>
              <span style={edStyles.planTitle}>{opt.title}</span>
              <p style={edStyles.planDesc}>{opt.description}</p>
              <p style={edStyles.planAction}>→ {opt.recommended_action}</p>
            </div>
          ))}
        </div>
      )}

      {edNeeded && (
        <p style={edStyles.edCta}>
          If your symptoms feel severe or get worse, call <strong>911</strong> or go to the nearest ER right away.
        </p>
      )}
    </div>
  );
}

const edStyles: Record<string, React.CSSProperties> = {
  needed: {
    padding: '20px', borderRadius: 16, background: '#fffbeb', border: '2px solid #f59e0b',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  avoidable: {
    padding: '20px', borderRadius: 16, background: '#f0fdf4', border: '2px solid #179c88',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  head: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: '1.75rem', lineHeight: 1, flexShrink: 0 },
  titleNeeded: { fontSize: '1.125rem', fontWeight: 800, color: '#92400e', margin: 0 },
  titleAvoidable: { fontSize: '1.125rem', fontWeight: 800, color: '#0f766e', margin: 0 },
  sub: { fontSize: '0.875rem', color: '#4b5563', margin: '4px 0 0' },
  recommendation: { fontSize: '0.9375rem', color: '#172b35', margin: 0, lineHeight: 1.5 },
  metrics: { display: 'flex', gap: 24 },
  metric: { display: 'flex', flexDirection: 'column', gap: 2 },
  metricLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#6b7c84', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  metricValue: { fontSize: '1rem', fontWeight: 700, color: '#172b35', textTransform: 'capitalize' },
  edCta: {
    fontSize: '0.875rem', color: '#92400e', margin: 0, padding: '10px 12px',
    background: 'rgba(245,158,11,0.12)', borderRadius: 10,
  },
  planWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  planHeading: {
    fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  planItem: {
    padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 2,
  },
  planItemHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planTitle: { fontSize: '0.875rem', fontWeight: 700, color: '#172b35' },
  planUrgency: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.05)',
  },
  planDesc: { fontSize: '0.8125rem', color: '#4b5563', margin: 0 },
  planAction: { fontSize: '0.8125rem', color: '#0f766e', fontWeight: 600, margin: 0 },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: '700px',
    margin: '0 auto',
    padding: '0 16px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  emergencyBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#fff5f5',
    border: '2px solid #d92d20',
    borderRadius: '16px',
    marginTop: '24px',
  },
  emergencyIcon: {
    fontSize: '2.5rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  emergencyTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#d92d20',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  emergencyBody: {
    fontSize: '1rem',
    color: '#172b35',
    fontWeight: 600,
    marginBottom: '4px',
  },
  emergencyNote: {
    fontSize: '0.875rem',
    color: '#6b7c84',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#f0fdf4',
    border: '2px solid #179c88',
    borderRadius: '16px',
    marginTop: '24px',
  },
  successIcon: {
    flexShrink: 0,
  },
  successTitle: {
    fontSize: '1.375rem',
    fontWeight: 800,
    color: '#179c88',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  successBody: {
    fontSize: '0.9375rem',
    color: '#172b35',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#fffbeb',
    border: '2px solid #f59e0b',
    borderRadius: '16px',
    marginTop: '24px',
  },
  errorIcon: {
    fontSize: '2rem',
    flexShrink: 0,
  },
  errorTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#92400e',
    marginBottom: '6px',
  },
  errorBody: {
    fontSize: '0.9375rem',
    color: '#78350f',
  },
  section: {
    padding: '20px',
    backgroundColor: '#f8fafb',
    border: '1px solid #e3e8ea',
    borderRadius: '12px',
  },
  sectionTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#172b35',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
  },
  flagList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  flagItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  flagDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#d92d20',
    flexShrink: 0,
  },
  flagLabel: {
    fontSize: '0.9375rem',
    color: '#d92d20',
    fontWeight: 500,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
  },
  flagAnswers: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  flagAnswerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #e3e8ea',
  },
  flagAnswerLabel: {
    fontSize: '0.875rem',
    color: '#172b35',
  },
  flagAnswerBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  badgeYes: {
    backgroundColor: '#fff5f5',
    color: '#d92d20',
    border: '1px solid #fca5a5',
  },
  badgeNo: {
    backgroundColor: '#f0fdf4',
    color: '#179c88',
    border: '1px solid #a7f3d0',
  },
  pathwayLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
  },
  pathwayLoadingDots: {
    display: 'flex',
    gap: '4px',
  },
  pathwayDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#12617e',
    display: 'inline-block',
    animation: 'dotBounce 1.2s ease-in-out infinite',
  },
  pathwayLoadingText: {
    fontSize: '0.875rem',
    color: '#6b7c84',
  },
  pathwayResult: {},
  pathwayContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pathwayRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #e3e8ea',
  },
  pathwayKey: {
    fontSize: '0.875rem',
    color: '#6b7c84',
    fontWeight: 600,
  },
  pathwayVal: {
    fontSize: '0.875rem',
    color: '#172b35',
  },
  meta: {
    fontSize: '0.8125rem',
    color: '#6b7c84',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '8px',
  },
  newChatBtn: {
    minWidth: '220px',
  },
};
