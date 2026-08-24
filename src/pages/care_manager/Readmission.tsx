/**
 * CarePath — Readmission Analytics
 * Aggregate risk bands from /care-manager/analytics plus per-patient scores.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
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
import QuickSightDashboard from '../../components/QuickSightDashboard';

const BAND_COLORS: Record<string, string> = {
  Low: '#7cc4a4',
  Medium: '#f5a08a',
  High: '#e06a4f',
};

type Band = 'all' | 'high' | 'medium' | 'low';

export default function ReadmissionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const data = useCareManagerData();
  const { analytics, enriched, loading, error, reload, enrichedAttempted } = data;

  const [band, setBand] = useState<Band>((params.get('risk') as Band) ?? 'all');
  const [running, setRunning] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (band === 'all') next.delete('risk');
    else next.set('risk', band);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  const scored = useMemo(
    () => enriched.map((p) => ({ ...p, riskScore: scores[p.patient_id] ?? p.riskScore }))
      .filter((p) => p.riskScore !== null && p.riskScore !== undefined) as EnrichedPatient[],
    [enriched, scores],
  );

  const distribution = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Low', value: analytics.low_risk_patients },
      { name: 'Medium', value: analytics.medium_risk_patients },
      { name: 'High', value: analytics.high_risk_patients },
    ];
  }, [analytics]);

  const hasDistribution = distribution.some((d) => d.value > 0);

  const ranked = useMemo(() => {
    let list = [...scored].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    if (band === 'high') list = list.filter((p) => (p.riskScore ?? 0) >= 0.7);
    else if (band === 'medium') list = list.filter((p) => (p.riskScore ?? 0) >= 0.4 && (p.riskScore ?? 0) < 0.7);
    else if (band === 'low') list = list.filter((p) => (p.riskScore ?? 0) < 0.4);
    return list.slice(0, 10);
  }, [scored, band]);

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

  return (
    <CareManagerLayout breadcrumb="Readmission">
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">Readmission Analytics</h1>
          <p className="cmp-head__sub">Risk bands and prediction coverage across your patient population.</p>
        </div>
        <button className="cp-btn cp-btn--ghost" onClick={reload} disabled={loading}>
          {loading ? <><span className="cp-btn__spinner" /> Refreshing…</> : 'Refresh'}
        </button>
      </div>

      {error && <ErrorState title="Unable to load readmission analytics" message={error} onRetry={reload} />}

      <div className="cmp-kpis cmp-kpis--four">
        <KpiCard
          tone="coral" loading={loading} label="Patients Scored"
          value={analytics ? analytics.low_risk_patients + analytics.medium_risk_patients + analytics.high_risk_patients : null}
          hint={analytics ? `of ${analytics.total_patients.toLocaleString()} total` : undefined}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 15V8.5M7.6 15V3.5M12.2 15v-4.5M16 15V6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="rose" loading={loading} label="High Risk" value={analytics?.high_risk_patients ?? null}
          hint="Score ≥ 0.70" onClick={() => setBand('high')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2.4l6.6 12H2.4L9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 7v3.2M9 12.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="peach" loading={loading} label="Medium Risk" value={analytics?.medium_risk_patients ?? null}
          hint="0.40 – 0.69" onClick={() => setBand('medium')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.6" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5.4V9l2.6 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="neutral" loading={loading} label="Low Risk" value={analytics?.low_risk_patients ?? null}
          hint="Below 0.40" onClick={() => setBand('low')}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9.4l3.2 3.2 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {/* QuickSight Live Analytics Dashboard */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <h2 className="cmp-panel__title">Live Analytics Dashboard</h2>
          <span className="cmp-card__tag">Real-time data from QuickSight</span>
        </header>
        <QuickSightDashboard height="700px" />
      </section>

      {/* Distribution */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <h2 className="cmp-panel__title">Risk Distribution</h2>
          <span className="cmp-card__tag">Click a bar to filter</span>
        </header>
        {loading ? (
          <Skeleton height={230} />
        ) : !hasDistribution ? (
          <EmptyState
            icon="📊" title="No risk data yet"
            message="Run readmission predictions to populate the risk bands."
            actionLabel="Go to patients" onAction={() => navigate('/care-manager/patients')}
          />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distribution} margin={{ top: 10, right: 16, bottom: 4, left: -14 }}>
              <CartesianGrid stroke="rgba(242,132,107,0.12)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a8a8a8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip suffix=" patients" />} cursor={{ fill: 'rgba(242,132,107,0.06)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={68} onClick={(d: { name?: string }) => {
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

      {/* Ranking */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <h2 className="cmp-panel__title">
            {band === 'all' ? 'Highest Risk Patients' : `${band[0].toUpperCase()}${band.slice(1)} Risk Patients`}
          </h2>
          <div className="cmp-chips">
            {(['all', 'high', 'medium', 'low'] as Band[]).map((b) => (
              <button key={b} className={`cmp-chip${band === b ? ' cmp-chip--on' : ''}`} onClick={() => setBand(b)}>
                {b === 'all' ? 'All' : b[0].toUpperCase() + b.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {loading || !enrichedAttempted ? (
          <SkeletonTable rows={5} cols={5} />
        ) : ranked.length === 0 ? (
          <EmptyState
            icon="🧭" title="No scored patients in this band"
            message="Predictions are stored per patient — run one from the patients page."
            actionLabel="Go to patients" onAction={() => navigate('/care-manager/patients')}
          />
        ) : (
          <>
            <div className="cmp-tablewrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">MRN</th>
                    <th scope="col">Risk</th>
                    <th scope="col">Score</th>
                    <th scope="col" className="cmp-table__right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p) => (
                    <tr key={p.id} className="cmp-table__row" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
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
                      <td>
                        <div className="cmp-meter" aria-label={`${Math.round((p.riskScore ?? 0) * 100)} percent`}>
                          <span
                            className="cmp-meter__fill"
                            style={{
                              width: `${Math.round((p.riskScore ?? 0) * 100)}%`,
                              background: (p.riskScore ?? 0) >= 0.7 ? '#e06a4f' : (p.riskScore ?? 0) >= 0.4 ? '#f5a08a' : '#7cc4a4',
                            }}
                          />
                          <span className="cmp-meter__label">{Math.round((p.riskScore ?? 0) * 100)}%</span>
                        </div>
                      </td>
                      <td className="cmp-table__right">
                        <div className="cmp-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="cp-btn cp-btn--sm cp-btn--primary"
                            onClick={() => runPredict(p.patient_id, p.name)}
                            disabled={running === p.patient_id}
                          >
                            {running === p.patient_id ? <><span className="cp-btn__spinner" /> …</> : 'Re-predict'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cmp-cardlist">
              {ranked.map((p) => (
                <div key={p.id} className="cmp-pcard cmp-pcard--static">
                  <button className="cmp-pcard__top cmp-pcard__hit" onClick={() => navigate(`/care-manager/patients/${p.id}`)}>
                    <span className="cmp-person__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                    <span className="cmp-person__text">
                      <span className="cmp-person__name">{p.name}</span>
                      <span className="cmp-person__id">{p.mrn}</span>
                    </span>
                    <RiskBadge score={p.riskScore} showScore />
                  </button>
                  <div className="cmp-pcard__actions">
                    <button className="cp-btn cp-btn--sm cp-btn--primary" onClick={() => runPredict(p.patient_id, p.name)} disabled={running === p.patient_id}>
                      {running === p.patient_id ? 'Running…' : 'Re-predict'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </CareManagerLayout>
  );
}
