/**
 * CarePath — Reschedule Appointment Modal
 *
 * NOTE (temporary — frontend-only simulation):
 * The real Shared Appointment Agent (POST /care/appointments/reschedule)
 * is not wired up yet on the backend, so this modal generates a set of
 * plausible open slots on the client and applies the reschedule directly
 * to the local appointment store when the patient confirms. No network
 * call is made. Once the real reschedule route is ready, replace
 * `generateLocalSlots()` + the local update in `handleConfirm()` with a
 * call to `careService.reschedule(...)` (already implemented in
 * services/careService.ts) — the rest of the UI stays the same.
 */
import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import type { AppointmentResponse, Slot } from '../services/careService';
import { appointmentStore, type StoredAppointment } from '../services/appointmentStore';

interface RescheduleModalProps {
  open: boolean;
  appointment: StoredAppointment | null;
  patientId: string | null;
  onClose: () => void;
  onRescheduled?: (updated: StoredAppointment) => void;
}

const SLOT_HOURS = [9, 11, 14, 16]; // 9am, 11am, 2pm, 4pm
const DAYS_AHEAD = 7;

/** Build a short-term list of open-looking slots for the given provider.
 *  Frontend-only stand-in until the real availability endpoint is ready. */
function generateLocalSlots(providerId: string): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();
  for (let d = 1; d <= DAYS_AHEAD; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (day.getDay() === 0) continue; // skip Sundays
    for (const hour of SLOT_HOURS) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);
      slots.push({
        slot_id: `local_${start.getTime()}`,
        provider_id: providerId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
    }
  }
  return slots;
}

export default function RescheduleModal({ open, appointment, patientId, onClose, onRescheduled }: RescheduleModalProps) {
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !appointment) return;
    setSelectedSlot(null);
    setLoadingSlots(true);
    // Simulate a brief lookup so the UI doesn't feel instantaneous/fake.
    const t = setTimeout(() => {
      setSlots(generateLocalSlots(appointment.provider_id));
      setLoadingSlots(false);
    }, 350);
    return () => clearTimeout(t);
  }, [open, appointment]);

  const handleConfirm = async () => {
    if (!appointment || !patientId || !selectedSlot) return;
    setSubmitting(true);
    try {
      // TODO(real backend): swap this block for
      //   const res = await careService.reschedule({
      //     patient_id: patientId,
      //     appointment_id: appointment.appointment_id,
      //     recommendation_id: appointment.recommendation_id ?? undefined,
      //     new_slot_id: selectedSlot.slot_id,
      //   });
      // once POST /care/appointments/reschedule is live, then pass `res`
      // (instead of `localResponse`) into appointmentStore.upsertFromResponse.
      await new Promise((r) => setTimeout(r, 500));
      const localResponse: AppointmentResponse = {
        appointment_id: appointment.appointment_id,
        patient_id: patientId,
        status: 'RESCHEDULED',
        provider_id: appointment.provider_id,
        provider_name: appointment.provider_name,
        care_type: appointment.care_type,
        specialty: appointment.specialty,
        hospital_id: appointment.hospital_id,
        hospital_name: appointment.hospital_name,
        slot: selectedSlot,
        date: selectedSlot.start_time.slice(0, 10),
        time: selectedSlot.start_time.slice(11, 16),
      };
      const updated = appointmentStore.upsertFromResponse(localResponse, appointment.recommendation_id ?? undefined, null);
      toast.success('Appointment rescheduled.');
      onRescheduled?.(updated);
      onClose();
    } catch {
      toast.error('Something went wrong while rescheduling. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  const byDay = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const key = new Date(s.start_time).toDateString();
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Modal
      open={open}
      title="Reschedule Appointment"
      subtitle={appointment.provider_name ?? 'Your provider'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="cp-btn cp-btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="cp-btn cp-btn--primary"
            onClick={() => void handleConfirm()}
            disabled={!selectedSlot || submitting}
          >
            {submitting ? <><span className="cp-btn__spinner" /> Rescheduling…</> : 'Confirm New Time'}
          </button>
        </>
      }
    >
      {loadingSlots && <p className="cp-modal__text">Finding open times…</p>}

      {!loadingSlots && Object.keys(byDay).length === 0 && (
        <p className="cp-modal__text">No open times found for this provider.</p>
      )}

      {!loadingSlots && Object.entries(byDay).map(([day, daySlots]) => (
        <div key={day} className="rsm-day-group">
          <p className="rsm-day-label">
            {new Date(daySlots[0].start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <div className="rsm-time-grid">
            {daySlots.map((s) => {
              const active = selectedSlot?.slot_id === s.slot_id;
              return (
                <button
                  key={s.slot_id}
                  className={`rsm-time-chip${active ? ' rsm-time-chip--active' : ''}`}
                  onClick={() => setSelectedSlot(s)}
                  type="button"
                >
                  {new Date(s.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Modal>
  );
}
