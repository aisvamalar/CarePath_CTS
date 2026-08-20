import React from 'react';
import type { SafetyEvaluationResponse, IntakeFeatures, RedFlagsPayload } from '../services/api';

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

const FLAG_LABELS: Record<keyof RedFlagsPayload, string> = {
  chest_pain: 'Chest Pain',
  difficulty_breathing: 'Difficulty Breathing',
  altered_consciousness: 'Altered Consciousness',
  severe_bleeding: 'Severe Bleeding',
  stroke_symptoms: 'Stroke Symptoms',
  suicidal_ideation: 'Suicidal Ideation',
  anaphylaxis: 'Anaphylaxis',
  high_fever: 'High Fever',
  unable_to_walk: 'Unable to Walk',
  severe_abdominal_pain: 'Severe Abdominal Pain',
};

interface VerdictCardProps {
  result: SafetyEvaluationResponse;
  intakeFeatures: IntakeFeatures | null;
  redFlags: Partial<RedFlagsPayload> | null;
  onNewChat: () => void;
  pathwayLoading?: boolean;
  pathwayResult?: Record<string, unknown> | null;
}

export default function VerdictCard({
  result,
  intakeFeatures,
  redFlags,
  onNewChat,
  pathwayLoading,
  pathwayResult,
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
      ) : (
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

      {/* ML Pathway result (no emergency) */}
      {!isEmergency && !isError && (
        <div style={styles.section}>
          {pathwayLoading ? (
            <div style={styles.pathwayLoading}>
              <div style={styles.pathwayLoadingDots}>
                {[0,1,2].map((i) => (
                  <span key={i} style={{ ...styles.pathwayDot, animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
              <p style={styles.pathwayLoadingText}>Loading clinical pathway…</p>
            </div>
          ) : pathwayResult ? (
            <div style={styles.pathwayResult}>
              <h3 style={styles.sectionTitle}>Clinical Pathway</h3>
              <div style={styles.pathwayContent}>
                {Object.entries(pathwayResult).map(([key, val]) => (
                  <div key={key} style={styles.pathwayRow}>
                    <span style={styles.pathwayKey}>{formatKey(key)}</span>
                    <span style={styles.pathwayVal}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Assessment Summary */}
      {intakeFeatures && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Assessment Summary</h3>
          <div style={styles.summaryGrid}>
            {intakeFeatures.chief_complaint && (
              <SummaryItem label="Chief Complaint" value={intakeFeatures.chief_complaint} />
            )}
            {intakeFeatures.symptom_onset && (
              <SummaryItem label="Onset" value={intakeFeatures.symptom_onset} />
            )}
            {intakeFeatures.pain_scale != null && (
              <SummaryItem label="Pain Scale" value={`${intakeFeatures.pain_scale} / 10`} />
            )}
            {intakeFeatures.location && (
              <SummaryItem label="Location" value={intakeFeatures.location} />
            )}
            <SummaryItem label="Emergency Screening" value="Completed" />
            <SummaryItem
              label="Result"
              value={isEmergency ? 'Emergency Detected' : isError ? 'Error' : 'No Emergency'}
              highlight={isEmergency ? 'emergency' : isError ? 'error' : 'success'}
            />
          </div>
        </div>
      )}

      {/* Red flag answers */}
      {redFlags && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Red Flag Answers</h3>
          <div style={styles.flagAnswers}>
            {(Object.entries(redFlags) as Array<[keyof RedFlagsPayload, boolean]>).map(([field, val]) => (
              <div key={field} style={styles.flagAnswerRow}>
                <span style={styles.flagAnswerLabel}>{FLAG_LABELS[field]}</span>
                <span
                  style={{
                    ...styles.flagAnswerBadge,
                    ...(val ? styles.badgeYes : styles.badgeNo),
                  }}
                >
                  {val ? 'Yes' : 'No'}
                </span>
              </div>
            ))}
          </div>
        </div>
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

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'emergency' | 'success' | 'error';
}) {
  return (
    <div style={summaryStyles.item}>
      <span style={summaryStyles.label}>{label}</span>
      <span
        style={{
          ...summaryStyles.value,
          ...(highlight === 'emergency' ? summaryStyles.emergency : {}),
          ...(highlight === 'success' ? summaryStyles.success : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

const summaryStyles: Record<string, React.CSSProperties> = {
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7c84',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: '0.9375rem',
    color: '#172b35',
    fontWeight: 500,
  },
  emergency: {
    color: '#d92d20',
    fontWeight: 700,
  },
  success: {
    color: '#179c88',
    fontWeight: 700,
  },
};

function formatKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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
