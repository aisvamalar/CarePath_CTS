/**
 * CarePath — Centralized API Service
 * All backend communication goes through this module.
 * Base URL is read from VITE_API_URL environment variable.
 *
 * Backend Route Map (verified):
 *   /api/v1/auth      — login, signup, me, logout
 *   /api/v1/chat      — chat history CRUD (new, list, messages, pin, delete, export)
 *   /api/v1/intake    — chatbot intake sessions
 *   /api/v1/safety    — red flags + evaluation
 *   /api/v1/patients/{id}/pathway     — ED avoidability triage
 *   /api/v1/patients/{id}/care-options — care category routing
 *   /api/v1/patients/{id}/navigation  — provider booking
 *   /api/v1/patients/{id}/follow-up   — Telegram follow-up agent
 *   /api/v1/patient/ed-prediction     — ML ED prediction
 *   /api/v1/patient/dashboard         — patient dashboard
 *   /api/v1/ehr       — EHR CRUD (care-manager only)
 */

import client, { BASE_URL, toApiError } from './apiClient';

export { BASE_URL, toApiError };

// Re-export the dedicated service modules so screens can import from one place.
export { careManagerService } from './careManagerService';
export type {
  AggregateAnalytics,
  PatientAnalytics,
  ReadmissionPrediction,
  PostDischargeStatus,
  CareManagerDashboard,
  CareManagerProfile,
} from './careManagerService';

export { ehrService } from './ehrService';
export type {
  PatientListItem,
  PatientDetail,
  PatientCreatePayload,
  PatientUpdatePayload,
  Demographics,
  LabValues,
  ChronicConditions,
  VitalSigns,
  Medications,
  UtilizationHistory,
  AdmissionData,
} from './ehrService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { access_token: string; token_type?: string; role?: string; redirect_to?: string; }
export interface SignupRequest { mrn: string; username: string; password: string; confirm_password: string; }
export interface UserRecord { id: number; username: string; role: string; patient_id?: string; created_at?: string; }

export interface PatientEHRProfile {
  id?: number; patient_id?: string; mrn: string; name: string;
  date_of_birth?: string; age?: number; gender?: string; bmi?: number; insurance_type?: string;
}

export interface PatientInfo {
  patient_id: string; mrn?: string; username?: string; name?: string;
  ehr?: PatientEHRProfile;
  [key: string]: unknown;
}

export interface IntakeSessionResponse { session_id: string; next_question: string; status?: string; }
export interface IntakeMessageResponse {
  session_id: string; status: 'ACTIVE' | 'COMPLETE' | 'ERROR';
  next_question?: string; extracted?: IntakeFeatures; error_detail?: string;
}
export interface IntakeFeatures { chief_complaint?: string; symptom_onset?: string; pain_scale?: number | null; location?: string; [key: string]: unknown; }

export interface RedFlagsPayload {
  chest_pain: boolean; difficulty_breathing: boolean; altered_consciousness: boolean;
  severe_bleeding: boolean; stroke_symptoms: boolean; suicidal_ideation: boolean;
  anaphylaxis: boolean; high_fever: boolean; unable_to_walk: boolean; severe_abdominal_pain: boolean;
}

/** One recommended action returned by the ML pathway (safety evaluate). */
export interface CarePlanOption {
  title: string;
  urgency: string;
  description: string;
  recommended_action: string;
}

/** Embedded ML pathway result attached to the safety evaluation response. */
export interface PathwayResult {
  patient_id: string;
  risk_score: number;              // 0..1
  risk_level: string;              // e.g. "HIGH" | "MEDIUM" | "LOW"
  decision: 'NOT_AVOIDABLE' | 'POTENTIALLY_AVOIDABLE';
  explanation: string;
  care_plan?: CarePlanOption[];
  predicted_at: string;
  raw_agent_output?: Record<string, unknown> | null;
}

export interface SafetyEvaluationResponse {
  session_id?: string;
  result: 'YES' | 'NO' | 'PENDING' | 'ERROR';
  next_action?: 'EMERGENCY_PATHWAY' | 'CMS_ML' | 'ERROR' | string;
  triggered_rules?: string[];
  error_detail?: string | null;
  evaluated_at?: string;
  /** Present when result === 'NO' — the trained avoidable-ED model output. */
  pathway?: PathwayResult | null;
}

export interface PathwayResponse { [key: string]: unknown; }
export interface CareOptionsResponse { [key: string]: unknown; }
export interface NavigationResponse { [key: string]: unknown; }
export interface FollowUpResponse { [key: string]: unknown; }

export interface EDPredictionRequest { patient_mrn?: string; intake_data: Record<string, unknown>; safety_flags: Record<string, unknown>; }
export interface EDPredictionResponse {
  success: boolean; avoidable_ed: string; probability: number;
  confidence: string; recommendation: string; features_used: number; used_ehr: boolean;
}

// Chat History types
export interface ChatSession {
  session_id: string; title: string; is_title_auto_generated: boolean;
  message_count: number; is_active: boolean; is_pinned: boolean;
  patient_id?: string; created_at: string; updated_at: string;
  last_message_at?: string; preview?: string;
}
export interface ChatMessage {
  message_id: string; role: string; content: string;
  metadata?: Record<string, unknown>; created_at: string; version?: number;
}
export interface ChatListResponse { chats: ChatSession[]; total: number; limit: number; offset: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Auth — /api/v1/auth
// ─────────────────────────────────────────────────────────────────────────────

export const authAPI = {
  login: (data: LoginRequest) =>
    client.post<LoginResponse>('/auth/login', data).then(r => r.data),

  signup: (data: SignupRequest) =>
    client.post<LoginResponse>('/auth/signup/patient', data).then(r => r.data),

  signupCareManager: (data: { username: string; password: string; confirm_password: string }) =>
    client.post<LoginResponse>('/auth/signup/care-manager', data).then(r => r.data),

  me: () =>
    client.get<UserRecord>('/auth/me').then(r => r.data),

  logout: () =>
    client.post('/auth/logout').then(r => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Patient Info — uses /auth/me (no /patients/me exists)
// ─────────────────────────────────────────────────────────────────────────────

export const patientAPI = {
  /** Get current user info (acts as "getMe" for patient context) */
  getMe: () =>
    client.get<UserRecord>('/auth/me').then(r => {
      const u = r.data;
      return { patient_id: u.patient_id ?? u.username, username: u.username, name: u.username } as PatientInfo;
    }),

  /** Patient dashboard */
  dashboard: () =>
    client.get('/patient/dashboard').then(r => r.data),

  /** EHR by numeric id (care-manager only) */
  getEHRById: (patientId: string | number) =>
    client.get<PatientEHRProfile>(`/ehr/patients/${patientId}`).then(r => r.data),

  /** EHR by MRN (care-manager only) */
  getEHRByMrn: (mrn: string) =>
    client.get<PatientEHRProfile>(`/ehr/patients/mrn/${mrn}`).then(r => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat History — /api/v1/chat  (NEW)
// ─────────────────────────────────────────────────────────────────────────────

export const chatAPI = {
  /** Create a new chat session */
  create: (data?: { patient_id?: string; initial_message?: string; title?: string }) =>
    client.post<ChatSession>('/chat/new', data ?? {}).then(r => r.data),

  /** List user's chats (paginated) */
  list: (params?: { limit?: number; offset?: number; search?: string; is_pinned?: boolean }) =>
    client.get<ChatListResponse>('/chat/list', { params }).then(r => r.data),

  /** Search chats by content */
  search: (q: string, params?: { limit?: number; offset?: number }) =>
    client.get('/chat/search', { params: { q, ...params } }).then(r => r.data),

  /** Get chat details (metadata) */
  getDetails: (sessionId: string) =>
    client.get<ChatSession>(`/chat/${sessionId}`).then(r => r.data),

  /** Get chat messages (paginated) */
  getMessages: (sessionId: string, params?: { limit?: number; offset?: number; order?: string }) =>
    client.get(`/chat/${sessionId}/messages`, { params }).then(r => r.data),

  /** Send a message in a chat */
  sendMessage: (sessionId: string, content: string, context?: Record<string, unknown>) =>
    client.post(`/chat/${sessionId}/message`, { content, role: 'user', context }).then(r => r.data),

  /** Update chat title */
  updateTitle: (sessionId: string, title: string) =>
    client.patch(`/chat/${sessionId}/title`, { title }).then(r => r.data),

  /** Pin/unpin a chat */
  pin: (sessionId: string, is_pinned: boolean) =>
    client.patch(`/chat/${sessionId}/pin`, { is_pinned }).then(r => r.data),

  /** Delete a chat (soft or hard) */
  delete: (sessionId: string, permanent = false) =>
    client.delete(`/chat/${sessionId}`, { params: { permanent } }).then(r => r.data),

  /** Export chat */
  export: (sessionId: string, format: 'json' | 'txt' | 'markdown' = 'json') =>
    client.get(`/chat/${sessionId}/export`, { params: { format }, responseType: 'blob' }).then(r => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Intake — /api/v1/intake
// ─────────────────────────────────────────────────────────────────────────────

export const intakeAPI = {
  createSession: (patient_id: string) =>
    client.post<IntakeSessionResponse>('/intake/sessions', { patient_id }).then(r => r.data),

  sendMessage: (session_id: string, content: string) =>
    client.post<IntakeMessageResponse>(`/intake/sessions/${session_id}/messages`, { content }).then(r => r.data),

  getSession: (session_id: string) =>
    client.get(`/intake/sessions/${session_id}`).then(r => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Safety — /api/v1/safety
// ─────────────────────────────────────────────────────────────────────────────

export const safetyAPI = {
  submitRedFlags: (session_id: string, flags: RedFlagsPayload) =>
    client.post(`/safety/sessions/${session_id}/red-flags`, flags).then(r => r.data),

  evaluate: (session_id: string) =>
    client.post<SafetyEvaluationResponse>(`/safety/sessions/${session_id}/evaluate`, {}).then(r => r.data),

  getAssessment: (session_id: string) =>
    client.get(`/safety/sessions/${session_id}/assessment`).then(r => r.data),

  /** Smart red flag filtering using LLM */
  smartFilter: (session_id: string, chief_complaint: string, extracted_features: Record<string, unknown>) =>
    client.post(`/safety/sessions/${session_id}/smart-filter`, extracted_features, {
      params: { chief_complaint },
    }).then(r => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Pathway / Care Options / Navigation / Follow-up
// ─────────────────────────────────────────────────────────────────────────────

export const pathwayAPI = {
  /** Module 3: ED avoidability (POST /patients/{id}/pathway/) */
  triggerPathway: (patient_id: string) =>
    client.post<PathwayResponse>(`/patients/${patient_id}/pathway/`).then(r => r.data),

  /** Module 4: Care options routing (POST /patients/{id}/care-options/) */
  triggerCareOptions: (patient_id: string) =>
    client.post<CareOptionsResponse>(`/patients/${patient_id}/care-options/`).then(r => r.data),

  /** Module 5: Navigation/booking (POST /patients/{id}/navigation/) */
  triggerNavigation: (patient_id: string, category: string) =>
    client.post<NavigationResponse>(`/patients/${patient_id}/navigation/`, { category }).then(r => r.data),

  /** Module 5: Update booking */
  updateBooking: (patient_id: string, data: Record<string, unknown>) =>
    client.put<NavigationResponse>(`/patients/${patient_id}/navigation/booking`, data).then(r => r.data),

  /** Module 6: Follow-up (POST /patients/{id}/follow-up/) */
  triggerFollowUp: (patient_id: string) =>
    client.post<FollowUpResponse>(`/patients/${patient_id}/follow-up/`).then(r => r.data),

  /** Module 6: Get follow-up status */
  getFollowUpStatus: (patient_id: string) =>
    client.get<FollowUpResponse>(`/patients/${patient_id}/follow-up/`).then(r => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Care Manager — /api/v1/care-manager
// ─────────────────────────────────────────────────────────────────────────────

/** Legacy alias — prefer importing `careManagerService` directly. */
export { careManagerService as careManagerAPI } from './careManagerService';

// ─────────────────────────────────────────────────────────────────────────────
// ED Prediction — /api/v1/patient/ed-prediction
// ─────────────────────────────────────────────────────────────────────────────

export const predictionAPI = {
  /** ML-based ED avoidable prediction */
  predictED: (data: EDPredictionRequest) =>
    client.post<EDPredictionResponse>('/patient/ed-prediction', data).then(r => r.data),

  /** Readmission risk prediction for a patient */
  predictReadmission: (patient_id: string) =>
    client.post(`/patient/${patient_id}/readmission-prediction`).then(r => r.data),

  /** Get ML prediction history */
  getHistory: (patient_id: string, model_type?: string, limit = 10) =>
    client.get(`/patient/${patient_id}/ml-predictions`, { params: { model_type, limit } }).then(r => r.data),

  /** Get latest prediction per model type */
  getLatest: (patient_id: string) =>
    client.get(`/patient/${patient_id}/latest-predictions`).then(r => r.data),
};

export default client;
