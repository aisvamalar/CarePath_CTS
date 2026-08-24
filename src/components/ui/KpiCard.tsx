/**
 * CarePath — KPI card used across the Care Manager dashboards.
 *
 * Layout: icon + label on one row, large value, trend/hint line, then an
 * optional sparkline strip along the bottom. Clickable when `onClick` is set.
 *
 * The sparkline only renders when the caller supplies a real series — there is
 * no synthetic fallback, so a card without backend history simply omits it.
 */

import React from 'react';
import { Skeleton } from './States';

export type KpiTone = 'coral' | 'rose' | 'peach' | 'neutral' | 'dark';
export type KpiAccent = 'coral' | 'red' | 'green' | 'blue';

export interface KpiTrend {
  direction: 'up' | 'down' | 'flat';
  text: string;
}

export default function KpiCard({
  icon,
  label,
  value,
  hint,
  trend,
  tone = 'neutral',
  accent = 'coral',
  sparkline,
  loading = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  /** Pass null/undefined to render an explicit N/A instead of a fabricated number. */
  value: number | string | null | undefined;
  hint?: string;
  trend?: KpiTrend;
  tone?: KpiTone;
  /** Colour of the sparkline stroke/fill. */
  accent?: KpiAccent;
  /** Real historical series. Omit when the backend has no history for this metric. */
  sparkline?: number[];
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
      <span className="kpi__top">
        <span className="kpi__icon" aria-hidden="true">{icon}</span>
        <span className="kpi__label">{label}</span>
      </span>

      {loading ? (
        <Skeleton height={30} width="55%" style={{ margin: '6px 0' }} />
      ) : (
        <span className="kpi__value">{display}</span>
      )}

      {loading ? (
        <Skeleton height={11} width="60%" />
      ) : trend ? (
        <span className={`kpi__trend kpi__trend--${trend.direction}`}>
          <span aria-hidden="true">
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '—'}
          </span>
          {trend.text}
        </span>
      ) : hint ? (
        <span className="kpi__hint">{hint}</span>
      ) : null}

      {!loading && sparkline && sparkline.length > 1 && (
        <Sparkline series={sparkline} accent={accent} />
      )}
    </>
  );

  const cls = `kpi${tone === 'dark' ? ' kpi--dark' : ''}${interactive ? ' kpi--interactive' : ''}`;

  if (interactive) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={`${label}. View details`}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

const ACCENT_HEX: Record<KpiAccent, string> = {
  coral: '#f2846b',
  red: '#e06a4f',
  green: '#4caf82',
  blue: '#5b9bd5',
};

/**
 * Minimal inline sparkline. Uses a viewBox so it scales to the card width
 * without a resize observer, and draws a soft area fill under the line.
 */
function Sparkline({ series, accent }: { series: number[]; accent: KpiAccent }) {
  const W = 100;
  const H = 28;
  const stroke = ACCENT_HEX[accent];
  const id = React.useId();

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = W / (series.length - 1);

  // Leave 2px breathing room top and bottom so the stroke is never clipped.
  const points = series.map((v, i) => {
    const x = i * stepX;
    const y = H - 2 - ((v - min) / span) * (H - 4);
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;

  return (
    <span className="kpi__spark" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
        <defs>
          <linearGradient id={`kpiSpark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#kpiSpark-${id})`} />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
