/**
 * CarePath — Post Discharge Care
 * Journey tracker built from the backend's 4-agent post-discharge status.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import KpiCard from '../../components/ui/KpiCard';
import { ErrorState, EmptyState, Skeleton, SkeletonCard } from '../../components/ui/States';
import { ehrService, type PatientListItem } from '../../services/ehrService';
import { careManagerService, type PostDischargeStatus } from '../../services/careManagerService';
import { toApiError } from '../../services/apiClient';

/** The journey mirrors the four agents the backend reports on. */
const STAGES = ['Discharged', 'First Follow-up', 'Recovery Monitoring', 'Care Plan Complete'] as const;
type Stage = typeof STAGES[number];

interface Row {
  patient: PatientListItem;
  status: PostDischargeStatus;
  stage: Stage;
  stageIndex: number;
}

/** Derive the journey stage from real agent flags. */
function deriveStage(s: PostDischargeStatus): { stage: Stage; index: number } {
  const tasks = s.care_plan?.tasks ?? [];
  const allDone = tasks.length > 0 && tasks.every((t) => t.status === 'completed');

  if (allDone || s.care_plan?.status === 'completed') return { stage: 'Care Plan Complete', index: 3 };
  if (s.follow_up?.last_checkin) return { stage: 'Recovery Monitoring', index: 2 };
  if (s.follow_up?.is_scheduled || s.appointment?.is_appointment) return { stage: 'First Follow-up', index: 1 };
  return { stage: 'Discharged', index: 0 };
}

export default function PostDischargePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Stage | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const patients = await ehrService.list({ limit: 60 });
      if (!patients || patients.length === 0) {
        setRows([]);
        return;
      }

      const settled = await Promise.allSettled(
        patients.map(async (p) => ({ p, s: await careManagerService.postDischarge(p.patient_id) })),
      );

      const next: Row[] = [];
      settled.forEach((r) => {
        if (r.status !== 'fulfilled') return;
        const { p, s } = r.value;
        const { stage, index } = deriveStage(s);
        next.push({ patient: p, status: s, stage, stageIndex: index });
      });

      next.sort((a, b) => a.stageIndex - b.stageIndex);
      setRows(next);
    } catch (err) {
      setError(toApiError(err).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Stage, number> = {
      'Discharged': 0, 'First Follow-up': 0, 'Recovery Monitoring': 0, 'Care Plan Complete': 0,
    };
    rows.forEach((r) => { c[r.stage] += 1; });
    return c;
  }, [rows]);

  const kpis = useMemo(() => ({
    monitored: rows.length,
    followUpsScheduled: rows.filter((r) => r.status.follow_up.is_scheduled).length,
    appointments: rows.filter((r) => r.status.appointment.is_appointment).length,
    atRisk: rows.filter((r) => r.status.care_plan.status === 'at_risk').length,
  }), [rows]);

  const visible = useMemo(
    () => (selected === 'all' ? rows : rows.filter((r) => r.stage === selected)),
    [rows, selected],
  );

  return (
    <CareManagerLayout breadcrumb="Post Discharge">
      <div className="cmp-head">
        <div>
          <h1 className="cmp-head__title">Post Discharge Care</h1>
          <p className="cmp-head__sub">Live status from the care plan, follow-up, response and appointment agents.</p>
        </div>
        <button className="cp-btn cp-btn--ghost" onClick={load} disabled={loading}>
          {loading ? <><span className="cp-btn__spinner" /> Refreshing…</> : 'Refresh'}
        </button>
      </div>

      {error && <ErrorState title="Unable to load post-discharge data" message={error} onRetry={load} />}

      <div className="cmp-kpis cmp-kpis--four">
        <KpiCard tone="coral" loading={loading} label="Patients Monitored" value={loading ? null : kpis.monitored} hint="Agents reporting"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.6" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5.4V9l2.6 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>} />
        <KpiCard tone="peach" loading={loading} label="Follow-ups Scheduled" value={loading ? null : kpis.followUpsScheduled} hint="Check-in booked"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2.4" y="3.4" width="13.2" height="12" rx="1.8" stroke="currentColor" strokeWidth="1.5"/><path d="M5.6 1.9v2.8M12.4 1.9v2.8M2.4 7.6h13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>} />
        <KpiCard tone="rose" loading={loading} label="Appointments" value={loading ? null : kpis.appointments} hint="Confirmed by agent"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 2.5h7.5L14.5 5.5V15a.9.9 0 01-.9.9H4.9A.9.9 0 014 15V3.4a.9.9 0 01.9-.9z" stroke="currentColor" strokeWidth="1.5"/><path d="M6.4 9.4l1.6 1.6 3.2-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
        <KpiCard tone="neutral" loading={loading} label="Care Plans At Risk" value={loading ? null : kpis.atRisk} hint="Flagged by agent"
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2.4l6.6 12H2.4L9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 7v3.2M9 12.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>} />
      </div>

      {/* Journey */}
      <section className="cmp-panel">
        <header className="cmp-panel__head">
          <h2 className="cmp-panel__title">Care Journey</h2>
          <span className="cmp-card__tag">Select a stage to filter</span>
        </header>

        {loading ? (
          <Skeleton height={110} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🛤️" title="No post-discharge data"
            message="The agents have not returned a status for any patient yet."
            actionLabel="Go to patients" onAction={() => navigate('/care-manager/patients')}
          />
        ) : (
          <div className="cmj">
            {STAGES.map((s, i) => {
              const active = selected === s;
              return (
                <button
                  key={s}
                  className={`cmj__node${active ? ' cmj__node--on' : ''}`}
                  onClick={() => setSelected(active ? 'all' : s)}
                  aria-pressed={active}
                >
                  <span className="cmj__dot">{i + 1}</span>
                  <span className="cmj__label">{s}</span>
                  <span className="cmj__count">{counts[s]}</span>
                  {i < STAGES.length - 1 && <span className="cmj__line" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Patient list */}
      {!loading && rows.length > 0 && (
        <section className="cmp-panel">
          <header className="cmp-panel__head">
            <h2 className="cmp-panel__title">
              {selected === 'all' ? 'All monitored patients' : selected}
            </h2>
            {selected !== 'all' && (
              <button className="cmp-panel__link" onClick={() => setSelected('all')}>Clear filter</button>
            )}
          </header>

          {visible.length === 0 ? (
            <EmptyState compact icon="✅" title="No patients at this stage" />
          ) : (
            <div className="cmpd-list">
              {visible.map((r) => {
                const open = expanded === r.patient.patient_id;
                return (
                  <div key={r.patient.id} className={`cmpd-item${open ? ' cmpd-item--open' : ''}`}>
                    <button
                      className="cmpd-item__head"
                      onClick={() => setExpanded(open ? null : r.patient.patient_id)}
                      aria-expanded={open}
                    >
                      <span className="cmp-person__avatar">{r.patient.name?.[0]?.toUpperCase() ?? 'P'}</span>
                      <span className="cmp-person__text">
                        <span className="cmp-person__name">{r.patient.name}</span>
                        <span className="cmp-person__id">{r.patient.mrn}</span>
                      </span>
                      <span className="cmpd-item__stage">{r.stage}</span>
                      <span className={`cmd-agent__pill cmd-agent__pill--${r.status.care_plan.status === 'at_risk' ? 'warn' : 'ok'}`}>
                        {r.status.care_plan.status.replace('_', ' ')}
                      </span>
                      <span className="cmpd-item__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
                    </button>

                    {open && (
                      <div className="cmpd-item__body">
                        <div className="cmpd-grid">
                          <div>
                            <p className="cmpd-grid__label">Follow-up</p>
                            <p className="cmpd-grid__value">
                              {r.status.follow_up.is_scheduled ? 'Scheduled' : 'Not scheduled'}
                            </p>
                            {r.status.follow_up.last_checkin && (
                              <p className="cmpd-grid__sub">Last: {r.status.follow_up.last_checkin}</p>
                            )}
                            {r.status.follow_up.next_checkin && (
                              <p className="cmpd-grid__sub">Next: {r.status.follow_up.next_checkin}</p>
                            )}
                          </div>
                          <div>
                            <p className="cmpd-grid__label">Appointment</p>
                            <p className="cmpd-grid__value">
                              {r.status.appointment.is_appointment ? (r.status.appointment.date ?? 'Booked') : 'None'}
                            </p>
                          </div>
                          <div>
                            <p className="cmpd-grid__label">Care plan tasks</p>
                            {r.status.care_plan.tasks.length === 0 ? (
                              <p className="cmpd-grid__value">None returned</p>
                            ) : (
                              <ul className="cmd-tasklist">
                                {r.status.care_plan.tasks.map((t, i) => (
                                  <li key={i} className={t.status === 'completed' ? 'cmd-tasklist--done' : ''}>
                                    <span aria-hidden="true">{t.status === 'completed' ? '✓' : '○'}</span> {t.task}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {Object.keys(r.status.response_analyser.key_info ?? {}).length > 0 && (
                          <div className="cmpd-keyinfo">
                            <p className="cmpd-grid__label">Response analyser</p>
                            <ul>
                              {Object.entries(r.status.response_analyser.key_info).map(([k, v]) => (
                                <li key={k}><strong>{k.replace(/_/g, ' ')}:</strong> {String(v)}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <button className="cp-btn cp-btn--sm cp-btn--ghost" onClick={() => navigate(`/care-manager/patients/${r.patient.id}`)}>
                          Open patient record →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {loading && (
        <section className="cmp-panel">
          <SkeletonCard lines={4} />
        </section>
      )}
    </CareManagerLayout>
  );
}
