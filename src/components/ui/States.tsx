/**
 * CarePath — Shared loading / empty / error states.
 * Every backend-driven screen uses these so behaviour stays consistent.
 */

import React from 'react';

// ── Skeletons ────────────────────────────────────────────────────────────────

export function Skeleton({
  height = 16,
  width = '100%',
  radius = 8,
  style,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="cp-skel"
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="cp-skel-card" aria-hidden="true">
      <Skeleton height={12} width="45%" />
      <Skeleton height={26} width="65%" />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <Skeleton key={i} height={10} width={`${80 - i * 12}%`} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="cp-skel-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="cp-skel-table__row" key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} height={12} width={c === 0 ? '70%' : '55%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Accessible live region announcing that data is loading. */
export function LoadingNote({ label = 'Loading data' }: { label?: string }) {
  return (
    <span className="cp-visually-hidden" role="status" aria-live="polite">
      {label}
    </span>
  );
}

// ── Error ────────────────────────────────────────────────────────────────────

export function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`cp-state cp-state--error${compact ? ' cp-state--compact' : ''}`} role="alert">
      <span className="cp-state__icon cp-state__icon--error" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 6v5M10 13.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <div className="cp-state__body">
        <p className="cp-state__title">{title}</p>
        <p className="cp-state__msg">{message}</p>
      </div>
      {onRetry && (
        <button className="cp-state__action" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

// ── Empty ────────────────────────────────────────────────────────────────────

export function EmptyState({
  icon = '📋',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`cp-state cp-state--empty${compact ? ' cp-state--compact' : ''}`}>
      <span className="cp-state__emoji" aria-hidden="true">{icon}</span>
      <div className="cp-state__body">
        <p className="cp-state__title">{title}</p>
        {message && <p className="cp-state__msg">{message}</p>}
      </div>
      {actionLabel && onAction && (
        <button className="cp-state__action cp-state__action--primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Metric fallback ──────────────────────────────────────────────────────────

/** Renders a value, or a clear N/A when the backend cannot supply the metric. */
export function MetricValue({ value, suffix = '' }: { value: number | string | null | undefined; suffix?: string }) {
  if (value === null || value === undefined || value === '') {
    return <span className="cp-metric-na" title="Not available from backend">N/A</span>;
  }
  return <>{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</>;
}
