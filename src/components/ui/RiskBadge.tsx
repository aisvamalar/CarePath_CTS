/**
 * CarePath — Risk level badge.
 * Subtle semantic colour only; never floods the whole row.
 */

export type RiskLevel = 'high' | 'medium' | 'low' | 'unknown';

/** Normalise the backend's risk_level string (low | medium | high). */
export function normalizeRisk(level?: string | null): RiskLevel {
  const v = (level ?? '').toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium' || v === 'moderate') return 'medium';
  if (v === 'low') return 'low';
  return 'unknown';
}

/** Derive a risk level from a 0..1 score using the backend's thresholds. */
export function riskFromScore(score?: number | null): RiskLevel {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

const LABELS: Record<RiskLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  unknown: 'Unrated',
};

export default function RiskBadge({
  level,
  score,
  showScore = false,
}: {
  level?: string | null;
  score?: number | null;
  showScore?: boolean;
}) {
  const risk = level ? normalizeRisk(level) : riskFromScore(score);
  const pct = score !== null && score !== undefined ? Math.round(score * 100) : null;

  return (
    <span className={`cp-risk cp-risk--${risk}`}>
      <span className="cp-risk__dot" aria-hidden="true" />
      {LABELS[risk]}
      {showScore && pct !== null && <span className="cp-risk__score">{pct}%</span>}
    </span>
  );
}
