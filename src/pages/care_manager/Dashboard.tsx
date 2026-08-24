/**
 * CarePath — Care Manager Dashboard
 * Command centre built entirely on live backend data.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import CareManagerRail from '../../components/care_manager/CareManagerRail';
import KpiCard from '../../components/ui/KpiCard';
import RiskBadge from '../../components/ui/RiskBadge';
import { ErrorState, EmptyState, SkeletonTable, Skeleton } from '../../components/ui/States';
import { useCareManagerData, type EnrichedPatient } from '../../hooks/useCareManagerData';
import { useFinancialMetrics } from '../../hooks/useFinancialData';

const RISK_COLORS = {
  high: '#e06a4f',
  medium: '#f5a08a',
  low: '#7cc4a4',
  unknown: '#d9d4d1',
};

const PLAN_COLORS = ['#f2846b', '#f5a08a', '#7cc4a4', '#d9d4d1'];

const DONUT_OUTER = 74;

type AttentionFilter = 'high' | 'monitoring' | 'all';

export default function CareManagerDashboard() {
  const navigate = useNavigate();
  const data = useCareManagerData();
  const { analytics, patients, enriched, tasks, loading, error, reload, enrichedAttempted } = data;
  
  // Financial data for KPIs
  const financial = useFinancialMetrics();

  const [filter, setFilter] = useState<AttentionFilter>('high');

  const today = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    [],
  );
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }, []);

  // ── Derived KPI values (null when the backend cannot supply them) ──
  const followUpsDue = useMemo(
    () => (enrichedAttempted ? data.appointments.length : null),
    [enrichedAttempted, data.appointments.length],
  );
  const tasksPending = useMemo(
    () => (enrichedAttempted ? tasks.filter((t) => t.status !== 'completed').length : null),
    [enrichedAttempted, tasks],
  );

  // ── Attention list ──
  const attention = useMemo(() => {
    let list: EnrichedPatient[] = enriched;
    if (filter === 'high') list = enriched.filter((p) => (p.riskScore ?? 0) >= 0.7);
    else if (filter === 'monitoring') {
      list = enriched.filter((p) => (p.riskScore ?? 0) >= 0.4 && (p.riskScore ?? 0) < 0.7);
    }
    return list.slice(0, 6);
  }, [enriched, filter]);

  const counts = useMemo(() => ({
    high: enriched.filter((p) => (p.riskScore ?? 0) >= 0.7).length,
    monitoring: enriched.filter((p) => (p.riskScore ?? 0) >= 0.4 && (p.riskScore ?? 0) < 0.7).length,
    all: enriched.length,
  }), [enriched]);

  // ── Workload donut from real care-plan tasks ──
  const workload = useMemo(() => {
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = tasks.filter((t) => t.status !== 'completed').length;
    const total = completed + pending;
    return {
      total,
      pct: total > 0 ? Math.round((completed / total) * 100) : null,
      slices: [
        { name: 'Completed', value: completed, color: '#7cc4a4' },
        { name: 'Pending', value: pending, color: '#f5a08a' },
      ].filter((s) => s.value > 0),
    };
  }, [tasks]);

  // ── Risk distribution donut from aggregate analytics ──
  const riskSlices = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Low risk', value: analytics.low_risk_patients, color: RISK_COLORS.low },
      { name: 'Medium risk', value: analytics.medium_risk_patients, color: RISK_COLORS.medium },
      { name: 'High risk', value: analytics.high_risk_patients, color: RISK_COLORS.high },
    ].filter((s) => s.value > 0);
  }, [analytics]);

  // ── Registrations over the last 7 days, computed from real created_at values ──
  const registrationTrend = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const count = patients.filter((p) => {
        const c = new Date(p.created_at);
        return c >= d && c < next;
      }).length;
      days.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }
    return days;
  }, [patients]);

  const hasAnyRegistration = registrationTrend.some((d) => d.count > 0);

  return (
    <CareManagerLayout breadcrumb="Dashboard" rightPanel={<CareManagerRail data={data} />}>
      {/* ── Page header ── */}
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">{greeting}, Care Manager 👋</h1>
          <p className="cmp-head__sub">Here's your care overview for today.</p>
        </div>
        <div className="cmp-datepill" aria-label={`Today is ${today}`}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3.2" width="12" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 1.8v2.6M11 1.8v2.6M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {today}
        </div>
      </div>

      {error && (
        <ErrorState
          title="Unable to load your dashboard"
          message={error}
          onRetry={reload}
        />
      )}

      {/* ── KPI rows: 4 on top, rest below ── */}
      <div className="cmp-kpis cmp-kpis--dark-4">
        <KpiCard
          tone="dark"
          loading={loading}
          label="Active Patients"
          value={analytics?.active_patients ?? null}
          hint="Currently active records"
          onClick={() => navigate('/care-manager/patients')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.7" stroke="currentColor" strokeWidth="1.5"/><path d="M1.8 15c0-2.9 2.3-4.6 5.2-4.6s5.2 1.7 5.2 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12.6 4.2a2.5 2.5 0 010 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="dark"
          loading={loading}
          label="High Risk Patients"
          value={analytics?.high_risk_patients ?? null}
          hint="Score ≥ 0.70"
          onClick={() => navigate('/care-manager/readmission?risk=high')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2.4l6.6 12H2.4L9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 7v3.2M9 12.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="dark"
          loading={loading}
          label="Readmission Risk"
          value={analytics ? `${analytics.readmission_rate_pct.toFixed(1)}%` : null}
          hint="Share of high-risk patients"
          onClick={() => navigate('/care-manager/readmission')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.6 11.4l3.5-4 3 2.6 3-4.1 3.4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <KpiCard
          tone="dark"
          loading={loading || !enrichedAttempted}
          label="Appointments"
          value={followUpsDue}
          hint="From post-discharge agents"
          onClick={() => navigate('/care-manager/post-discharge')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2.4" y="3.4" width="13.2" height="12" rx="1.8" stroke="currentColor" strokeWidth="1.5"/><path d="M5.6 1.9v2.8M12.4 1.9v2.8M2.4 7.6h13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
      </div>

      <div className="cmp-kpis cmp-kpis--dark-3">
        <KpiCard
          tone="dark"
          loading={loading || !enrichedAttempted}
          label="Tasks Pending"
          value={tasksPending}
          hint="Open care-plan tasks"
          onClick={() => navigate('/care-manager/post-discharge')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.8 5.4l1.6 1.6 2.6-2.6M2.8 12.4l1.6 1.6 2.6-2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.6 5.6h5.6M9.6 12.6h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="dark"
          loading={financial.loading}
          label="Total Cost Savings"
          value={
            financial.metrics
              ? (() => {
                  const savings = parseFloat(financial.metrics.total_savings);
                  if (savings === 0) return '$0';
                  if (savings >= 1000000) return `$${(savings / 1000000).toFixed(1)}M`;
                  if (savings >= 1000) return `$${(savings / 1000).toFixed(1)}K`;
                  return `$${savings.toFixed(0)}`;
                })()
              : null
          }
          hint="Program impact (last 30d)"
          onClick={() => navigate('/care-manager/financial')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.8v14.4M9 1.8l5.4 5.4M9 1.8L3.6 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <KpiCard
          tone="dark"
          loading={financial.loading}
          label="ROI"
          value={
            financial.metrics && parseFloat(financial.metrics.roi_percentage) >= 0
              ? `${parseFloat(financial.metrics.roi_percentage).toFixed(1)}%`
              : null
          }
          hint="Return on investment"
          onClick={() => navigate('/care-manager/financial')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.4 11.4l3.6-4 3 2.6 3-4 3.6 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {/* ── Patients requiring attention ── */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <h2 className="cmp-panel__title">Patients Requiring Attention</h2>
          <button className="cmp-panel__link" onClick={() => navigate('/care-manager/patients')}>
            View all patients →
          </button>
        </header>

        <div className="cmp-chips" role="tablist" aria-label="Filter patients">
          {([
            { key: 'high', label: 'High Priority', n: counts.high },
            { key: 'monitoring', label: 'Monitoring', n: counts.monitoring },
            { key: 'all', label: 'All Scored', n: counts.all },
          ] as { key: AttentionFilter; label: string; n: number }[]).map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={filter === c.key}
              className={`cmp-chip${filter === c.key ? ' cmp-chip--on' : ''}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label} <span className="cmp-chip__n">({c.n})</span>
            </button>
          ))}
        </div>

        {loading || !enrichedAttempted ? (
          <SkeletonTable rows={4} cols={6} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title="No patient records yet"
            message="Create your first patient to start tracking readmission risk and care plans."
            actionLabel="Create patient"
            onAction={() => navigate('/care-manager/patients?new=1')}
          />
        ) : attention.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No patients in this group"
            message="Nobody currently matches this risk filter."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="cmp-tablewrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">MRN</th>
                    <th scope="col">Risk Level</th>
                    <th scope="col">Care Status</th>
                    <th scope="col">Last Activity</th>
                    <th scope="col" className="cmp-table__right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map((p) => (
                    <tr key={p.id} onClick={() => navigate(`/care-manager/patients/${p.id}`)} className="cmp-table__row">
                      <td>
                        <span className="cmp-person">
                          <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                          <span className="cmp-person__text">
                            <span className="cmp-person__name">{p.name}</span>
                            <span className="cmp-person__id">{p.patient_id}</span>
                          </span>
                        </span>
                      </td>
                      <td className="cmp-mono">{p.mrn}</td>
                      <td><RiskBadge level={p.riskLevel} score={p.riskScore} showScore /></td>
                      <td className="cmp-muted">{p.postDischargeStatus ?? '—'}</td>
                      <td className="cmp-muted">
                        {p.lastActivityAt
                          ? new Date(p.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="cmp-table__right">
                        <button
                          className="cmp-rowbtn"
                          onClick={(e) => { e.stopPropagation(); navigate(`/care-manager/patients/${p.id}`); }}
                          aria-label={`View ${p.name}`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="cmp-cardlist">
              {attention.map((p) => (
                <button key={p.id} className="cmp-pcard" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                  <span className="cmp-pcard__top">
                    <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                    <span className="cmp-person__text">
                      <span className="cmp-person__name">{p.name}</span>
                      <span className="cmp-person__id">{p.mrn}</span>
                    </span>
                    <RiskBadge level={p.riskLevel} score={p.riskScore} />
                  </span>
                  <span className="cmp-pcard__meta">
                    <span>Status: {p.postDischargeStatus ?? '—'}</span>
                    <span>Age {p.age}</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="cmp-panel__foot">
              Showing {attention.length} of {counts.all} scored patients
            </p>
          </>
        )}
      </section>

      {/* ── Analytics row ── */}
      <div className="cmp-analytics">
        {/* Workload donut */}
        <section className="cmp-card cmp-card--analytics">
          <header className="cmp-card__head">
            <h3 className="cmp-card__title">Care Plan Workload</h3>
          </header>
          {loading || !enrichedAttempted ? (
            <Skeleton height={180} />
          ) : workload.total === 0 ? (
            <EmptyState compact icon="📋" title="No task data" message="No care-plan tasks returned." />
          ) : (
            <div className="cmp-donutwrap cmp-donutwrap--center">
              <div className="cmp-donut cmp-donut--lg">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={workload.slices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {workload.slices.map((s) => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip suffix=" tasks" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="cmp-donut__center">
                  <strong>{workload.pct !== null ? `${workload.pct}%` : 'N/A'}</strong>
                  <span>Completed</span>
                </div>
              </div>
              <ul className="cmp-legend">
                {workload.slices.map((s) => (
                  <li key={s.name}>
                    <span className="cmp-legend__dot" style={{ background: s.color }} />
                    {s.name}<strong>{s.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Registrations line chart */}
        <section className="cmp-card cmp-card--analytics">
          <header className="cmp-card__head">
            <h3 className="cmp-card__title">New Registrations</h3>
            <span className="cmp-card__tag">Last 7 days</span>
          </header>
          {loading ? (
            <Skeleton height={180} />
          ) : !hasAnyRegistration ? (
            <EmptyState compact icon="📈" title="No registrations" message="No patients registered in the last 7 days." />
          ) : (
            <div className="cmp-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={registrationTrend}
                  margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="rgba(242,132,107,0.12)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#a8a8a8' }}
                    axisLine={false}
                    tickLine={false}
                    height={22}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a8a8a8' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip content={<ChartTip suffix=" patients" />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#f2846b"
                    strokeWidth={2.4}
                    dot={{ r: 4, fill: '#f2846b', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#e06a4f' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Risk distribution donut */}
        <section className="cmp-card cmp-card--analytics">
          <header className="cmp-card__head">
            <h3 className="cmp-card__title">Risk Distribution</h3>
            <button className="cmp-card__link" onClick={() => navigate('/care-manager/analytics')}>Details</button>
          </header>
          {loading ? (
            <Skeleton height={180} />
          ) : riskSlices.length === 0 ? (
            <EmptyState compact icon="🧭" title="No risk data" message="Run predictions to populate risk levels." />
          ) : (
            <div className="cmp-donutwrap cmp-donutwrap--center">
              <div className="cmp-donut cmp-donut--lg">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={riskSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {riskSlices.map((s, i) => <Cell key={s.name} fill={s.color ?? PLAN_COLORS[i]} />)}
                    </Pie>
                    <Tooltip content={<ChartTip suffix=" patients" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="cmp-donut__center">
                  <strong>{analytics?.active_patients?.toLocaleString() ?? 'N/A'}</strong>
                  <span>Patients</span>
                </div>
              </div>
              <ul className="cmp-legend">
                {riskSlices.map((s) => (
                  <li key={s.name}>
                    <span className="cmp-legend__dot" style={{ background: s.color }} />
                    {s.name}<strong>{s.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </CareManagerLayout>
  );
}

/** Shared tooltip so all charts read the same way. */
export function ChartTip({
  active, payload, label, suffix = '',
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: { name?: string } }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p.payload?.name ?? p.name ?? label;
  return (
    <div className="cmp-tip">
      <span className="cmp-tip__label">{String(name ?? '')}</span>
      <span className="cmp-tip__value">{p.value?.toLocaleString()}{suffix}</span>
    </div>
  );
}
