import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { careService, type CareType } from '../services/careService';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';
import { toApiError } from '../services/apiClient';

const CARE_TYPE_LABEL: Record<string, string> = {
  PCP: 'Primary Care',
  URGENT_CARE: 'Urgent Care',
  SPECIALIST: 'Specialist',
  TELEHEALTH: 'Telehealth',
  DENTISTRY: 'Dentistry',
};

function formatWhen(a: StoredAppointment): string {
  if (a.slot?.start_time) {
    return new Date(a.slot.start_time).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }
  const parts = [a.date, a.time].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Time to be confirmed';
}

function titleFor(a: StoredAppointment): string {
  const type = a.specialty ?? CARE_TYPE_LABEL[a.care_type as CareType] ?? a.care_type ?? 'Appointment';
  return a.provider_name ? `${type} · ${a.provider_name}` : `${type} Visit`;
}

export default function Appointments() {
  const navigate = useNavigate();
  const { state } = useApp();
  const patientId = state.patient?.patient_id ?? null;

  const [items, setItems] = useState<StoredAppointment[]>(() => appointmentStore.list(patientId ?? undefined));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Keep in sync with the store (bookings made in chat, other tabs, etc.)
  useEffect(() => {
    const refresh = () => setItems(appointmentStore.list(patientId ?? undefined));
    refresh();
    return appointmentStore.subscribe(refresh);
  }, [patientId]);

  // Refresh live status for active appointments on mount.
  useEffect(() => {
    const active = appointmentStore
      .list(patientId ?? undefined)
      .filter((a) => a.status === 'BOOKED' || a.status === 'RESCHEDULED');
    if (active.length === 0) return;
    let cancelled = false;
    void (async () => {
      await Promise.allSettled(
        active.map(async (a) => {
          try {
            const res = await careService.getStatus(a.appointment_id, patientId ?? undefined);
            if (!cancelled) appointmentStore.updateStatus(a.appointment_id, res.status);
          } catch { /* best-effort */ }
        }),
      );
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const handleCancel = useCallback(async (a: StoredAppointment) => {
    if (!patientId) return;
    setBusyId(a.appointment_id);
    setError('');
    try {
      const res = await careService.cancel({ patient_id: patientId, appointment_id: a.appointment_id });
      appointmentStore.updateStatus(a.appointment_id, res.status);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusyId(null);
    }
  }, [patientId]);

  const upcoming = items.filter((a) => a.status === 'BOOKED' || a.status === 'RESCHEDULED');
  const past = items.filter((a) => a.status === 'COMPLETED' || a.status === 'CANCELLED');

  return (
    <div className="apt-page">
      <div className="apt-header">
        <button className="btn-ghost" onClick={() => navigate('/chat')} style={{ marginRight: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 className="apt-title">Appointments</h1>
      </div>

      <div className="apt-content">
        {error && <div className="apt-card apt-card--pending" role="alert" style={{ color: '#d92d20' }}>{error}</div>}

        {items.length === 0 && (
          <section className="apt-section">
            <div className="apt-card">
              <h3 className="apt-card__title">No appointments yet</h3>
              <p className="apt-card__date">Complete a symptom assessment to get a care recommendation and book a visit.</p>
              <div className="apt-card__actions">
                <button className="apt-btn apt-btn--primary" onClick={() => navigate('/chat')}>
                  Start assessment
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="apt-section">
            <div className="apt-section__badge apt-section__badge--warn">
              <span className="apt-badge-dot apt-badge-dot--warn" />
              UPCOMING APPOINTMENTS
            </div>

            {upcoming.map((a) => (
              <div key={a.appointment_id} className="apt-card apt-card--pending">
                <h3 className="apt-card__title">{titleFor(a)}</h3>
                <p className="apt-card__date">({formatWhen(a)})</p>
                {a.hospital_name && (
                  <div className="apt-card__detail">
                    <span className="apt-card__label">Location:</span> {a.hospital_name}
                  </div>
                )}
                <div className="apt-card__detail">
                  <span className="apt-card__label">Status:</span> {a.status}
                </div>
                <div className="apt-card__detail">
                  <span className="apt-card__label">Ref:</span> {a.appointment_id}
                </div>

                <div className="apt-card__actions">
                  <button className="apt-btn apt-btn--outline" onClick={() => navigate('/chat')}>
                    Reschedule
                  </button>
                  <button
                    className="apt-btn apt-btn--ghost"
                    onClick={() => handleCancel(a)}
                    disabled={busyId === a.appointment_id}
                  >
                    {busyId === a.appointment_id ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Past / cancelled */}
        {past.length > 0 && (
          <section className="apt-section">
            <div className="apt-section__badge apt-section__badge--success">
              <span className="apt-badge-dot apt-badge-dot--success" />
              PAST &amp; CANCELLED
            </div>

            <div className="apt-list">
              {past.map((a) => (
                <div key={a.appointment_id} className="apt-confirmed-card">
                  <div className="apt-confirmed-card__check">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--cp-coral)" fillOpacity="0.1" stroke="var(--cp-coral)" strokeWidth="1.5"/>
                      <path d="M4.5 8L7 10.5L11.5 5.5" stroke="var(--cp-coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="apt-confirmed-card__title">{titleFor(a)}</p>
                    <p className="apt-confirmed-card__date">{formatWhen(a)} · {a.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
