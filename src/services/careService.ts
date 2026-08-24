/**
 * Post-Care Service — Patient Care Plan Management
 * Handles initial care plan generation and async patient responses
 */

import client from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CareTask {
  task_id: string;
  task_type: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  scheduled_date?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FollowUpCheckIn {
  checkin_id: string;
  message: string;
  status: 'SCHEDULED' | 'SENT' | 'RESPONDED' | 'COMPLETED';
  response?: string;
  response_received_at?: string;
  classification?: 'NORMAL' | 'CONCERN' | 'URGENT';
}

export interface CarePlan {
  care_plan_id: string;
  mrn: string;
  risk_level: 'HIGH' | 'MODERATE' | 'LOW';
  intensity: 'INTENSIVE' | 'REGULAR' | 'BASIC';
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  doctor_instructions?: string;
  tasks: CareTask[];
  created_at: string;
  updated_at: string;
}

export interface CareGenerationResponse {
  status: 'success' | 'error';
  care_plan_id: string;
  risk_level: string;
  intensity: string;
  tasks: CareTask[];
  follow_up?: FollowUpCheckIn;
  message?: string;
}

export interface AppointmentInfo {
  session_id: string;
  destination: string;
  specialty?: string;
  providers_found?: number;
  workflow_stage: string;
  message: string;
}

export interface PatientResponseResult {
  status: 'NORMAL' | 'CONCERN' | 'URGENT' | 'ERROR';
  care_plan_id: string;
  revised?: boolean;
  new_tasks?: CareTask[];
  appointment?: AppointmentInfo;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alternate Care Navigation Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientFeatures {
  primary_symptom_category: string;
  pain_level_self_reported?: number | null;
  pain_location?: string | null;
  pain_onset?: string | null;
  age?: number | null;
  gender?: string | null;
}

export interface PatientLocation {
  latitude: number;
  longitude: number;
  address?: string | null;
  radius_km?: number;
}

export interface CareDecision {
  destination: string;
  specialty?: string;
  explanation: string;
  rule_id?: string;
}

export interface Provider {
  provider_id: string;
  name: string;
  destination_type: string;
  specialty?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  distance_km?: number;
}

export interface Slot {
  slot_id: string;
  provider_id: string;
  start_time: string;
  end_time: string;
}

export interface NavigateRequest {
  mrn: string;
  patient: PatientFeatures;
  location: PatientLocation;
}

export interface NavigateResponse {
  recommendation_id: string;
  mrn: string;
  decision: CareDecision;
  top_providers: Provider[];
  appointment_agent_response?: string;
  nearby_providers?: any[];
}

export interface AvailabilityRequest {
  recommendation_id: string;
  provider_id: string;
  patient_id?: string;
  date_range?: 'next_7_days' | 'next_30_days';
}

export interface AvailabilityResponse {
  available_slots: Slot[];
  provider_id: string;
  care_type: string;
  specialty?: string;
}

export interface BookingRequest {
  patient_id: string;
  recommendation_id: string;
  provider_id: string;
  slot_id: string;
}

export interface BookingResponse {
  appointment_id: string;
  patient_id: string;
  status: string;
  provider_id: string;
  provider_name: string;
  care_type: string;
  specialty?: string;
  slot: Slot;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────────────────────────────────────

export const careService = {
  /**
   * Initial care plan generation (Phase 1)
   * Triggers the non-blocking agentic workflow
   */
  generateCarePlan: (mrn: string) =>
    client
      .post<CareGenerationResponse>(`/patients/${mrn}/post-care/generate`)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to generate care plan:', err);
        throw err;
      }),

  /**
   * Submit patient response to follow-up check-in (Phase 2)
   * May trigger care plan revision or appointment booking
   */
  submitResponse: (patientId: string, response: string) =>
    client
      .post<PatientResponseResult>(`/patients/${patientId}/care-plan-response`, {
        patient_response: response,
      })
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to submit patient response:', err);
        throw err;
      }),

  /**
   * Get current patient's active care plan (uses JWT token)
   */
  getMyCarePlan: () =>
    client
      .get<CarePlan>('/my-care-plan')
      .then((res) => res.data),

  /**
   * Get current active care plan for a patient
   */
  getCarePlan: (mrn: string) =>
    client
      .get<CarePlan>(`/patients/${mrn}/care-plan`)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to fetch care plan:', err);
        throw err;
      }),

  /**
   * Get care plan by ID
   */
  getCarePlanById: (carePlanId: string) =>
    client
      .get<CarePlan>(`/care-plans/${carePlanId}`)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to fetch care plan by ID:', err);
        throw err;
      }),

  /**
   * Get all check-ins for a care plan
   */
  getCheckIns: (carePlanId: string) =>
    client
      .get<{ checkins: FollowUpCheckIn[]; total: number }>(
        `/care-plans/${carePlanId}/checkins`
      )
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to fetch check-ins:', err);
        throw err;
      }),

  /**
   * Get tasks for a care plan
   */
  getTasks: (carePlanId: string) =>
    client
      .get<{ tasks: CareTask[]; total: number }>(`/care-plans/${carePlanId}/tasks`)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to fetch tasks:', err);
        throw err;
      }),

  // ─────────────────────────────────────────────────────────────────────────
  // Alternate Care Navigation APIs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Navigate - Find alternate care options based on symptoms and location
   * POST /api/v1/alternate-care/navigate
   */
  navigate: (request: NavigateRequest) =>
    client
      .post<NavigateResponse>('/alternate-care/navigate', request)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to navigate care options:', err);
        throw err;
      }),

  /**
   * Get appointment availability for a provider
   * POST /api/v1/alternate-care/appointments/availability
   */
  availability: (request: AvailabilityRequest) =>
    client
      .post<AvailabilityResponse>('/alternate-care/appointments/availability', request)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to fetch availability:', err);
        throw err;
      }),

  /**
   * Book an appointment with a provider
   * POST /api/v1/alternate-care/appointments/book
   */
  book: (request: BookingRequest) =>
    client
      .post<BookingResponse>('/alternate-care/appointments/book', request)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Failed to book appointment:', err);
        throw err;
      }),
};

export default careService;
