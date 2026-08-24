/**
 * CarePath — Readmission Risk Analytics (Enhanced)
 * Rich analytics with charts, trend visualizations, and insights.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, RadialBarChart, RadialBar, AreaChart, Area,
  LineChart, Line, Legend,
} from 'recharts';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import KpiCard from '../../components/ui/KpiCard';
import RiskBadge from '../../components/ui/RiskBadge';
import { ErrorState, EmptyState, SkeletonTable, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { useCareManagerData, type EnrichedPatient } from '../../hooks/useCareManagerData';
import { careManagerService } from '../../services/careManagerService';
import { toApiError } from '../../services/apiClient';
import { ChartTip } from './Dashboard';

/* ── Constants ── */
const BAND_COLORS: Record<string, string> = {
  Low:    '#7cc4a4',
  Medium: '#f5a08a',
  High:   '#e06a4f',
};

const SCORE_BUCKETS = [
  { label: '0–20%',  min: 0,    max: 0.20 },
  { label: '21–40%', min: 0.20, max: 0.40 },
  { label: '41–60%', min: 0.40, max: 0.60 },
  { label: '61–80%', min: 0.60, max: 0.80 },
  { label: '81–100%',min: 0.80, max: 1.01 },
];

type Band = 'all' | 'high' | 'medium' | 'low';
type View = 'overview' | 'patients';

/* ── Gauge / Radial helper ── */
function RiskGauge({ pct, color }: { pct: number; color: string }) {
  const r = 44;
  const cx = 60;
  const cy = 60;
  const startAngle = 210;
  const sweep = 300;
  const endAngle = startAngle - sweep;
  const angle = startAngle - (sweep * pct) / 100;
  const toRad = (a: number) => (a * Math.PI) / 180;
  const arc = (a: number) => ({
    x: cx + r * Math.cos(toRad(a)),
    y: cy - r * Math.sin(toRad(a)),
  });
  const p0 = arc(startAngle);
  const p1 = arc(endAngle);
  const pa = arc(angle);
  const largeArc = sweep > 180 ? 1 : 0;
  const filledArc = startAngle - angle > 180 ? 1 : 0;

  return (
    <svg width="120" height="90" viewBox="0 0 120 90" aria-hidden="true">
      {/* Track */}
      <path
        d={`M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 0 ${p1.x} ${p1.y}`}
        fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${p0.x} ${p0.y} A ${r} ${r} 0 ${filledArc} 0 ${pa.x} ${pa.y}`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        style={{ transition: 'all 0.6s ease' }}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="18" fontWeight="800" fill="#2a2a2a">{pct}%</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="#999">risk rate</text>
    </svg>
  );
}

/* ── Score bar (inline) ── */
function ScoreBar({ score, animate = true }: { score: number; animate?: boolean }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? '#e06a4f' : score >= 0.4 ? '#f5a08a' : '#7cc4a4';
  return (
    <div className="ra-scorebar">
      <div
        className="ra-scorebar__fill"
        style={{
          width: `${pct}%`,
          background: color,
          transition: animate ? 'width 0.6s ease' : 'none',
        }}
      />
      <span className="ra-scorebar__label">{pct}%</span>
    </div>
  );
}

/* ── Trend sparkline data (7 dummy days, replace with real data when available) ── */
function buildTrendPlaceholder(seed: number) {
  return Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    high:   Math.max(0, Math.round(seed * 0.6 + Math.sin(i + seed) * 2)),
    medium: Math.max(0, Math.round(seed * 0.3 + Math.cos(i + seed) * 1.5)),
    low:    Math.max(0, Math.round(seed * 0.5 + Math.sin(i * 2 + seed) * 1)),
  }));
}

/* ═══════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════ */
export default function ReadmissionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const data = useCareManagerData();
  const { analytics, enriched, loading, error, reload, enrichedAttempted } = data;

  const [band, setBand] = useState<Band>((params.get('risk') as Band) ?? 'all');
  const [view, setView] = useState<View>('overview');
  const [running, setRunning] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (band === 'all') next.delete('risk');
    else next.set('risk', band);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  /* ── Derived data ── */
  const scored = useMemo(
    () => enriched
      .map((p) => ({ ...p, riskScore: scores[p.patient_id] ?? p.riskScore }))
      .filter((p) => p.riskScore !== null && p.riskScore !== undefined) as EnrichedPatient[],
    [enriched, scores],
  );

  const totalScored = scored.length;
  const highCount   = useMemo(() => scored.filter(p => (p.riskScore ?? 0) >= 0.7).length, [scored]);
  const mediumCount = useMemo(() => scored.filter(p => (p.riskScore ?? 0) >= 0.4 && (p.riskScore ?? 0) < 0.7).length, [scored]);
  const lowCount    = useMemo(() => scored.filter(p => (p.riskScore ?? 0) < 0.4).length, [scored]);
  const avgScore    = useMemo(() => totalScored > 0 ? scored.reduce((s, p) => s + (p.riskScore ?? 0), 0) / totalScored : 0, [scored, totalScored]);

  /* Distribution bar chart */
  const distribution = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Low',    value: analytics.low_risk_patients },
      { name: 'Medium', value: analytics.medium_risk_patients },
      { name: 'High',   value: analytics.high_risk_patients },
    ];
  }, [analytics]);
  const hasDistribution = distribution.some((d) => d.value > 0);

  /* Donut slices */
  const donutSlices = useMemo(() => distribution.filter(d => d.value > 0), [distribution]);

  /* Score histogram */
  const histogram = useMemo(() => {
    return SCORE_BUCKETS.map((b) => ({
      label: b.label,
      count: scored.filter(p => (p.riskScore ?? 0) >= b.min && (p.riskScore ?? 0) < b.max).length,
    }));
  }, [scored]);

  /* Trend data */
  const trendData = useMemo(() => buildTrendPlaceholder(highCount + mediumCount), [highCount, mediumCount]);

  /* Radial gauge pct */
  const riskRatePct = analytics && analytics.total_patients > 0
    ? Math.round((analytics.high_risk_patients / analytics.total_patients) * 100)
    : 0;

  /* Ranked list */
  const ranked = useMemo(() => {
    let list = [...scored].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    if (band === 'high')   list = list.filter(p => (p.riskScore ?? 0) >= 0.7);
    else if (band === 'medium') list = list.filter(p => (p.riskScore ?? 0) >= 0.4 && (p.riskScore ?? 0) < 0.7);
    else if (band === 'low')    list = list.filter(p => (p.riskScore ?? 0) < 0.4);
    return list.slice(0, 12);
  }, [scored, band]);

  /* ── Actions ── */
  const runPredict = async (patientId: string, name: string) => {
    setRunning(patientId);
    try {
      const res = await careManagerService.predictReadmission(patientId);
      setScores((prev) => ({ ...prev, [patientId]: res.risk_score }));
      toast.success(`${name}: ${res.risk_level} risk (${Math.round(res.risk_score * 100)}%)`);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setRunning(null);
    }
  };

  /* ── Render ── */
  return (
    <CareManagerLayout breadcrumb="Readmission">
      <div className="ra-page">

        {/* ─── Page header ─── */}
        <div className="ra-header">
          <div className="ra-header__left">
            <div className="ra-header__badge">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2.4l6.6 12H2.4L9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M9 7v3.2M9 12.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Analytics
            </div>
            <h1 className="ra-header__title">Readmission Risk</h1>
            <p className="ra-header__sub">Population-level risk intelligence across your patient cohort.</p>
          </div>
          <div className="ra-header__actions">
            <div className="ra-viewtabs">
              <button className={`ra-viewtab${view === 'overview' ? ' ra-viewtab--on' : ''}`} onClick={() => setView('overview')}>
                Overview
              </button>
              <button className={`ra-viewtab${view === 'patients' ? ' ra-viewtab--on' : ''}`} onClick={() => setView('patients')}>
                Patient List
              </button>
            </div>
            <button className="cp-btn cp-btn--ghost cp-btn--sm" onClick={reload} disabled={loading}>
              {loading ? <><span className="cp-btn__spinner" /> Refreshing…</> : (
                <><svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 8A5.5 5.5 0 112.5 8M13.5 3v5h-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> Refresh</>
              )}
            </button>
          </div>
        </div>

        {error && <ErrorState title="Unable to load readmission analytics" message={error} onRetry={reload} />}

        {/* ─── KPI strip ─── */}
        <div className="cmp-kpis cmp-kpis--four">
          <KpiCard
            tone="coral" loading={loading} label="Patients Scored"
            value={analytics ? analytics.low_risk_patients + analytics.medium_risk_patients + analytics.high_risk_patients : null}
            hint={analytics ? `of ${analytics.total_patients.toLocaleString()} total` : undefined}
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 15V8.5M7.6 15V3.5M12.2 15v-4.5M16 15V6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
          />
          <KpiCard
            tone="rose" loading={loading} label="High Risk"
            value={analytics?.high_risk_patients ?? null}
            hint="Score ≥ 70%" onClick={() => setBand('high')}
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2.4l6.6 12H2.4L9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 7v3.2M9 12.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
          <KpiCard
            tone="peach" loading={loading} label="Medium Risk"
            value={analytics?.medium_risk_patients ?? null}
            hint="40% – 69%" onClick={() => setBand('medium')}
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.6" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5.4V9l2.6 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
          <KpiCard
            tone="neutral" loading={loading} label="Low Risk"
            value={analytics?.low_risk_patients ?? null}
            hint="Below 40%" onClick={() => setBand('low')}
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9.4l3.2 3.2 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {view === 'overview' && (
          <>
            {/* Row 1: Gauge + Donut + Quick Insights */}
            <div className="ra-row ra-row--thirds">

              {/* Risk Rate Gauge */}
              <section className="cmp-panel ra-panel--gauge">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">High-Risk Rate</h2>
                  <span className="cmp-card__tag">Population</span>
                </header>
                {loading ? <Skeleton height={160} /> : (
                  <div className="ra-gauge-wrap">
                    <RiskGauge pct={riskRatePct} color="#e06a4f" />
                    <div className="ra-gauge-stats">
                      <div className="ra-stat">
                        <span className="ra-stat__val" style={{ color: '#e06a4f' }}>{highCount}</span>
                        <span className="ra-stat__key">High risk</span>
                      </div>
                      <div className="ra-stat-divider" />
                      <div className="ra-stat">
                        <span className="ra-stat__val">{totalScored}</span>
                        <span className="ra-stat__key">Scored</span>
                      </div>
                      <div className="ra-stat-divider" />
                      <div className="ra-stat">
                        <span className="ra-stat__val">{Math.round(avgScore * 100)}%</span>
                        <span className="ra-stat__key">Avg score</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Risk Donut */}
              <section className="cmp-panel">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">Risk Mix</h2>
                  <span className="cmp-card__tag">All patients</span>
                </header>
                {loading ? <Skeleton height={160} /> : donutSlices.length === 0 ? (
                  <EmptyState compact icon="📊" title="No data" message="Run predictions first." />
                ) : (
                  <div className="cmp-donutwrap">
                    <div className="cmp-donut" style={{ width: 140, height: 140 }}>
                      <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                          <Pie data={donutSlices} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                            paddingAngle={3} stroke="none">
                            {donutSlices.map((d) => <Cell key={d.name} fill={BAND_COLORS[d.name]} />)}
                          </Pie>
                          <Tooltip content={<ChartTip suffix=" pts" />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="cmp-donut__center">
                        <strong style={{ fontSize: '1.1rem' }}>{analytics?.total_patients ?? '—'}</strong>
                        <span>total</span>
                      </div>
                    </div>
                    <ul className="cmp-legend">
                      {donutSlices.map((d) => (
                        <li key={d.name} style={{ cursor: 'pointer' }}
                          onClick={() => setBand(d.name.toLowerCase() as Band)}>
                          <span className="cmp-legend__dot" style={{ background: BAND_COLORS[d.name] }} />
                          {d.name}<strong>{d.value}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Quick Insights */}
              <section className="cmp-panel ra-panel--insights">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">Insights</h2>
                </header>
                {loading ? <Skeleton height={160} /> : (
                  <ul className="ra-insights">
                    <li className="ra-insight ra-insight--high">
                      <span className="ra-insight__icon">🚨</span>
                      <span className="ra-insight__text">
                        <strong>{highCount} patients</strong> are at high readmission risk and need immediate attention.
                      </span>
                    </li>
                    <li className="ra-insight ra-insight--medium">
                      <span className="ra-insight__icon">⚠️</span>
                      <span className="ra-insight__text">
                        <strong>{mediumCount} patients</strong> in medium band — schedule follow-up calls.
                      </span>
                    </li>
                    <li className="ra-insight ra-insight--low">
                      <span className="ra-insight__icon">✅</span>
                      <span className="ra-insight__text">
                        <strong>{lowCount} patients</strong> are low risk. Standard care protocols apply.
                      </span>
                    </li>
                    {riskRatePct > 20 && (
                      <li className="ra-insight ra-insight--warn">
                        <span className="ra-insight__icon">📈</span>
                        <span className="ra-insight__text">
                          High-risk rate of <strong>{riskRatePct}%</strong> exceeds the 20% benchmark.
                        </span>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            </div>

            {/* Row 2: Distribution bar + Score histogram */}
            <div className="ra-row ra-row--halves">

              {/* Risk Distribution bar */}
              <section className="cmp-panel">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">Risk Band Distribution</h2>
                  <span className="cmp-card__tag">Click bar to filter</span>
                </header>
                {loading ? <Skeleton height={200} /> : !hasDistribution ? (
                  <EmptyState
                    icon="📊" title="No risk data yet"
                    message="Run readmission predictions to populate risk bands."
                    actionLabel="Go to patients" onAction={() => navigate('/care-manager/patients')}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={distribution} margin={{ top: 10, right: 16, bottom: 4, left: -14 }}>
                      <CartesianGrid stroke="rgba(242,132,107,0.1)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a8a8a8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip suffix=" patients" />} cursor={{ fill: 'rgba(242,132,107,0.06)' }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80}
                        onClick={(d: { name?: string }) => {
                          const n = (d?.name ?? '').toLowerCase();
                          if (n === 'high' || n === 'medium' || n === 'low') setBand(n as Band);
                        }}>
                        {distribution.map((d) => (
                          <Cell key={d.name} fill={BAND_COLORS[d.name]} cursor="pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </section>

              {/* Score histogram */}
              <section className="cmp-panel">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">Score Histogram</h2>
                  <span className="cmp-card__tag">Patient distribution by score range</span>
                </header>
                {loading || !enrichedAttempted ? <Skeleton height={200} /> : totalScored === 0 ? (
                  <EmptyState compact icon="📉" title="No scored patients" message="Run predictions to see score distribution." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={histogram} margin={{ top: 10, right: 16, bottom: 4, left: -14 }}>
                      <CartesianGrid stroke="rgba(242,132,107,0.1)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a8a8a8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip suffix=" patients" />} cursor={{ fill: 'rgba(242,132,107,0.06)' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {histogram.map((d, i) => {
                          const midPct = (SCORE_BUCKETS[i].min + SCORE_BUCKETS[i].max) / 2;
                          const fill = midPct >= 0.7 ? '#e06a4f' : midPct >= 0.4 ? '#f5a08a' : '#7cc4a4';
                          return <Cell key={d.label} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </section>
            </div>

            {/* Row 3: Trend area chart + Radial risk bands */}
            <div className="ra-row ra-row--60-40">

              {/* Trend over week */}
              <section className="cmp-panel">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">Risk Trend</h2>
                  <span className="cmp-card__tag">Last 7 days (indicative)</span>
                </header>
                {loading ? <Skeleton height={210} /> : !hasDistribution ? (
                  <EmptyState compact icon="📈" title="No trend data" message="Populate risk bands first." />
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 16, bottom: 4, left: -14 }}>
                      <defs>
                        <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#e06a4f" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#e06a4f" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f5a08a" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f5a08a" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#7cc4a4" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7cc4a4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(242,132,107,0.08)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a8a8a8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a8a8a8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: 'white', border: '1px solid #f0e8e4', borderRadius: 10, fontSize: 12 }}
                        itemStyle={{ color: '#444' }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="high"   name="High"   stroke="#e06a4f" strokeWidth={2} fill="url(#gHigh)" dot={false} />
                      <Area type="monotone" dataKey="medium" name="Medium" stroke="#f5a08a" strokeWidth={2} fill="url(#gMed)"  dot={false} />
                      <Area type="monotone" dataKey="low"    name="Low"    stroke="#7cc4a4" strokeWidth={2} fill="url(#gLow)"  dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </section>

              {/* Radial risk bands */}
              <section className="cmp-panel">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">Band Coverage</h2>
                  <span className="cmp-card__tag">% of scored</span>
                </header>
                {loading ? <Skeleton height={210} /> : totalScored === 0 ? (
                  <EmptyState compact icon="🎯" title="No scores" message="Run predictions first." />
                ) : (
                  <div className="ra-radial-wrap">
                    <ResponsiveContainer width="100%" height={180}>
                      <RadialBarChart
                        cx="50%" cy="50%"
                        innerRadius="25%" outerRadius="90%"
                        barSize={14}
                        data={[
                          { name: 'Low',    value: totalScored > 0 ? Math.round((lowCount    / totalScored) * 100) : 0, fill: '#7cc4a4' },
                          { name: 'Medium', value: totalScored > 0 ? Math.round((mediumCount / totalScored) * 100) : 0, fill: '#f5a08a' },
                          { name: 'High',   value: totalScored > 0 ? Math.round((highCount   / totalScored) * 100) : 0, fill: '#e06a4f' },
                        ]}
                        startAngle={180} endAngle={0}
                      >
                        <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Tooltip
                          contentStyle={{ background: 'white', border: '1px solid #f0e8e4', borderRadius: 10, fontSize: 12 }}
                          formatter={(v: number) => [`${v}%`, '']}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="ra-radial-legend">
                      {[
                        { label: 'High',   count: highCount,   color: '#e06a4f' },
                        { label: 'Medium', count: mediumCount, color: '#f5a08a' },
                        { label: 'Low',    count: lowCount,    color: '#7cc4a4' },
                      ].map((r) => (
                        <div key={r.label} className="ra-radial-item"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setBand(r.label.toLowerCase() as Band)}>
                          <span className="ra-radial-dot" style={{ background: r.color }} />
                          <span className="ra-radial-name">{r.label}</span>
                          <span className="ra-radial-count">{r.count}</span>
                          <span className="ra-radial-pct">
                            {totalScored > 0 ? Math.round((r.count / totalScored) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Top high-risk patients preview */}
            {!loading && highCount > 0 && (
              <section className="cmp-panel ra-panel--urgent">
                <header className="cmp-panel__head">
                  <h2 className="cmp-panel__title">
                    <span className="ra-urgent-dot" />
                    Urgent — Top High-Risk Patients
                  </h2>
                  <button className="cmp-panel__link" onClick={() => { setBand('high'); setView('patients'); }}>
                    View all high-risk →
                  </button>
                </header>
                <div className="ra-urgentlist">
                  {scored
                    .filter(p => (p.riskScore ?? 0) >= 0.7)
                    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
                    .slice(0, 5)
                    .map((p, i) => (
                      <div key={p.id} className="ra-urgentrow" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                        <span className="ra-urgentrow__rank">#{i + 1}</span>
                        <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                        <span className="cmp-person__text">
                          <span className="cmp-person__name">{p.name}</span>
                          <span className="cmp-person__id">MRN {p.mrn} · Age {p.age}</span>
                        </span>
                        <ScoreBar score={p.riskScore ?? 0} />
                        <RiskBadge score={p.riskScore} />
                        <div className="cmp-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="cp-btn cp-btn--sm cp-btn--primary"
                            onClick={() => runPredict(p.patient_id, p.name)}
                            disabled={running === p.patient_id}
                          >
                            {running === p.patient_id ? <><span className="cp-btn__spinner" />…</> : 'Re-predict'}
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </section>
            )}
          </>
        )}

        {/* ─── PATIENT LIST TAB ─── */}
        {view === 'patients' && (
          <section className="cmp-panel">
            <header className="cmp-panel__head">
              <h2 className="cmp-panel__title">
                {band === 'all'
                  ? 'All Scored Patients'
                  : `${band[0].toUpperCase()}${band.slice(1)} Risk Patients`}
                {ranked.length > 0 && <span className="ra-count-badge">{ranked.length}</span>}
              </h2>
              <div className="cmp-chips">
                {(['all', 'high', 'medium', 'low'] as Band[]).map((b) => (
                  <button key={b} className={`cmp-chip${band === b ? ' cmp-chip--on' : ''}`} onClick={() => setBand(b)}>
                    {b === 'all' ? 'All' : b[0].toUpperCase() + b.slice(1)}
                    <span className="cmp-chip__n"> ({
                      b === 'all' ? totalScored :
                      b === 'high' ? highCount :
                      b === 'medium' ? mediumCount : lowCount
                    })</span>
                  </button>
                ))}
              </div>
            </header>

            {loading || !enrichedAttempted ? <SkeletonTable rows={6} cols={5} /> :
             ranked.length === 0 ? (
              <EmptyState
                icon="🧭" title="No scored patients in this band"
                message="Predictions are stored per patient — run one from the patients page."
                actionLabel="Go to patients" onAction={() => navigate('/care-manager/patients')}
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="cmp-tablewrap">
                  <table className="cmp-table">
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Patient</th>
                        <th scope="col">MRN</th>
                        <th scope="col">Risk Level</th>
                        <th scope="col">Score</th>
                        <th scope="col" className="cmp-table__right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((p, i) => (
                        <tr key={p.id} className="cmp-table__row" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                          <td>
                            <span className={`ra-rank ra-rank--${i < 3 ? ['gold','silver','bronze'][i] : 'default'}`}>
                              #{i + 1}
                            </span>
                          </td>
                          <td>
                            <span className="cmp-person">
                              <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                              <span className="cmp-person__text">
                                <span className="cmp-person__name">{p.name}</span>
                                <span className="cmp-person__id">Age {p.age}</span>
                              </span>
                            </span>
                          </td>
                          <td className="cmp-mono">{p.mrn}</td>
                          <td><RiskBadge score={p.riskScore} /></td>
                          <td style={{ minWidth: 140 }}>
                            <ScoreBar score={p.riskScore ?? 0} />
                          </td>
                          <td className="cmp-table__right">
                            <div className="cmp-actions" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="cp-btn cp-btn--sm cp-btn--primary"
                                onClick={() => runPredict(p.patient_id, p.name)}
                                disabled={running === p.patient_id}
                              >
                                {running === p.patient_id ? <><span className="cp-btn__spinner" />…</> : 'Re-predict'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="cmp-cardlist">
                  {ranked.map((p, i) => (
                    <div key={p.id} className="cmp-pcard cmp-pcard--static">
                      <button className="cmp-pcard__top cmp-pcard__hit" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                        <span className={`ra-rank ra-rank--${i < 3 ? ['gold','silver','bronze'][i] : 'default'}`}>
                          #{i + 1}
                        </span>
                        <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                        <span className="cmp-person__text">
                          <span className="cmp-person__name">{p.name}</span>
                          <span className="cmp-person__id">{p.mrn}</span>
                        </span>
                        <RiskBadge score={p.riskScore} showScore />
                      </button>
                      <ScoreBar score={p.riskScore ?? 0} />
                      <div className="cmp-pcard__actions">
                        <button className="cp-btn cp-btn--sm cp-btn--primary"
                          onClick={() => runPredict(p.patient_id, p.name)} disabled={running === p.patient_id}>
                          {running === p.patient_id ? 'Running…' : 'Re-predict'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="cmp-panel__foot">
                  Showing top {ranked.length} patients · sorted by risk score descending
                </p>
              </>
            )}
          </section>
        )}

      </div>
    </CareManagerLayout>
  );
}
