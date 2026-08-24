/**
 * CarePath — KPI card used across the Care Manager dashboards.
 * Clickable when an onClick handler is supplied.
 */

import React from 'react';
import { Skeleton } from './States';

export type KpiTone = 'coral' | 'rose' | 'peach' | 'neutral' | 'dark';

export default function KpiCard({
  icon,
  label,
  value,
  hint,
  trend,
  tone = 'neutral',
  loading = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  /** Pass null/undefined to render an explicit N/A instead of a fabricated number. */
  value: number | string | null | undefined;
  hint?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; text: string };
  tone?: KpiTone;
  loading?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);

  const display =
    value === null || value === undefined || value === ''
      ? <span className="cp-metric-na" title="Not available from backend">N/A</span>
      : typeof value === 'number'
        ? value.toLocaleString()
        : value;

  const body = (
    <>
      <span className={`kpi__icon kpi__icon--${tone}`} aria-hidden="true">{icon}</span>
      <span className="kpi__body">
        <span className="kpi__label">{label}</span>
        {loading ? (
          <Skeleton height={26} width="60%" style={{ margin: '2px 0' }} />
        ) : (
          <span className="kpi__value">{display}</span>
        )}
        {loading ? (
          <Skeleton height={10} width="45%" />
        ) : trend ? (
          <span className={`kpi__trend kpi__trend--${trend.direction}`}>
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '—'} {trend.text}
          </span>
        ) : hint ? (
          <span className="kpi__hint">{hint}</span>
        ) : null}
      </span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={`kpi kpi--interactive${tone === 'dark' ? ' kpi--dark' : ''}`} onClick={onClick} aria-label={`${label}. View details`}>
        {body}
      </button>
    );
  }
  return <div className={`kpi${tone === 'dark' ? ' kpi--dark' : ''}`}>{body}</div>;
}
