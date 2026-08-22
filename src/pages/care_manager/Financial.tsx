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

const SAVINGS_COLOR = '#7cc4a4';
const COST_COLOR = '#f2846b';
const NET_COLOR = '#5a9bd4';
const DONUT_COLORS = ['#f2846b', '#f5a08a', '#7cc4a4', '#d9d4d1'];

export default function FinancialDashboard() {
  const navigate = useNavigate();
  const careData = useCareManagerData();
  const financial = useFinancialData();
  
  const [dateRangeFilter, setDateRangeFilter] = useState<'30d' | '60d' | '90d' | 'ytd'>('30d');

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
    if (!financial.metrics) return null;
    
    return {
      totalSavings: parseFloat(financial.metrics.total_savings),
      totalCosts: parseFloat(financial.metrics.total_program_costs) + 
                  parseFloat(financial.metrics.total_intervention_costs),
      netSavings: parseFloat(financial.metrics.net_savings),
      roi: parseFloat(financial.metrics.roi_percentage),
      costPerPatient: parseFloat(financial.metrics.cost_per_patient),
      savingsPerPatient: parseFloat(financial.metrics.savings_per_patient),
      patientsTracked: financial.metrics.total_patients_tracked,
      interventions: financial.metrics.total_interventions,
      readmissionsPrevented: financial.metrics.readmissions_prevented,
      edVisitsPrevented: financial.metrics.ed_visits_prevented,
    };
  }, [financial.metrics]);

  // Savings breakdown for donut chart
  const savingsBreakdown = useMemo(() => {
    if (!financial.metrics) return [];
    
    return [
      { 
        name: 'Readmission Prevention', 
        value: parseFloat(financial.metrics.readmission_savings),
        color: DONUT_COLORS[0],
      },
      { 
        name: 'ED Visit Avoidance', 
        value: parseFloat(financial.metrics.ed_visit_savings),
        color: DONUT_COLORS[1],
      },
      { 
        name: 'LOS Reduction', 
        value: parseFloat(financial.metrics.los_reduction_savings),
        color: DONUT_COLORS[2],
      },
      { 
        name: 'Medication Adherence', 
        value: parseFloat(financial.metrics.medication_adherence_savings),
        color: DONUT_COLORS[3],
      },
    ].filter(s => s.value > 0);
  }, [financial.metrics]);

  // Intervention costs for bar chart
  const interventionChartData = useMemo(() => {
    return financial.interventions
      .filter(i => i.count > 0)
      .map(i => ({
        name: i.intervention_type.replace(/_/g, ' '),
        cost: parseFloat(i.total_cost),
        savings: parseFloat(i.total_savings),
        roi: parseFloat(i.roi_percentage),
      }))
      .slice(0, 7); // Top 7 interventions
  }, [financial.interventions]);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value === 0) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <CareManagerLayout breadcrumb="Financial Analytics" rightPanel={<CareManagerRail data={careData} />}>
      {/* ── Page header ── */}
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">Financial Analytics 💰</h1>
          <p className="cmp-head__sub">Track cost savings, ROI, and financial outcomes</p>
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
          ) : !financial.trend || financial.trend.trend.length === 0 ? (
            <EmptyState compact icon="📈" title="No trend data" message="Savings data will appear once interventions are tracked." />
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={financial.trend.trend} margin={{ top: 12, right: 16, bottom: 8, left: -20 }}>
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
        </header>

        {financial.loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : financial.interventions.length === 0 ? (
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
                {financial.interventions.map((intervention) => (
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
