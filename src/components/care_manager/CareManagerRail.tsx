/**
 * CarePath — Care Manager Right Rail
 *
 * A real-data quick-overview panel for the dashboard. Every number and row
 * comes from the live backend — nothing is hardcoded or mocked.
 *
 * Sections:
 *  1. Live stats strip          — key numbers at a glance
 *  2. Critical alerts           — high-risk + emergency flags from analytics
 *  3. High-risk patients        — top scored patients needing action
 *  4. Upcoming appointments     — from post-discharge agent per patient
 *  5. Pending tasks             — from care-plan task lists
 *  6. Mini calendar             — appointment days highlighted
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CareManagerData, DerivedTask, DerivedAppointment } from '../../hooks/useCareManagerData';
import { Skeleton, EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';

/* ── Helpers ── */
function fmtDate(raw: string): { time: string; day: string } {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { time: raw, day: '' };
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const day = same(d, today) ? 'Today' : same(d, tomorrow) ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return { time, day };
}

function timeAgo(raw: string | null | undefined): string {
  if (!raw) return 'Never';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/* ══════════════════════════════════════════════
   Main Rail
══════════════════════════════════════════════ */
export default function CareManagerRail({ data }: { data: CareManagerData }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { analytics, enriched, tasks, appointments, loading, enrichedAttempted } = data;

  /* ── Local task toggle (UI only — no backend task mutation endpoint) ── */
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const toggleTask = (t: DerivedTask) => {
    const currently = localDone[t.id] ?? t.status === 'completed';
    setLocalDone(prev => ({ ...prev, [t.id]: !currently }));
    toast.notify(
      !currently ? 'Marked complete for this session.' : 'Reopened for this session.',
      'info',
    );
  };

  /* ── Derived values ── */
  const highRiskPatients = useMemo(
    () => enriched.filter(p => (p.riskScore ?? 0) >= 0.7).slice(0, 5),
    [enriched],
  );

  const pendingTasks = useMemo(
    () => tasks.filter(t => !(localDone[t.id] ?? t.status === 'completed')),
    [tasks, localDone],
  );
  const completedTasks = useMemo(
    () => tasks.filter(t => localDone[t.id] ?? t.status === 'completed'),
    [tasks, localDone],
  );
  const taskCompletionPct = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : null;

  const nextAppts = useMemo(
    () => [...appointments].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4),
    [appointments],
  );

  /* ── Alerts built entirely from analytics fields ── */
  const alerts = useMemo(() => {
    if (!analytics) return [];
    const list: { icon: string; tone: 'red' | 'amber' | 'blue'; text: string; go: () => void }[] = [];
    if (analytics.high_risk_patients > 0) {
      list.push({
        icon: '🚨',
        tone: 'red',
        text: `${analytics.high_risk_patients} high-risk patient${analytics.high_risk_patients !== 1 ? 's' : ''} need review`,
        go: () => navigate('/care-manager/readmission?risk=high'),
      });
    }
    if (analytics.emergency_alerts_triggered > 0) {
      list.push({
        icon: '🚑',
        tone: 'red',
        text: `${analytics.emergency_alerts_triggered} emergency alert${analytics.emergency_alerts_triggered !== 1 ? 's' : ''} triggered`,
        go: () => navigate('/care-manager/readmission'),
      });
    }
    if (analytics.medium_risk_patients > 0) {
      list.push({
        icon: '⚠️',
        tone: 'amber',
        text: `${analytics.medium_risk_patients} medium-risk patient${analytics.medium_risk_patients !== 1 ? 's' : ''} to monitor`,
        go: () => navigate('/care-manager/readmission?risk=medium'),
      });
    }
    if (analytics.post_discharge_active_monitors > 0) {
      list.push({
        icon: '📋',
        tone: 'blue',
        text: `${analytics.post_discharge_active_monitors} active post-discharge monitor${analytics.post_discharge_active_monitors !== 1 ? 's' : ''}`,
        go: () => navigate('/care-manager/post-discharge'),
      });
    }
    return list;
  }, [analytics, navigate]);

  /* ── Render ── */
  return (
    <div className="cmr">

      {/* ── 1. Live Overview ── */}
      <section className="cmr-card cmr-stats-strip">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">Live Overview</h3>
          {analytics && (
            <span className="cmr-live-dot" title="Live data">
              <span className="cmr-live-dot__pulse" />
              Live
            </span>
          )}
        </header>
        {loading ? (
          <div className="cmr-skel"><Skeleton height={92} /></div>
        ) : (
          <div className="cmr-stats">
            <button className="cmr-stat" onClick={() => navigate('/care-manager/patients')}>
              <span className="cmr-stat__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.7" stroke="currentColor" strokeWidth="1.5"/><path d="M1.8 15c0-2.9 2.3-4.6 5.2-4.6s5.2 1.7 5.2 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12.6 4.2a2.5 2.5 0 010 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </span>
              <span className="cmr-stat__body">
                <span className="cmr-stat__val">{analytics?.active_patients ?? '—'}</span>
                <span className="cmr-stat__key">Patients</span>
              </span>
            </button>

            <button className="cmr-stat" onClick={() => navigate('/care-manager/readmission?risk=high')}>
              <span className="cmr-stat__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 2.4l6.6 12H2.4L9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 7v3.2M9 12.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </span>
              <span className="cmr-stat__body">
                <span className="cmr-stat__val">{analytics?.high_risk_patients ?? '—'}</span>
                <span className="cmr-stat__key">High Risk</span>
              </span>
            </button>

            <button className="cmr-stat cmr-stat--blue" onClick={() => navigate('/care-manager/post-discharge')}>
              <span className="cmr-stat__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="3.2" width="14" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.5"/><path d="M6.4 15.4h5.2M9 12.8v2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </span>
              <span className="cmr-stat__body">
                <span className="cmr-stat__val">{analytics?.post_discharge_active_monitors ?? '—'}</span>
                <span className="cmr-stat__key">Monitored</span>
              </span>
            </button>

            <button className="cmr-stat" onClick={() => navigate('/care-manager/readmission')}>
              <span className="cmr-stat__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M1.8 9h2.4l1.5-4.2 2.4 8.4 2-6 1.4 3h2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <span className="cmr-stat__body">
                <span className="cmr-stat__val">
                  {analytics ? `${analytics.readmission_rate_pct.toFixed(1)}%` : '—'}
                </span>
                <span className="cmr-stat__key">Readmission Rate</span>
              </span>
            </button>
          </div>
        )}
      </section>

      {/* ── 2. Critical Alerts ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">Alerts</h3>
          {alerts.length > 0 && (
            <span className="cmr-badge cmr-badge--red">{alerts.length}</span>
          )}
        </header>
        {loading ? (
          <div className="cmr-skel">
            <Skeleton height={14} /><Skeleton height={14} width="80%" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="cmr-empty">
            <span style={{ marginRight: 6 }}>✅</span>No critical alerts right now.
          </p>
        ) : (
          <ul className="cmr-alertlist">
            {alerts.map((a, i) => (
              <li key={i}>
                <button className={`cmr-alert cmr-alert--${a.tone}`} onClick={a.go}>
                  <span className="cmr-alert__icon">{a.icon}</span>
                  <span className="cmr-alert__text">{a.text}</span>
                  <svg className="cmr-alert__arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 6h6M6.5 3.5L9 6l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. High-Risk Patients ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">High-Risk Patients</h3>
          <button
            className="cmr-card__link"
            onClick={() => navigate('/care-manager/readmission?risk=high')}
          >
            All →
          </button>
        </header>

        {loading || !enrichedAttempted ? (
          <div className="cmr-skel">
            <Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} />
          </div>
        ) : highRiskPatients.length === 0 ? (
          <p className="cmr-empty">No high-risk patients scored yet.</p>
        ) : (
          <>
            <ul className="cmr-hlist">
              {highRiskPatients.map(p => (
                <li key={p.id}>
                  <button
                    className="cmr-hrow"
                    onClick={() => navigate(`/care-manager/patients/${p.id}`)}
                  >
                    <span className="cmr-hrow__avatar">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                    <span className="cmr-hrow__info">
                      <span className="cmr-hrow__name">{p.name}</span>
                      {p.riskScore !== null && (
                        <span className="cmr-hrow__score">{Math.round(p.riskScore * 100)}%</span>
                      )}
                    </span>
                    <span className="cmr-hrow__when">{timeAgo(p.lastActivityAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="cmr-card__foot"
              onClick={() => navigate('/care-manager/readmission?risk=high')}
            >
              View all high-risk patients →
            </button>
          </>
        )}
      </section>

      {/* ── 4. Upcoming Appointments ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">Upcoming Appointments</h3>
          <button className="cmr-card__link" onClick={() => navigate('/care-manager/post-discharge')}>View all →</button>
        </header>

        {loading || !enrichedAttempted ? (
          <div className="cmr-skel">
            <Skeleton height={36} /><Skeleton height={36} />
          </div>
        ) : nextAppts.length === 0 ? (
          <ApptEmpty />
        ) : (
          <>
          <MiniCalendar appointments={appointments} />
          <ul className="cmr-list" style={{ marginTop: 10 }}>
            {nextAppts.map((a, i) => {
              const { time, day } = fmtDate(a.date);
              return (
                <li key={`${a.patientId}-${i}`}>
                  <button className="cmr-appt" onClick={() => navigate('/care-manager/post-discharge')}>
                    <span className="cmr-appt__dayblock">
                      <span className="cmr-appt__day">{day}</span>
                      <span className="cmr-appt__time">{time}</span>
                    </span>
                    <span className="cmr-appt__info">
                      <span className="cmr-appt__name">{a.patientName}</span>
                      <span className="cmr-appt__kind">{a.kind}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </section>

      {/* ── 5. Tasks ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">Care Plan Tasks</h3>
          <span className="cmr-card__count">
            {completedTasks.length}/{tasks.length} done
          </span>
        </header>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="cmr-taskprog">
            <div
              className="cmr-taskprog__fill"
              style={{ width: `${taskCompletionPct ?? 0}%` }}
            />
            <span className="cmr-taskprog__pct">{taskCompletionPct ?? 0}%</span>
          </div>
        )}

        {loading || !enrichedAttempted ? (
          <div className="cmr-skel" style={{ marginTop: 8 }}>
            <Skeleton height={14} /><Skeleton height={14} width="75%" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState compact icon="✅" title="No tasks" message="No care-plan tasks returned yet." />
        ) : (
          <ul className="cmr-tasks">
            {[...pendingTasks, ...completedTasks].slice(0, 6).map(t => {
              const done = localDone[t.id] ?? t.status === 'completed';
              return (
                <li key={t.id}>
                  <button
                    className={`cmr-task${done ? ' cmr-task--done' : ''}`}
                    onClick={() => toggleTask(t)}
                  >
                    <span className={`cmr-task__box${done ? ' cmr-task__box--on' : ''}`} aria-hidden="true">
                      {done ? '✓' : ''}
                    </span>
                    <span className="cmr-task__text">
                      <span className="cmr-task__label">{t.label}</span>
                      <span className="cmr-task__who">{t.patientName}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {tasks.length > 6 && (
              <li>
                <p className="cmr-tasks__more">+{tasks.length - 6} more tasks</p>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ── 6. System pulse (real numbers only) ── */}
      {!loading && analytics && (
        <section className="cmr-card cmr-pulse">
          <header className="cmr-card__head">
            <h3 className="cmr-card__title">System Pulse</h3>
          </header>
          <ul className="cmr-pulse__list">
            <li className="cmr-pulse__row">
              <span>Safety evaluations</span>
              <strong>{analytics.total_safety_evaluations.toLocaleString()}</strong>
            </li>
            <li className="cmr-pulse__row">
              <span>Emergency alerts</span>
              <strong className={analytics.emergency_alerts_triggered > 0 ? 'cmr-pulse__warn' : ''}>
                {analytics.emergency_alerts_triggered}
              </strong>
            </li>
            <li className="cmr-pulse__row">
              <span>Active monitors</span>
              <strong>{analytics.post_discharge_active_monitors}</strong>
            </li>
            <li className="cmr-pulse__row">
              <span>Low risk patients</span>
              <strong className="cmr-pulse__ok">{analytics.low_risk_patients}</strong>
            </li>
          </ul>
          <p className="cmr-pulse__ts">
            Last synced {new Date(analytics.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </section>
      )}

    </div>
  );
}

/* ── Appointments empty state ────────────────────────────────────────────── */
/**
 * Shown when the post-discharge agents return no scheduled appointments.
 * The date block reflects today's real date.
 */
function ApptEmpty() {
  const now = new Date();
  const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = now.getDate();

  return (
    <div className="cmr-apptempty">
      <span className="cmr-apptempty__date">
        <span className="cmr-apptempty__mon">{month}</span>
        <span className="cmr-apptempty__day">{day}</span>
      </span>
      <span className="cmr-apptempty__text">
        <span className="cmr-apptempty__title">No upcoming appointments</span>
        <span className="cmr-apptempty__sub">You're all caught up!</span>
      </span>
      <span className="cmr-apptempty__art" aria-hidden="true">
        <svg width="44" height="40" viewBox="0 0 48 44" fill="none">
          <rect x="7" y="9" width="30" height="28" rx="3.5" fill="#fdece4" stroke="#f2846b" strokeWidth="1.6" />
          <path d="M7 17h30" stroke="#f2846b" strokeWidth="1.6" />
          <path d="M15 6v6M29 6v6" stroke="#f2846b" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="13" y="22" width="6" height="5" rx="1.2" fill="#f2846b" opacity="0.55" />
          <rect x="22" y="22" width="6" height="5" rx="1.2" fill="#f2846b" opacity="0.3" />
          <rect x="13" y="29" width="6" height="4" rx="1.2" fill="#f2846b" opacity="0.3" />
        </svg>
      </span>
    </div>
  );
}

/* ── Mini Calendar ───────────────────────────────────────────────────────── */
function MiniCalendar({ appointments }: { appointments: DerivedAppointment[] }) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const today = new Date();
  const year = month.getFullYear();
  const mo = month.getMonth();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const firstDow = new Date(year, mo, 1).getDay();
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const apptDays = new Set<number>();
  for (const a of appointments) {
    const d = new Date(a.date);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === mo) {
      apptDays.add(d.getDate());
    }
  }

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === mo && today.getDate() === day;

  return (
    <div className="cmr-cal">
      <div className="cmr-cal__nav">
        <button className="cmr-cal__navbtn" onClick={() => setMonth(new Date(year, mo - 1, 1))} aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="cmr-cal__month">{monthLabel}</span>
        <button className="cmr-cal__navbtn" onClick={() => setMonth(new Date(year, mo + 1, 1))} aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="cmr-cal__header">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <span key={d} className="cmr-cal__dow">{d}</span>
        ))}
      </div>
      <div className="cmr-cal__grid">
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={`e${i}`} className="cmr-cal__cell" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          return (
            <span
              key={day}
              className={[
                'cmr-cal__cell',
                isToday(day) ? 'cmr-cal__cell--today' : '',
                apptDays.has(day) ? 'cmr-cal__cell--appt' : '',
              ].filter(Boolean).join(' ')}
            >
              {day}
              {apptDays.has(day) && <span className="cmr-cal__dot" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}
