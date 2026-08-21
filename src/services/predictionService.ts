/**
 * CarePath — ML Prediction Service
 *
 * Verified against backend: app/api/v1/endpoints/patient.py (mounted at /api/v1/patient)
 *
 *   POST /patient/{patient_id}/readmission-prediction   run the 30-day readmission model
 *   GET  /patient/{patient_id}/ml-predictions           prediction history
 *   GET  /patient/{patient_id}/latest-predictions       latest per model type
 *   POST /patient/ed-prediction                         avoidable-ED model
 *
 * Note: the Care Manager module also exposes a separate rule-based score at
 * /care-manager/patients/{id}/readmission — that one is stored and listed,
 * while this one returns the ML model's factor breakdown.
 */

import client from './apiClient';

/** app/services/readmission_prediction_service.py :: prediction_details */
export interface ReadmissionDetails {
  features_used?: number;
  patient_age?: number | null;
  comorbidity_index?: number | null;
  previous_admissions_12m?: number | null;
  length_of_stay_days?: number | null;
  icu_stay?: boolean | null;
  follow_up_scheduled?: boolean | null;
  [key: string]: unknown;
}

export interface ReadmissionMLResult {
  readmission_risk_score: number;
  predicted_at: string;
  model_version: string;
  prediction_details: ReadmissionDetails;
}

export interface MLPredictionRecord {
  id: number;
  patient_id: string;
  mrn: string;
  model_type: string;
  model_version: string;
  risk_score: number;
  prediction_result: Record<string, unknown>;
  predicted_at: string;
  created_by?: string | null;
}

export const predictionService = {
  /** POST /patient/{patient_id}/readmission-prediction */
  runReadmissionModel: (patientId: string) =>
    client
      .post<ReadmissionMLResult>(`/patient/${patientId}/readmission-prediction`)
      .then((r) => r.data),

  /** GET /patient/{patient_id}/ml-predictions */
  history: (patientId: string, params?: { model_type?: string; limit?: number }) =>
    client
      .get<MLPredictionRecord[]>(`/patient/${patientId}/ml-predictions`, {
        params: { model_type: params?.model_type, limit: params?.limit ?? 10 },
      })
      .then((r) => r.data),

  /** GET /patient/{patient_id}/latest-predictions */
  latest: (patientId: string) =>
    client
      .get<Record<string, { id: number; risk_score: number; model_version: string; predicted_at: string; prediction_result: Record<string, unknown> }>>(
        `/patient/${patientId}/latest-predictions`,
      )
      .then((r) => r.data),
};

export default predictionService;
