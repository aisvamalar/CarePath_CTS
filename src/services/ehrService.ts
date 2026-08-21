/**
 * CarePath — EHR / Patient Records Service
 *
 * Verified against backend: app/api/v1/endpoints/ehr.py  (mounted at /api/v1/ehr)
 * All routes require the CARE_MANAGER role.
 *
 *   POST   /ehr/patients                  create (MRN auto-generated)
 *   GET    /ehr/patients?skip=&limit=     list (simplified view)
 *   GET    /ehr/patients/{id}             detail by numeric id
 *   GET    /ehr/patients/mrn/{mrn}        detail by MRN
 *   PUT    /ehr/patients/{id}             update (all fields optional)
 *   DELETE /ehr/patients/{id}             delete -> 204
 */

import client from './apiClient';

// ── Nested schema groups (app/schemas/ehr.py) ────────────────────────────────

export type Gender = 'male' | 'female' | 'other';
export type InsuranceType =
  | 'Medicare' | 'Medicaid' | 'Private' | 'Self-pay' | 'Medicare_Advantage' | 'Uninsured';
export type AdmissionType = 'elective' | 'emergency' | 'urgent';
export type DischargeDestination = 'home' | 'rehab' | 'nursing_home' | 'other';

export interface Demographics {
  name: string;
  date_of_birth: string; // YYYY-MM-DD
  age: number;
  gender: Gender;
  bmi: number;
  insurance_type: InsuranceType;
  race?: string | null;
}

export interface ChronicConditions {
  diabetes_flag?: number;
  heart_failure_flag?: number;
  cardiac_history_flag?: number;
  copd_asthma_flag?: number;
  ckd_flag?: number;
  cancer_flag?: number;
  dementia_flag?: number;
  hypertension_flag?: number;
  immunocompromised_flag?: number;
  charlson_comorbidity_index?: number;
}

export interface VitalSigns {
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  pain_score_clinical?: number | null;
}

export interface LabValues {
  hemoglobin: number;
  creatinine: number;
  glucose: number;
  hba1c?: number | null;
  wbc_count: number;
  total_bilirubin?: number | null;
  platelet_count?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  troponin?: number | null;
  bnp?: number | null;
  lactate?: number | null;
  inr?: number | null;
}

export interface Medications {
  active_medication_count?: number;
  medication_count_at_discharge?: number | null;
  polypharmacy_flag?: number;
  high_risk_medication_flag?: number;
  on_anticoagulants_flag?: number;
  on_insulin_flag?: number;
  medication_adherence_rate?: number | null;
}

export interface UtilizationHistory {
  previous_admissions_12m: number;
  previous_er_visits_12m: number;
  prior_30_day_readmission_flag?: number;
  days_since_last_ed_visit?: number | null;
  ed_visits_90d?: number | null;
  ed_visits_30d?: number | null;
  outpatient_visits_365d?: number | null;
  days_since_last_pcp_visit?: number | null;
  missed_appointments_6m?: number | null;
}

export interface AdmissionData {
  admission_date?: string | null;
  discharge_date?: string | null;
  admission_type?: AdmissionType | null;
  length_of_stay_days?: number | null;
  icu_stay_flag?: number;
  discharge_destination?: DischargeDestination | null;
  follow_up_within_7_days_flag?: number;
  follow_up_appointment_date?: string | null;
  total_charges_index_stay?: number | null;
}

// ── Requests ─────────────────────────────────────────────────────────────────

export interface PatientCreatePayload {
  demographics: Demographics;
  chronic_conditions: ChronicConditions;
  vital_signs_current?: VitalSigns | null;
  lab_values: LabValues;
  medications: Medications;
  utilization_history: UtilizationHistory;
  admission_data?: AdmissionData | null;
  clinical_notes?: string | null;
  contact_number?: string | null;
  email?: string | null;
  address?: string | null;
  insurance_id?: string | null;
}

export type PatientUpdatePayload = Partial<PatientCreatePayload> & { is_active?: number };

// ── Responses ────────────────────────────────────────────────────────────────

/** app/schemas/ehr.py :: PatientEHRListResponse */
export interface PatientListItem {
  id: number;
  patient_id: string;
  mrn: string;
  name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  contact_number?: string | null;
  email?: string | null;
  is_active: number;
  created_at: string;
}

/** app/schemas/ehr.py :: PatientEHRResponse (flattened) */
export interface PatientDetail extends PatientListItem {
  bmi: number;
  insurance_type: string;
  race?: string | null;

  diabetes_flag: number;
  heart_failure_flag: number;
  cardiac_history_flag: number;
  copd_asthma_flag: number;
  ckd_flag: number;
  cancer_flag: number;
  dementia_flag: number;
  hypertension_flag: number;
  immunocompromised_flag: number;
  charlson_comorbidity_index: number;

  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  pain_score_clinical?: number | null;

  hemoglobin: number;
  creatinine: number;
  glucose: number;
  hba1c?: number | null;
  wbc_count: number;
  total_bilirubin?: number | null;
  platelet_count?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  troponin?: number | null;
  bnp?: number | null;
  lactate?: number | null;
  inr?: number | null;

  active_medication_count: number;
  medication_count_at_discharge?: number | null;
  polypharmacy_flag: number;
  high_risk_medication_flag: number;
  on_anticoagulants_flag: number;
  on_insulin_flag: number;
  medication_adherence_rate?: number | null;

  previous_admissions_12m: number;
  previous_er_visits_12m: number;
  prior_30_day_readmission_flag: number;
  days_since_last_ed_visit?: number | null;
  ed_visits_90d?: number | null;
  ed_visits_30d?: number | null;
  outpatient_visits_365d?: number | null;
  days_since_last_pcp_visit?: number | null;
  missed_appointments_6m?: number | null;

  admission_date?: string | null;
  discharge_date?: string | null;
  admission_type?: string | null;
  length_of_stay_days?: number | null;
  icu_stay_flag: number;
  discharge_destination?: string | null;
  follow_up_within_7_days_flag: number;
  follow_up_appointment_date?: string | null;
  total_charges_index_stay?: number | null;

  clinical_notes?: string | null;
  address?: string | null;
  insurance_id?: string | null;
  deleted_at?: string | null;
  updated_at: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const ehrService = {
  /**
   * GET /ehr/patients
   * The backend soft-deletes (is_active = 0) but still returns those rows, so we
   * exclude deactivated patients here. Every screen that lists or counts patients
   * goes through this method, so inactive records never appear or get counted.
   */
  list: (params?: { skip?: number; limit?: number }) =>
    client
      .get<PatientListItem[]>('/ehr/patients', {
        params: { skip: params?.skip ?? 0, limit: params?.limit ?? 100 },
      })
      .then((r) => (r.data ?? []).filter((p) => p.is_active !== 0)),

  /** GET /ehr/patients/{id} */
  getById: (id: number) =>
    client.get<PatientDetail>(`/ehr/patients/${id}`).then((r) => r.data),

  /** GET /ehr/patients/mrn/{mrn} */
  getByMrn: (mrn: string) =>
    client.get<PatientDetail>(`/ehr/patients/mrn/${encodeURIComponent(mrn)}`).then((r) => r.data),

  /** POST /ehr/patients */
  create: (payload: PatientCreatePayload) =>
    client.post<PatientDetail>('/ehr/patients', payload).then((r) => r.data),

  /** PUT /ehr/patients/{id} */
  update: (id: number, payload: PatientUpdatePayload) =>
    client.put<PatientDetail>(`/ehr/patients/${id}`, payload).then((r) => r.data),

  /** DELETE /ehr/patients/{id} — backend returns 204 No Content */
  remove: (id: number) =>
    client.delete(`/ehr/patients/${id}`).then(() => true),
};

export default ehrService;
