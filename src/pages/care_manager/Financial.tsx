/**
 * CarePath — Financial Analytics Dashboard
 * Comprehensive financial metrics, ROI analysis, and cost tracking.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import CareManagerRail from '../../components/care_manager/CareManagerRail';
import KpiCard from '../../components/ui/KpiCard';
import { ErrorState, EmptyState, SkeletonTable, Skeleton } from '../../components/ui/States';
import { useFinancialData } from '../../hooks/useFinancialData';
import { useCareManagerData } from '../../hooks/useCareManagerData';
import type { FinancialMetrics, InterventionCost, SavingsTrend } from '../../services/financialService';

const SAVINGS_COLOR = '#7cc4a4';
const COST_COLOR = '#f2846b';
const NET_COLOR = '#5a9bd4';
const DONUT_COLORS = ['#f2846b', '#f5a08a', '#7cc4a4', '#d9d4d1'];

/**
 * Demo dataset shown only when the backend returns no real financial
 * activity yet (all-zero metrics / empty interventions / empty trend).
 * Every screen using this data carries a visible "Demo data" badge so it's
 * never mistaken for a live figure — see the `usingMockData` flag below.
 */
const MOCK_METRICS: FinancialMetrics = {
  total_savings: '184250.00',
  readmission_savings: '96400.00',
  ed_visit_savings: '41200.00',
  los_reduction_savings: '28650.00',
  medication_adherence_savings: '18000.00',
  other_savings: '0.00',
  total_program_costs: '32000.00',
  total_intervention_costs: '11400.00',
  net_savings: '140850.00',
  roi_percentage: '324.5',
  cost_per_patient: '310.20',
  savings_per_patient: '1316.07',
  total_patients_tracked: 140,
  total_interventions: 212,
  readmissions_prevented: 14,
  ed_visits_prevented: 22,
  period_start: '2026-06-25',
  period_end: '2026-08-24',
  timestamp: new Date().toISOString(),
};

const MOCK_INTERVENTIONS: InterventionCost[] = [
  { intervention_type: 'follow_up_call', description: 'Post-discharge phone check-in within 48 hours', cost_per_unit: '18.00', estimated_savings_per_unit: '210.00', count: 86, total_cost: '1548.00', total_savings: '18060.00', roi_percentage: '1066.7', active: true },
  { intervention_type: 'medication_reconciliation', description: 'Pharmacist-led medication review at discharge', cost_per_unit: '45.00', estimated_savings_per_unit: '390.00', count: 54, total_cost: '2430.00', total_savings: '21060.00', roi_percentage: '766.7', active: true },
  { intervention_type: 'home_health_referral', description: 'Referral to home health nursing services', cost_per_unit: '120.00', estimated_savings_per_unit: '980.00', count: 22, total_cost: '2640.00', total_savings: '21560.00', roi_percentage: '716.7', active: true },
  { intervention_type: 'telehealth_visit', description: 'Virtual follow-up with care team', cost_per_unit: '35.00', estimated_savings_per_unit: '260.00', count: 31, total_cost: '1085.00', total_savings: '8060.00', roi_percentage: '643.1', active: true },
  { intervention_type: 'appointment_scheduling', description: 'Proactive scheduling of follow-up appointments', cost_per_unit: '12.00', estimated_savings_per_unit: '150.00', count: 19, total_cost: '228.00', total_savings: '2850.00', roi_percentage: '1150.0', active: true },
];

const MOCK_TREND: SavingsTrend = {
  period_days: 30,
  trend: Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const base = 3200 + i * 210;
    const wobble = Math.sin(i / 3) * 600;
    return {
      date: d.toISOString().split('T')[0],
      savings: (base + wobble).toFixed(2),
      costs: (base * 0.22).toFixed(2),
      net_savings: (base * 0.78 + wobble).toFixed(2),
      intervention_count: 4 + Math.round(Math.abs(Math.sin(i / 2)) * 6),
    };
  }),
};

export default function FinancialDashboard() {
  const navigate = useNavigate();
  const careData = useCareManagerData();
  const financial = useFinancialData();
  
  const [dateRangeFilter, setDateRangeFilter] = useState<'30d' | '60d' | '90d' | 'ytd'>('30d');

  /**
   * True once loading has finished and the backend genuinely has nothing to
   * show (no metrics at all, or a metrics object where every dollar figure
   * is zero). In that case the page falls back to the demo dataset above so
   * the UI is never blank — every section that uses it is labeled "Demo data".
   */
  const usingMockData = useMemo(() => {
    if (financial.loading) return false;
    const m = financial.metrics;
    if (!m) return true;
    const allZero = ['total_savings', 'net_savings', 'total_program_costs', 'total_intervention_costs']
      .every((k) => parseFloat((m as any)[k] ?? '0') === 0);
    return allZero && financial.interventions.length === 0;
  }, [financial.loading, financial.metrics, financial.interventions]);

  const effectiveMetrics = usingMockData ? MOCK_METRICS : financial.metrics;
  const effectiveInterventions = usingMockData ? MOCK_INTERVENTIONS : financial.interventions;
  const effectiveTrend = usingMockData ? MOCK_TREND : financial.trend;

  const today = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    [],
  );

  // Handle date range changes
  const handleDateRangeChange = (range: '30d' | '60d' | '90d' | 'ytd') => {
    setDateRangeFilter(range);
    
    const end = new Date();
    const start = new Date();
    
    if (range === '30d') start.setDate(start.getDate() - 30);
    else if (range === '60d') start.setDate(start.getDate() - 60);
    else if (range === '90d') start.setDate(start.getDate() - 90);
    else if (range === 'ytd') {
      start.setMonth(0, 1); // January 1st
    }
    
    financial.setDateRange(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  };

  // Parse decimal strings to numbers for display
  const metrics = useMemo(() => {
    if (!effectiveMetrics) return null;
    
    return {
      totalSavings: parseFloat(effectiveMetrics.total_savings),
      totalCosts: parseFloat(effectiveMetrics.total_program_costs) + 
                  parseFloat(effectiveMetrics.total_intervention_costs),
      netSavings: parseFloat(effectiveMetrics.net_savings),
      roi: parseFloat(effectiveMetrics.roi_percentage),
      costPerPatient: parseFloat(effectiveMetrics.cost_per_patient),
      savingsPerPatient: parseFloat(effectiveMetrics.savings_per_patient),
      patientsTracked: effectiveMetrics.total_patients_tracked,
      interventions: effectiveMetrics.total_interventions,
      readmissionsPrevented: effectiveMetrics.readmissions_prevented,
      edVisitsPrevented: effectiveMetrics.ed_visits_prevented,
    };
  }, [effectiveMetrics]);

  // Savings breakdown for donut chart
  const savingsBreakdown = useMemo(() => {
    if (!effectiveMetrics) return [];
    
    return [
      { 
        name: 'Readmission Prevention', 
        value: parseFloat(effectiveMetrics.readmission_savings),
        color: DONUT_COLORS[0],
      },
      { 
        name: 'ED Visit Avoidance', 
        value: parseFloat(effectiveMetrics.ed_visit_savings),
        color: DONUT_COLORS[1],
      },
      { 
        name: 'LOS Reduction', 
        value: parseFloat(effectiveMetrics.los_reduction_savings),
        color: DONUT_COLORS[2],
      },
      { 
        name: 'Medication Adherence', 
        value: parseFloat(effectiveMetrics.medication_adherence_savings),
        color: DONUT_COLORS[3],
      },
    ].filter(s => s.value > 0);
  }, [effectiveMetrics]);

  // Intervention costs for bar chart
  const interventionChartData = useMemo(() => {
    return effectiveInterventions
      .filter(i => i.count > 0)
      .map(i => ({
        name: i.intervention_type.replace(/_/g, ' '),
        cost: parseFloat(i.total_cost),
        savings: parseFloat(i.total_savings),
        roi: parseFloat(i.roi_percentage),
      }))
      .slice(0, 7); // Top 7 interventions
  }, [effectiveInterventions]);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value === 0) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  /**
   * Estimated savings split by who benefits — patients vs. the care-manager /
   * health-system side. The backend only reports an aggregate total per
   * category (readmission, ED visit, LOS, medication adherence), not who
   * captures the dollar value, so this is a documented allocation model
   * applied on top of the real category totals — NOT a raw backend field.
   * Weights reflect that patients mostly avoid out-of-pocket cost (copays,
   * missed work, ED bills) while the health system/care-manager side mostly
   * captures avoided hospital days, penalties, and staff time.
   */
  const stakeholderSplit = useMemo(() => {
    if (!effectiveMetrics) return null;
    const readmission = parseFloat(effectiveMetrics.readmission_savings);
    const edVisit = parseFloat(effectiveMetrics.ed_visit_savings);
    const los = parseFloat(effectiveMetrics.los_reduction_savings);
    const medAdherence = parseFloat(effectiveMetrics.medication_adherence_savings);
    const other = parseFloat(effectiveMetrics.other_savings);

    // Allocation weights (patient share of each category's dollar value).
    const PATIENT_SHARE = {
      readmission: 0.35, // copay/deductible + lost wages on an avoided readmission
      edVisit: 0.45,      // ED visits carry high patient out-of-pocket exposure
      los: 0.15,          // mostly a hospital-side efficiency gain
      medAdherence: 0.7,  // adherence savings are largely the patient's own avoided costs
      other: 0.3,
    };

    const patientTotal =
      readmission * PATIENT_SHARE.readmission +
      edVisit * PATIENT_SHARE.edVisit +
      los * PATIENT_SHARE.los +
      medAdherence * PATIENT_SHARE.medAdherence +
      other * PATIENT_SHARE.other;

    const grandTotal = readmission + edVisit + los + medAdherence + other;
    const careManagerTotal = Math.max(grandTotal - patientTotal, 0);
    const patientsTracked = effectiveMetrics.total_patients_tracked || 0;

    return {
      patientTotal,
      careManagerTotal,
      grandTotal,
      patientPct: grandTotal > 0 ? (patientTotal / grandTotal) * 100 : 0,
      careManagerPct: grandTotal > 0 ? (careManagerTotal / grandTotal) * 100 : 0,
      perPatient: patientsTracked > 0 ? patientTotal / patientsTracked : 0,
      rows: [
        { label: 'Readmission Prevention', total: readmission, patient: readmission * PATIENT_SHARE.readmission },
        { label: 'ED Visit Avoidance', total: edVisit, patient: edVisit * PATIENT_SHARE.edVisit },
        { label: 'LOS Reduction', total: los, patient: los * PATIENT_SHARE.los },
        { label: 'Medication Adherence', total: medAdherence, patient: medAdherence * PATIENT_SHARE.medAdherence },
      ].filter((r) => r.total > 0),
    };
  }, [effectiveMetrics]);

  return (
    <CareManagerLayout breadcrumb="Financial Analytics" rightPanel={<CareManagerRail data={careData} />}>
      {/* ── Page header ── */}
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">
            Financial Analytics 💰
            {usingMockData && <span className="cmp-demo-badge" title="No live financial activity yet — showing sample data">Demo data</span>}
          </h1>
          <p className="cmp-head__sub">
            {usingMockData
              ? 'No live financial activity yet — the figures below are sample data illustrating the dashboard.'
              : 'Track cost savings, ROI, and financial outcomes'}
          </p>
        </div>
        
        {/* Date range selector */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#6b6b6b', marginRight: '0.5rem' }}>Period:</span>
          {(['30d', '60d', '90d', 'ytd'] as const).map(range => (
            <button
              key={range}
              className={`cmp-chip${dateRangeFilter === range ? ' cmp-chip--on' : ''}`}
              onClick={() => handleDateRangeChange(range)}
              style={{ minWidth: '60px' }}
            >
              {range === 'ytd' ? 'YTD' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {financial.error && (
        <ErrorState
          title="Unable to load financial data"
          message={financial.error}
          onRetry={financial.reload}
        />
      )}

      {/* ── KPI row ── */}
      {usingMockData && (
        <div className="cmp-demo-banner">
          <span aria-hidden="true">ℹ️</span>
          Showing sample data — no live financial activity has been recorded for this period yet.
        </div>
      )}
      <div className="cmp-kpis">
        <KpiCard
          tone="coral"
          loading={financial.loading}
          label="Total Cost Savings"
          value={metrics ? formatCurrency(metrics.totalSavings) : null}
          hint={`Last ${dateRangeFilter === 'ytd' ? 'year to date' : dateRangeFilter}`}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.8v14.4M9 1.8l5.4 5.4M9 1.8L3.6 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <KpiCard
          tone="peach"
          loading={financial.loading}
          label="Return on Investment"
          value={metrics && metrics.roi >= 0 ? `${metrics.roi.toFixed(1)}%` : null}
          hint="Program efficiency"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.4 11.4l3.6-4 3 2.6 3-4 3.6 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <KpiCard
          tone="rose"
          loading={financial.loading}
          label="Program Costs"
          value={metrics ? formatCurrency(metrics.totalCosts) : null}
          hint="Total intervention costs"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.2" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5.4v7.2M6.6 9h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="neutral"
          loading={financial.loading}
          label="Cost Per Patient"
          value={metrics ? formatCurrency(metrics.costPerPatient) : null}
          hint="Average program cost"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.7" stroke="currentColor" strokeWidth="1.5"/><path d="M1.8 15c0-2.9 2.3-4.6 5.2-4.6s5.2 1.7 5.2 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KpiCard
          tone="coral"
          loading={financial.loading}
          label="Patients Tracked"
          value={metrics?.patientsTracked ?? null}
          hint="With financial data"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" stroke="currentColor" strokeWidth="1.4"/></svg>}
        />
      </div>

      {/* ── Savings by stakeholder (estimated allocation, not a raw backend field) ── */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <div>
            <h2 className="cmp-panel__title">Who Benefits From These Savings?</h2>
            <p className="cmp-panel__sub">
              Estimated split of total savings between patients and the care-manager / health-system side.
            </p>
          </div>
          <span className="cmp-card__tag">
            {usingMockData ? 'Estimated allocation · Demo data' : 'Estimated allocation'}
          </span>
        </header>

        {financial.loading ? (
          <Skeleton height={140} />
        ) : !stakeholderSplit || stakeholderSplit.grandTotal <= 0 ? (
          <EmptyState compact icon="🤝" title="No savings to allocate yet" message="This breakdown appears once savings categories are non-zero." />
        ) : (
          <>
            <div className="cmp-stakeholder">
              <div className="cmp-stakeholder__card cmp-stakeholder__card--patient">
                <span className="cmp-stakeholder__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3.5 17c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="cmp-stakeholder__label">Patient Savings</span>
                <strong className="cmp-stakeholder__value">{formatCurrency(stakeholderSplit.patientTotal)}</strong>
                <span className="cmp-stakeholder__pct">{stakeholderSplit.patientPct.toFixed(0)}% of total</span>
                <span className="cmp-stakeholder__sub">
                  ≈ {formatCurrency(stakeholderSplit.perPatient)} / patient — avoided copays, ED bills &amp; lost work
                </span>
              </div>

              <div className="cmp-stakeholder__bar" aria-hidden="true">
                <span className="cmp-stakeholder__bar-patient" style={{ flexBasis: `${stakeholderSplit.patientPct}%` }} />
                <span className="cmp-stakeholder__bar-cm" style={{ flexBasis: `${stakeholderSplit.careManagerPct}%` }} />
              </div>

              <div className="cmp-stakeholder__card cmp-stakeholder__card--cm">
                <span className="cmp-stakeholder__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 16V7.5L10 3l7 4.5V16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M7.5 16v-5h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="cmp-stakeholder__label">Care Manager / Health System Savings</span>
                <strong className="cmp-stakeholder__value">{formatCurrency(stakeholderSplit.careManagerTotal)}</strong>
                <span className="cmp-stakeholder__pct">{stakeholderSplit.careManagerPct.toFixed(0)}% of total</span>
                <span className="cmp-stakeholder__sub">Avoided hospital days, penalties &amp; staff time</span>
              </div>
            </div>

            <div className="cmp-tablewrap" style={{ marginTop: 20 }}>
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th scope="col">Savings Category</th>
                    <th scope="col">Total</th>
                    <th scope="col">Patient Share</th>
                    <th scope="col">Care Manager Share</th>
                  </tr>
                </thead>
                <tbody>
                  {stakeholderSplit.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="cmp-mono">{formatCurrency(r.total)}</td>
                      <td className="cmp-mono" style={{ color: SAVINGS_COLOR, fontWeight: 500 }}>{formatCurrency(r.patient)}</td>
                      <td className="cmp-mono" style={{ color: NET_COLOR, fontWeight: 500 }}>{formatCurrency(r.total - r.patient)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cmp-panel__foot">
              Category totals come from the financial API; the patient vs. care-manager split is an estimated allocation for illustration, not a value the backend reports directly.
            </p>
          </>
        )}
      </section>

      {/* ── Charts section ── */}
      <div className="cmp-analytics">
        {/* Savings trend line chart */}
        <section className="cmp-card">
          <header className="cmp-card__head">
            <h3 className="cmp-card__title">Savings Trend</h3>
            <span className="cmp-card__tag">Last 30 days</span>
          </header>
          {financial.loading ? (
            <Skeleton height={200} />
          ) : !effectiveTrend || effectiveTrend.trend.length === 0 ? (
            <EmptyState compact icon="📈" title="No trend data" message="Savings data will appear once interventions are tracked." />
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={effectiveTrend.trend} margin={{ top: 12, right: 16, bottom: 8, left: -20 }}>
                  <CartesianGrid stroke="rgba(124,196,164,0.12)" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#a8a8a8' }} 
                    axisLine={false} 
                    tickLine={false}
                    height={20}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#a8a8a8' }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={50}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={<ChartTip prefix="$" />} />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke={SAVINGS_COLOR}
                    strokeWidth={2.4}
                    dot={{ r: 3, fill: SAVINGS_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: SAVINGS_COLOR }}
                    name="Savings"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Intervention costs bar chart */}
        <section className="cmp-card">
          <header className="cmp-card__head">
            <h3 className="cmp-card__title">Cost vs Savings by Intervention</h3>
          </header>
          {financial.loading ? (
            <Skeleton height={200} />
          ) : interventionChartData.length === 0 ? (
            <EmptyState compact icon="📊" title="No intervention data" message="Data will appear once interventions are logged." />
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={interventionChartData} margin={{ top: 12, right: 16, bottom: 8, left: -20 }}>
                  <CartesianGrid stroke="rgba(242,132,107,0.12)" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#a8a8a8' }} 
                    axisLine={false} 
                    tickLine={false}
                    height={40}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#a8a8a8' }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={50}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={<ChartTip prefix="$" />} />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    iconType="square"
                  />
                  <Bar dataKey="cost" fill={COST_COLOR} name="Cost" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="savings" fill={SAVINGS_COLOR} name="Savings" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Savings breakdown donut */}
        <section className="cmp-card">
          <header className="cmp-card__head">
            <h3 className="cmp-card__title">Savings Breakdown</h3>
          </header>
          {financial.loading ? (
            <Skeleton height={200} />
          ) : savingsBreakdown.length === 0 ? (
            <EmptyState compact icon="🥧" title="No savings data" message="Breakdown will appear once savings are calculated." />
          ) : (
            <div className="cmp-donutwrap">
              <div className="cmp-donut">
                <ResponsiveContainer width={170} height={170}>
                  <PieChart>
                    <Pie
                      data={savingsBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {savingsBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip prefix="$" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="cmp-donut__center">
                  <strong>{metrics ? formatCurrency(metrics.totalSavings) : 'N/A'}</strong>
                  <span>Total</span>
                </div>
              </div>
              <ul className="cmp-legend">
                {savingsBreakdown.map((s) => (
                  <li key={s.name}>
                    <span className="cmp-legend__dot" style={{ background: s.color }} />
                    {s.name}<strong>{formatCurrency(s.value)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ── Intervention performance table ── */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <h2 className="cmp-panel__title">Intervention Performance</h2>
          {usingMockData && <span className="cmp-demo-badge">Demo data</span>}
        </header>

        {financial.loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : effectiveInterventions.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No interventions logged yet"
            message="Start logging interventions to track financial impact."
          />
        ) : (
          <div className="cmp-tablewrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">Intervention Type</th>
                  <th scope="col">Count</th>
                  <th scope="col">Total Cost</th>
                  <th scope="col">Total Savings</th>
                  <th scope="col">ROI</th>
                  <th scope="col">Cost/Unit</th>
                </tr>
              </thead>
              <tbody>
                {effectiveInterventions.map((intervention) => (
                  <tr key={intervention.intervention_type} className="cmp-table__row">
                    <td>
                      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                        {intervention.intervention_type.replace(/_/g, ' ')}
                      </span>
                      {intervention.description && (
                        <div style={{ fontSize: '0.8rem', color: '#6b6b6b', marginTop: '2px' }}>
                          {intervention.description.slice(0, 60)}...
                        </div>
                      )}
                    </td>
                    <td className="cmp-mono">{intervention.count}</td>
                    <td className="cmp-mono">{formatCurrency(parseFloat(intervention.total_cost))}</td>
                    <td className="cmp-mono" style={{ color: SAVINGS_COLOR, fontWeight: 500 }}>
                      {formatCurrency(parseFloat(intervention.total_savings))}
                    </td>
                    <td className="cmp-mono" style={{ color: parseFloat(intervention.roi_percentage) > 100 ? SAVINGS_COLOR : '#6b6b6b' }}>
                      {parseFloat(intervention.roi_percentage).toFixed(0)}%
                    </td>
                    <td className="cmp-mono">{formatCurrency(parseFloat(intervention.cost_per_unit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </CareManagerLayout>
  );
}

/** Shared tooltip component for all charts */
function ChartTip({
  active,
  payload,
  label,
  prefix = '',
  suffix = '',
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; dataKey?: string }[];
  label?: string | number;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="cmp-tip">
      <span className="cmp-tip__label">{String(label ?? payload[0]?.name ?? '')}</span>
      {payload.map((p, idx) => (
        <div key={idx} style={{ marginTop: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b6b6b' }}>{p.name}: </span>
          <span className="cmp-tip__value">
            {prefix}
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
