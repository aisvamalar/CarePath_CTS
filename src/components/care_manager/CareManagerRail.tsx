/**
 * CarePath — Care Manager right-hand workspace.
 * Reminders, appointments and tasks are all derived from live backend data.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CareManagerData, DerivedTask } from '../../hooks/useCareManagerData';
import { Skeleton, EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';

function formatTime(raw: string): { time: string; day: string } {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { time: raw, day: '' };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const day = sameDay(d, today)
    ? 'Today'
    : sameDay(d, tomorrow)
      ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return { time, day };
}

export default function CareManagerRail({ data }: { data: CareManagerData }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { analytics, tasks, appointments, loading, enrichedAttempted } = data;

  /** Local completion state — the backend exposes no task mutation endpoint. */
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});

  const reminders = useMemo(() => {
    if (!analytics) return [];
    const list: { icon: string; tone: string; text: string; when: string; go?: () => void }[] = [];

    if (analytics.high_risk_patients > 0) {
      list.push({
        icon: '⚠',
        tone: 'warn',
        text: `${analytics.high_risk_patients} high-risk patient${analytics.high_risk_patients === 1 ? '' : 's'} need review`,
        when: 'Today',
        go: () => navigate('/care-manager/readmission?risk=high'),
      });
    }
    if (analytics.post_discharge_active_monitors > 0) {
      list.push({
        icon: '☎',
        tone: 'ok',
        text: `${analytics.post_discharge_active_monitors} post-discharge monitor${analytics.post_discharge_active_monitors === 1 ? '' : 's'} active`,
        when: 'Today',
        go: () => navigate('/care-manager/post-discharge'),
      });
    }
    if (appointments.length > 0) {
      list.push({
        icon: '▣',
        tone: 'info',
        text: `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} to prepare for`,
        when: 'Today',
        go: () => navigate('/care-manager/post-discharge'),
      });
    }
    if (analytics.emergency_alerts_triggered > 0) {
      list.push({
        icon: '✚',
        tone: 'warn',
        text: `${analytics.emergency_alerts_triggered} emergency alert${analytics.emergency_alerts_triggered === 1 ? '' : 's'} triggered`,
        when: 'Review',
        go: () => navigate('/care-manager/analytics'),
      });
    }
    return list;
  }, [analytics, appointments, navigate]);

  const openTasks = useMemo(
    () => tasks.filter((t) => (localDone[t.id] ?? t.status === 'completed') === false),
    [tasks, localDone],
  );
  const doneTasks = useMemo(
    () => tasks.filter((t) => (localDone[t.id] ?? t.status === 'completed') === true),
    [tasks, localDone],
  );

  const toggleTask = (t: DerivedTask) => {
    const currently = localDone[t.id] ?? t.status === 'completed';
    setLocalDone((prev) => ({ ...prev, [t.id]: !currently }));
    // Be explicit that this is not persisted — no backend task endpoint exists.
    toast.notify(
      !currently
        ? 'Marked complete for this session only (no task API on the backend yet).'
        : 'Reopened for this session only.',
      'info',
    );
  };

  return (
    <div className="cmr">
      {/* ── Reminders ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">Today's Reminders</h3>
          <button className="cmr-card__link" onClick={() => navigate('/care-manager/analytics')}>View all</button>
        </header>

        {loading ? (
          <div className="cmr-skel">
            <Skeleton height={14} /><Skeleton height={14} width="80%" /><Skeleton height={14} width="65%" />
          </div>
        ) : reminders.length === 0 ? (
          <p className="cmr-empty">Nothing needs your attention right now.</p>
        ) : (
          <ul className="cmr-list">
            {reminders.map((r, i) => (
              <li key={i}>
                <button className="cmr-row" onClick={r.go} disabled={!r.go}>
                  <span className={`cmr-row__icon cmr-row__icon--${r.tone}`} aria-hidden="true">{r.icon}</span>
                  <span className="cmr-row__text">{r.text}</span>
                  <span className="cmr-row__when">{r.when}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Appointments ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">Upcoming Appointments</h3>
          <button className="cmr-card__link" onClick={() => navigate('/care-manager/post-discharge')}>View all</button>
        </header>

        {loading || !enrichedAttempted ? (
          <div className="cmr-skel">
            <Skeleton height={38} /><Skeleton height={38} />
          </div>
        ) : appointments.length === 0 ? (
          <p className="cmr-empty">No scheduled appointments returned by the backend.</p>
        ) : (
          <ul className="cmr-list">
            {appointments.slice(0, 4).map((a, i) => {
              const { time, day } = formatTime(a.date);
              return (
                <li key={`${a.patientId}-${i}`}>
                  <button className="cmr-appt" onClick={() => navigate('/care-manager/post-discharge')}>
                    <span className="cmr-appt__time">
                      <strong>{time}</strong>
                    </span>
                    <span className="cmr-appt__info">
                      <span className="cmr-appt__name">{a.patientName}</span>
                      <span className="cmr-appt__kind">{a.kind}</span>
                    </span>
                    <span className="cmr-row__when">{day}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button className="cmr-card__cta" onClick={() => navigate('/care-manager/post-discharge')}>
          Go to post discharge →
        </button>
      </section>

      {/* ── Tasks ── */}
      <section className="cmr-card">
        <header className="cmr-card__head">
          <h3 className="cmr-card__title">My Tasks</h3>
          <span className="cmr-card__count">{openTasks.length} open</span>
        </header>

        {loading || !enrichedAttempted ? (
          <div className="cmr-skel">
            <Skeleton height={14} /><Skeleton height={14} width="75%" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            compact
            icon="✅"
            title="No care-plan tasks"
            message="The post-discharge agents have not returned any tasks yet."
          />
        ) : (
          <ul className="cmr-tasks">
            {[...openTasks, ...doneTasks].slice(0, 6).map((t) => {
              const done = localDone[t.id] ?? t.status === 'completed';
              return (
                <li key={t.id}>
                  <button className={`cmr-task${done ? ' cmr-task--done' : ''}`} onClick={() => toggleTask(t)}>
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
          </ul>
        )}
      </section>

      {/* ── Operational tip (no clinical claims) ── */}
      <section className="cmr-tip">
        <span className="cmr-tip__icon" aria-hidden="true">💡</span>
        <div>
          <p className="cmr-tip__title">Care Manager Tip</p>
          <p className="cmr-tip__body">
            Run a readmission prediction after updating a patient's record so the risk
            score reflects the latest clinical data.
          </p>
        </div>
      </section>
    </div>
  );
}
