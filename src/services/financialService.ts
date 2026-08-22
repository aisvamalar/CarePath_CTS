/**
 * CarePath — Financial Analytics Service
 *
 * API client for financial metrics, ROI analysis, and cost tracking.
 * All endpoints mounted under /api/v1/care-manager/financial
 */

import client from './apiClient';

// ============================================================================
// Types (matching backend Pydantic schemas)
// ============================================================================

export interface FinancialMetrics {
  total_savings: string;
  readmission_savings: string;
  ed_visit_savings: string;
  los_reduction_savings: string;
  medication_adherence_savings: string;
  other_savings: string;
  total_program_costs: string;
  total_intervention_costs: string;
  net_savings: string;
  roi_percentage: string;
  cost_per_patient: string;
  savings_per_patient: string;
  total_patients_tracked: number;
  total_interventions: number;
  readmissions_prevented: number;
  ed_visits_prevented: number;
  period_start: string;
  period_end: string;
  timestamp: string;
}

export interface PatientFinancial {
  patient_id: string;
  patient_name: string;
  mrn: string;
  total_savings: string;
  total_costs: string;
  net_savings: string;
  roi_percentage: string;
  readmission_savings: string;
  ed_visit_savings: string;
  los_reduction_savings: string;
  intervention_count: number;
  readmissions_prevented: number;
  ed_visits_prevented: number;
  cost_trend: 'increasing' | 'decreasing' | 'stable' | 'new';
  period_start: string;
  period_end: string;
  last_updated: string;
}

export interface InterventionCost {
  intervention_type: string;
  description: string | null;
  cost_per_unit: string;
  estimated_savings_per_unit: string;
  count: number;
  total_cost: string;
  total_savings: string;
  roi_percentage: string;
  active: boolean;
}

export interface SavingsTrendPoint {
  date: string;
  savings: string;
  costs: string;
  net_savings: string;
  intervention_count: number;
}

export interface SavingsTrend {
  trend: SavingsTrendPoint[];
  period_days: number;
}

export interface InterventionLog {
  id: number;
  patient_id: string;
  patient_name: string | null;
  intervention_type: string;
  performed_at: string;
  performed_by: string | null;
  outcome: string;
  notes: string | null;
}

export interface FinancialConfig {
  standard_costs: {
    readmission: string;
    ed_visit: string;
    hospital_day: string;
    care_manager_hourly_rate: string;
  };
  note: string;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface MetricsParams {
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

export interface PatientFinancialsParams {
  limit?: number;
  offset?: number;
  sort_by?: 'total_savings' | 'total_costs' | 'roi_percentage';
  sort_order?: 'asc' | 'desc';
}

export interface InterventionCostsParams {
  start_date?: string;
  end_date?: string;
}

export interface TrendParams {
  days?: number; // 7-365
}

export interface LogInterventionData {
  patient_id: string;
  intervention_type: string;
  performed_by?: string;
  outcome?: 'success' | 'in_progress' | 'failed' | 'pending';
  notes?: string;
}

// ============================================================================
// Service
// ============================================================================

export const financialService = {
  /**
   * GET /care-manager/financial/metrics
   * Get aggregate financial KPIs across all patients.
   */
  getMetrics: async (params?: MetricsParams): Promise<FinancialMetrics> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    
    const url = `/care-manager/financial/metrics${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await client.get<FinancialMetrics>(url);
    return response.data;
  },

  /**
   * GET /care-manager/financial/patients
   * Get patient-level financial data with pagination and sorting.
   */
  getPatientFinancials: async (params?: PatientFinancialsParams): Promise<PatientFinancial[]> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);
    
    const url = `/care-manager/financial/patients${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await client.get<PatientFinancial[]>(url);
    return response.data;
  },

  /**
   * GET /care-manager/financial/interventions
   * Get intervention cost breakdown with actual performance.
   */
  getInterventionCosts: async (params?: InterventionCostsParams): Promise<InterventionCost[]> => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    
    const url = `/care-manager/financial/interventions${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await client.get<InterventionCost[]>(url);
    return response.data;
  },

  /**
   * GET /care-manager/financial/trend
   * Get time-series data for savings trend chart.
   */
  getSavingsTrend: async (params?: TrendParams): Promise<SavingsTrend> => {
    const queryParams = new URLSearchParams();
    if (params?.days) queryParams.append('days', params.days.toString());
    
    const url = `/care-manager/financial/trend${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await client.get<SavingsTrend>(url);
    return response.data;
  },

  /**
   * POST /care-manager/financial/interventions/log
   * Log a new intervention performed for a patient.
   */
  logIntervention: async (data: LogInterventionData): Promise<InterventionLog> => {
    const response = await client.post<InterventionLog>(
      '/care-manager/financial/interventions/log',
      data
    );
    return response.data;
  },

  /**
   * GET /care-manager/financial/config
   * Get financial configuration (standard cost values).
   */
  getConfig: async (): Promise<FinancialConfig> => {
    const response = await client.get<FinancialConfig>('/care-manager/financial/config');
    return response.data;
  },

  /**
   * GET /care-manager/financial/health
   * Health check for financial service.
   */
  health: async (): Promise<{ status: string; service: string; intervention_types_configured: number }> => {
    const response = await client.get('/care-manager/financial/health');
    return response.data;
  },
};

export default financialService;
