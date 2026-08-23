/**
 * CarePath — Reschedule Appointment Modal
 * Fetches REAL available slots from backend API
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
    
    // Fetch REAL available slots from backend
    const fetchSlots = async () => {
      try {
        const token = localStorage.getItem('cp_token');
        if (!token) {
          throw new Error('Please log in to view available slots');
        }
        
        const response = await fetch(
          `http://localhost:8000/api/v1/providers/${appointment.provider_id}/available-slots?days_ahead=7`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch available slots');
        }
        
        const realSlots = await response.json();
        setSlots(realSlots);
      } catch (error) {
        console.error('Failed to fetch slots:', error);
        toast.error('Failed to load available slots');
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    
    void fetchSlots();
  }, [open, appointment, toast]);

  const handleConfirm = async () => {
    if (!appointment || !patientId || !selectedSlot) return;
    setSubmitting(true);
    try {
      // Call the REAL reschedule API
      const token = localStorage.getItem('cp_token');
      if (!token) {
        throw new Error('Please log in to reschedule appointments');
      }
      
      const response = await fetch(`http://localhost:8000/api/v1/patients/${patientId}/appointments/${appointment.appointment_id}/reschedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_slot_id: selectedSlot.slot_id,
          reason: 'Rescheduled by patient'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to reschedule appointment');
      }
      
      const result = await response.json();
      
      // Update local store with new data
      const localResponse: AppointmentResponse = {
        appointment_id: appointment.appointment_id,
        patient_id: patientId,
        status: 'BOOKED',
        provider_id: appointment.provider_id,
        provider_name: appointment.provider_name,
        care_type: appointment.care_type,
        specialty: appointment.specialty,
        hospital_id: appointment.hospital_id,
        hospital_name: appointment.hospital_name,
        slot: {
          slot_id: result.new_slot_id,
          provider_id: appointment.provider_id,
          start_time: result.new_start_time,
          end_time: result.new_end_time
        },
        date: result.new_start_time.slice(0, 10),
        time: new Date(result.new_start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
      const updated = appointmentStore.upsertFromResponse(localResponse, appointment.recommendation_id ?? undefined, null);
      toast.success('Appointment rescheduled successfully!');
      onRescheduled?.(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to reschedule:', err);
      toast.error(err.message || 'Something went wrong while rescheduling. Please try again.');
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
