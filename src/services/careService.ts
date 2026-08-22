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
};

export default careService;
