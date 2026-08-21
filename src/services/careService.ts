/**
 * CarePath — Care Navigation & Appointments Service
 *
 * Verified against the live OpenAPI spec (mounted at /api/v1/care).
 * This is the agentic "what care do I need / book it" flow that runs
 * after the ED-avoidability model on a non-emergency verdict.
 *
 *   POST /care/navigate                        route to a destination + providers
 *   POST /care/chat                            conversational booking agent
 *   POST /care/appointments/availability       open slots for a provider
 *   POST /care/appointments/book               book a slot
 *   POST /care/appointments/reschedule         move an existing appointment
 *   POST /care/appointments/cancel             cancel an appointment
 *   GET  /care/appointments/{appointment_id}   live status
 */

import client from './apiClient';

// ── Enums ─────────────────────────────────────────────────────────────────────

export type CareType = 'PCP' | 'URGENT_CARE' | 'SPECIALIST' | 'TELEHEALTH' | 'DENTISTRY';
export type AppointmentStatus = 'BOOKED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';

// ── Shared shapes ──────────────────────────────────────────────────────────────

export interface Slot {
  slot_id: string;
  provider_id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
}

export interface Provider {
  provider_id: string;
  name: string;
  destination_type: CareType;
  specialty?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  distance_km?: number | null;
  score?: number | null;
  source?: string;
}

export interface NavigateDecision {
  rule_id: string;
  priority: number;
  destination: CareType;
  specialty?: string | null;
  status: string;
  explanation: string;
}

// ── Requests ────────────────────────────────────────────────────────────────────

/** Clinical snapshot for routing. Only primary_symptom_category is required. */
export interface NavigatePatientInput {
  primary_symptom_category: string;
  pain_level_self_reported?: number | null;
  pain_onset?: string | null;
  pain_duration?: string | null;
  pain_location?: string | null;
  symptom_trend?: string | null;
  copd_asthma_flag?: number | null;
  cardiac_history_flag?: number | null;
  diabetes_flag?: number | null;
  ckd_flag?: number | null;
  cancer_flag?: number | null;
  immunocompromised_flag?: number | null;
  hypertension_flag?: number | null;
  chronic_condition_count?: number | null;
  charlson_comorbidity_index?: number | null;
  ed_visits_past_year?: number | null;
  admissions_past_year?: number | null;
  has_pcp_flag?: number | null;
  age?: number | null;
  gender?: string | null;
}

export interface LocationInput {
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number;
  address?: string | null;
}

export interface NavigateRequest {
  mrn: string;
  patient: NavigatePatientInput;
  location: LocationInput;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface NavigateResponse {
  recommendation_id: string;
  mrn?: string | null;
  decision: NavigateDecision;
  top_providers: Provider[];
  appointment_operations_performed?: boolean | null;
  appointment_results?: Record<string, unknown>[] | null;
  appointment_agent_response?: string | null;
  nearby_providers?: Record<string, unknown>[] | null;
}

export interface AvailabilityResponse {
  available_slots: Slot[];
  provider_id?: string | null;
  care_type?: CareType | null;
  specialty?: string | null;
}

/** book / reschedule return the full appointment with its slot */
export interface AppointmentResponse {
  appointment_id: string;
  patient_id: string;
  status: AppointmentStatus;
  provider_id: string;
  provider_name?: string | null;
  care_type?: CareType | null;
  specialty?: string | null;
  hospital_id?: string | null;
  hospital_name?: string | null;
  slot: Slot;
  date?: string | null;
  time?: string | null;
}

/** cancel / get-status return a lighter payload (slot may be null) */
export interface AppointmentStatusResponse {
  appointment_id: string;
  patient_id: string;
  status: AppointmentStatus;
  provider_id?: string | null;
  provider_name?: string | null;
  care_type?: CareType | null;
  slot?: Slot | null;
}

export interface CareChatResponse {
  recommendation_id: string;
  mrn: string;
  response: string;
  workflow_stage: string;
  selected_provider_id?: string | null;
  selected_provider_name?: string | null;
  available_slots?: Slot[] | null;
  selected_slot_id?: string | null;
  appointment_id?: string | null;
  appointment_status?: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const careService = {
  /** POST /care/navigate — routing decision + ranked providers */
  navigate: (payload: NavigateRequest) =>
    client.post<NavigateResponse>('/care/navigate', payload).then((r) => r.data),

  /** POST /care/chat — conversational booking agent */
  chat: (recommendation_id: string, message: string) =>
    client.post<CareChatResponse>('/care/chat', { recommendation_id, message }).then((r) => r.data),

  /** POST /care/appointments/availability — open slots for a provider */
  availability: (payload: {
    recommendation_id: string;
    provider_id: string;
    date_range?: string;
    patient_id?: string | null;
  }) =>
    client.post<AvailabilityResponse>('/care/appointments/availability', payload).then((r) => r.data),

  /** POST /care/appointments/book */
  book: (payload: {
    patient_id: string;
    recommendation_id: string;
    provider_id: string;
    slot_id: string;
  }) =>
    client.post<AppointmentResponse>('/care/appointments/book', payload).then((r) => r.data),

  /** POST /care/appointments/reschedule */
  reschedule: (payload: {
    patient_id: string;
    appointment_id: string;
    recommendation_id?: string | null;
    new_slot_id?: string | null;
    preferred_date?: string | null;
    preferred_time?: string | null;
  }) =>
    client.post<AppointmentResponse>('/care/appointments/reschedule', payload).then((r) => r.data),

  /** POST /care/appointments/cancel */
  cancel: (payload: { patient_id: string; appointment_id: string }) =>
    client.post<AppointmentStatusResponse>('/care/appointments/cancel', payload).then((r) => r.data),

  /** GET /care/appointments/{appointment_id} — live status */
  getStatus: (appointment_id: string, patient_id?: string) =>
    client
      .get<AppointmentStatusResponse>(`/care/appointments/${encodeURIComponent(appointment_id)}`, {
        params: patient_id ? { patient_id } : undefined,
      })
      .then((r) => r.data),
};

export default careService;
