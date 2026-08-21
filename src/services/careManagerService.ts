/**
 * CarePath — Care Manager Service
 *
 * Verified against backend: app/care_manager/*  and  app/api/v1/endpoints/care_manager.py
 * All routes are mounted under /api/v1/care-manager
 *
 *   GET  /care-manager/dashboard
 *   GET  /care-manager/profile
 *   GET  /care-manager/health
 *   GET  /care-manager/analytics/
 *   GET  /care-manager/analytics/{patient_id}
 *   POST /care-manager/patients/{patient_id}/readmission/predict
 *   GET  /care-manager/patients/{patient_id}/readmission/
 *   GET  /care-manager/patients/{patient_id}/post-discharge/
 */

import client from './apiClient';

// ── Types (mirror backend Pydantic schemas) ──────────────────────────────────

/** app/care_manager/analytics/schemas.py :: AggregateAnalyticsOut */
export interface AggregateAnalytics {
  total_patients: number;
  active_patients: number;
  high_risk_patients: number;
  medium_risk_patients: number;
  low_risk_patients: number;
  readmission_rate_pct: number;
  total_safety_evaluations: number;
  emergency_alerts_triggered: number;
  post_discharge_active_monitors: number;
  timestamp: string;
}

/** app/care_manager/analytics/schemas.py :: PatientAnalyticsOut */
export interface PatientAnalytics {
  patient_id: string;
  mrn: string;
  name?: string | null;
  readmission_risk_score?: number | null;
  readmission_risk_level?: string | null;
  total_triage_sessions: number;
  emergency_triage_triggers: number;
  post_discharge_status?: string | null;
  last_activity_at?: string | null;
}

/** app/care_manager/readmission/schemas.py :: ReadmissionPredictionOut */
export interface ReadmissionPrediction {
  patient_id: string;
  risk_score: number;
  risk_level: string; // low | medium | high
  predicted_at: string;
}

/** app/care_manager/post_discharge/schemas.py :: PostDischargeStatusOut */
export interface PostDischargeStatus {
  patient_id: string;
  care_plan: {
    tasks: { task: string; status: string }[];
    status: string; // on_track | at_risk | completed
  };
  follow_up: {
    last_checkin?: string | null;
    next_checkin?: string | null;
    is_scheduled: boolean;
  };
  response_analyser: {
    key_info: Record<string, unknown>;
  };
  appointment: {
    is_appointment: boolean;
    date?: string | null;
  };
}

export interface CareManagerDashboard {
  message: string;
  user: { username: string; role: string };
}

export interface CareManagerProfile {
  id: number;
  username: string;
  role: string;
  created_at: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const careManagerService = {
  /** GET /care-manager/dashboard */
  dashboard: () =>
    client.get<CareManagerDashboard>('/care-manager/dashboard').then((r) => r.data),

  /** GET /care-manager/profile */
  profile: () =>
    client.get<CareManagerProfile>('/care-manager/profile').then((r) => r.data),

  /** GET /care-manager/health */
  health: () =>
    client.get('/care-manager/health').then((r) => r.data),

  /** GET /care-manager/analytics/ — aggregate platform metrics */
  analytics: () =>
    client.get<AggregateAnalytics>('/care-manager/analytics/').then((r) => r.data),

  /** GET /care-manager/analytics/{patient_id} — per-patient analytics */
  patientAnalytics: (patientId: string) =>
    client.get<PatientAnalytics>(`/care-manager/analytics/${patientId}`).then((r) => r.data),

  /** POST /care-manager/patients/{patient_id}/readmission/predict — run the model */
  predictReadmission: (patientId: string) =>
    client
      .post<ReadmissionPrediction>(`/care-manager/patients/${patientId}/readmission/predict`)
      .then((r) => r.data),

  /** GET /care-manager/patients/{patient_id}/readmission/ — latest stored score */
  getReadmission: (patientId: string) =>
    client
      .get<ReadmissionPrediction>(`/care-manager/patients/${patientId}/readmission/`)
      .then((r) => r.data),

  /** GET /care-manager/patients/{patient_id}/post-discharge/ — 4-agent status */
  postDischarge: (patientId: string) =>
    client
      .get<PostDischargeStatus>(`/care-manager/patients/${patientId}/post-discharge/`)
      .then((r) => r.data),
};

export default careManagerService;
