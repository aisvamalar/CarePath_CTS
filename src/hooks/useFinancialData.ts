/**
 * CarePath — Financial Data Hook
 *
 * Custom React hook for managing financial analytics data.
 * Follows the pattern of useCareManagerData.ts for consistency.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../services/apiClient';
import {
  financialService,
  type FinancialMetrics,
  type PatientFinancial,
  type InterventionCost,
  type SavingsTrend,
} from '../services/financialService';

// ============================================================================
// Hook Return Type
// ============================================================================

export interface FinancialData {
  /** Aggregate financial metrics (KPIs) */
  metrics: FinancialMetrics | null;
  
  /** Patient-level financial data */
  patients: PatientFinancial[];
  
  /** Intervention type breakdown with costs and ROI */
  interventions: InterventionCost[];
  
  /** Time-series data for charts */
  trend: SavingsTrend | null;
  
  /** Loading state for initial data fetch */
  loading: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Reload all data */
  reload: () => void;
  
  /** Update date range and refetch metrics */
  setDateRange: (startDate: string, endDate: string) => void;
  
  /** Current date range */
  dateRange: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFinancialData(): FinancialData {
  // Default date range: last 30 days
  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const [dateRange, setDateRangeState] = useState(getDefaultDateRange);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [patients, setPatients] = useState<PatientFinancial[]>([]);
  const [interventions, setInterventions] = useState<InterventionCost[]>([]);
  const [trend, setTrend] = useState<SavingsTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch metrics, interventions, and trend in parallel
      const [metricsRes, interventionsRes, trendRes] = await Promise.allSettled([
        financialService.getMetrics({
          start_date: dateRange.start,
          end_date: dateRange.end,
        }),
        financialService.getInterventionCosts({
          start_date: dateRange.start,
          end_date: dateRange.end,
        }),
        financialService.getSavingsTrend({ days: 30 }),
      ]);

      if (!alive.current) return;

      // Handle metrics
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value);
      } else {
        console.error('[useFinancialData] Failed to fetch metrics:', metricsRes.reason);
        setMetrics(null);
      }

      // Handle interventions
      if (interventionsRes.status === 'fulfilled') {
        setInterventions(interventionsRes.value);
      } else {
        console.error('[useFinancialData] Failed to fetch interventions:', interventionsRes.reason);
        setInterventions([]);
      }

      // Handle trend
      if (trendRes.status === 'fulfilled') {
        setTrend(trendRes.value);
      } else {
        console.error('[useFinancialData] Failed to fetch trend:', trendRes.reason);
        setTrend(null);
      }

      // Show error only if all primary calls failed
      if (
        metricsRes.status === 'rejected' &&
        interventionsRes.status === 'rejected' &&
        trendRes.status === 'rejected'
      ) {
        const apiError = toApiError(metricsRes.reason);
        setError(apiError.message);
      }

      setLoading(false);

      // Fetch patient data in background (non-blocking)
      try {
        const patientsRes = await financialService.getPatientFinancials({
          limit: 50,
          sort_by: 'total_savings',
          sort_order: 'desc',
        });
        
        if (alive.current) {
          setPatients(patientsRes);
        }
      } catch (err) {
        console.error('[useFinancialData] Failed to fetch patient data:', err);
        // Don't set error state for background fetch failure
      }
    } catch (err) {
      if (!alive.current) return;
      
      const apiError = toApiError(err);
      setError(apiError.message);
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const setDateRange = useCallback((startDate: string, endDate: string) => {
    setDateRangeState({ start: startDate, end: endDate });
  }, []);

  return {
    metrics,
    patients,
    interventions,
    trend,
    loading,
    error,
    reload,
    setDateRange,
    dateRange,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for a specific date range (alternative to full useFinancialData).
 * Useful when you only need metrics for a custom range.
 */
export function useFinancialMetrics(startDate?: string, endDate?: string) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await financialService.getMetrics({
          start_date: startDate,
          end_date: endDate,
        });

        if (!cancelled) {
          setMetrics(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const apiError = toApiError(err);
          setError(apiError.message);
          setLoading(false);
        }
      }
    };

    void fetchMetrics();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { metrics, loading, error };
}

/**
 * Hook for intervention costs only.
 * Useful for standalone intervention breakdown components.
 */
export function useInterventionCosts(startDate?: string, endDate?: string) {
  const [interventions, setInterventions] = useState<InterventionCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchInterventions = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await financialService.getInterventionCosts({
          start_date: startDate,
          end_date: endDate,
        });

        if (!cancelled) {
          setInterventions(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const apiError = toApiError(err);
          setError(apiError.message);
          setLoading(false);
        }
      }
    };

    void fetchInterventions();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { interventions, loading, error };
}

export default useFinancialData;
