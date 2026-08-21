/**
 * CarePath — Local Appointment Store
 *
 * The backend care API has no "list appointments" endpoint — only book,
 * reschedule, cancel and get-by-id. So appointments booked through the
 * care-navigation flow are tracked client-side (per patient) and their
 * status is refreshed on demand via careService.getStatus().
 *
 * A lightweight pub/sub (window event) keeps the sidebar badge and the
 * Appointments page in sync whenever the store changes.
 */

import type { AppointmentResponse, AppointmentStatus, Slot, CareType } from './careService';

const KEY = 'cp_appointments';
const EVENT = 'cp:appointments';

export interface StoredAppointment {
  appointment_id: string;
  patient_id: string;
  provider_id: string;
  provider_name?: string | null;
  care_type?: CareType | null;
  specialty?: string | null;
  hospital_name?: string | null;
  hospital_id?: string | null;
  /** Provider lat/lng from /navigate nearby_providers — saved at booking time */
  provider_lat?: number | null;
  provider_lng?: number | null;
  /** Provider address from OSM (frequently null) */
  provider_address?: string | null;
  slot?: Slot | null;
  date?: string | null;
  time?: string | null;
  status: AppointmentStatus;
  recommendation_id?: string | null;
  created_at: string;
  updated_at: string;
}

function readAll(): StoredAppointment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAppointment[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: StoredAppointment[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const appointmentStore = {
  /** All appointments for a patient, newest first. */
  list(patientId?: string): StoredAppointment[] {
    const all = readAll();
    const scoped = patientId ? all.filter((a) => a.patient_id === patientId) : all;
    return scoped.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  /** Count of appointments still needing attention (active bookings). */
  activeCount(patientId?: string): number {
    return this.list(patientId).filter(
      (a) => a.status === 'BOOKED' || a.status === 'RESCHEDULED',
    ).length;
  },

  /** Insert or update from a book/reschedule response. */
  upsertFromResponse(
    res: AppointmentResponse,
    recommendationId?: string | null,
    providerCoords?: { lat: number; lng: number; address?: string | null } | null,
  ): StoredAppointment {
    const all = readAll();
    const now = new Date().toISOString();
    const existing = all.find((a) => a.appointment_id === res.appointment_id);
    const record: StoredAppointment = {
      appointment_id: res.appointment_id,
      patient_id: res.patient_id,
      provider_id: res.provider_id,
      provider_name: res.provider_name ?? existing?.provider_name ?? null,
      care_type: res.care_type ?? existing?.care_type ?? null,
      specialty: res.specialty ?? existing?.specialty ?? null,
      hospital_name: res.hospital_name ?? existing?.hospital_name ?? null,
      hospital_id: res.hospital_id ?? existing?.hospital_id ?? null,
      provider_lat: providerCoords?.lat ?? existing?.provider_lat ?? null,
      provider_lng: providerCoords?.lng ?? existing?.provider_lng ?? null,
      provider_address: providerCoords?.address ?? existing?.provider_address ?? null,
      slot: res.slot ?? existing?.slot ?? null,
      date: res.date ?? existing?.date ?? null,
      time: res.time ?? existing?.time ?? null,
      status: res.status,
      recommendation_id: recommendationId ?? existing?.recommendation_id ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const next = existing
      ? all.map((a) => (a.appointment_id === res.appointment_id ? record : a))
      : [record, ...all];
    writeAll(next);
    return record;
  },

  /** Update just the status (e.g. after a status refresh or cancel). */
  updateStatus(appointmentId: string, status: AppointmentStatus): void {
    const all = readAll();
    let changed = false;
    const next = all.map((a) => {
      if (a.appointment_id === appointmentId && a.status !== status) {
        changed = true;
        return { ...a, status, updated_at: new Date().toISOString() };
      }
      return a;
    });
    if (changed) writeAll(next);
  },

  remove(appointmentId: string): void {
    writeAll(readAll().filter((a) => a.appointment_id !== appointmentId));
  },

  /** Subscribe to store changes; returns an unsubscribe fn. */
  subscribe(cb: () => void): () => void {
    const handler = () => cb();
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler); // cross-tab
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  },
};

export default appointmentStore;
