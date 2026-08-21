/**
 * CarePath — Care Manager data aggregation.
 *
 * Everything here is derived from real backend responses:
 *   • GET /care-manager/analytics/                         → platform KPIs
 *   • GET /ehr/patients                                    → patient roster
 *   • GET /care-manager/analytics/{patient_id}             → per-patient risk
 *   • GET /care-manager/patients/{id}/post-discharge/      → tasks + appointments
 *
 * The backend has no bulk appointment or task endpoint, so those lists are
 * assembled from the per-patient post-discharge agent status for a bounded
 * sample of patients. Nothing is fabricated: if the backend returns nothing,
 * the UI shows an empty state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { careManagerService, type AggregateAnalytics, type PatientAnalytics, type PostDischargeStatus } from '../services/careManagerService';
import { ehrService, type PatientListItem } from '../services/ehrService';
import { toApiError } from '../services/apiClient';

/** How many patients we enrich with per-patient calls. Keeps request volume sane. */
const ENRICH_LIMIT = 12;

export interface EnrichedPatient extends PatientListItem {
  riskScore: number | null;
  riskLevel: string | null;
  postDischargeStatus: string | null;
  lastActivityAt: string | null;
  triageSessions: number;
  emergencyTriggers: number;
}

export interface DerivedAppointment {
  patientId: string;
  patientName: string;
  date: string;
  /** From the post-discharge appointment agent. */
  kind: string;
}

export interface DerivedTask {
  id: string;
  patientId: string;
  patientName: string;
  label: string;
  status: string; // pending | completed
}

export interface CareManagerData {
  analytics: AggregateAnalytics | null;
  patients: PatientListItem[];
  enriched: EnrichedPatient[];
  appointments: DerivedAppointment[];
  tasks: DerivedTask[];
  /** True when per-patient enrichment calls were attempted. */
  enrichedAttempted: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useCareManagerData(): CareManagerData {
  const [analytics, setAnalytics] = useState<AggregateAnalytics | null>(null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [enriched, setEnriched] = useState<EnrichedPatient[]>([]);
  const [appointments, setAppointments] = useState<DerivedAppointment[]>([]);
  const [tasks, setTasks] = useState<DerivedTask[]>([]);
  const [enrichedAttempted, setEnrichedAttempted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Analytics and the patient roster are independent — fetch together.
    const [analyticsRes, patientsRes] = await Promise.allSettled([
      careManagerService.analytics(),
      ehrService.list({ limit: 200 }),
    ]);

    if (!alive.current) return;

    if (analyticsRes.status === 'fulfilled') {
      setAnalytics(analyticsRes.value);
    } else {
      setAnalytics(null);
    }

    let roster: PatientListItem[] = [];
    if (patientsRes.status === 'fulfilled') {
      roster = patientsRes.value ?? [];
      setPatients(roster);
    } else {
      setPatients([]);
    }

    // Surface an error only when both primary calls failed.
    if (analyticsRes.status === 'rejected' && patientsRes.status === 'rejected') {
      setError(toApiError(patientsRes.reason).message);
      setLoading(false);
      return;
    }

    setLoading(false);

    // ── Enrichment pass (best-effort, never blocks first paint) ──
    const sample = roster.slice(0, ENRICH_LIMIT);
    if (sample.length === 0) {
      setEnriched([]);
      setAppointments([]);
      setTasks([]);
      setEnrichedAttempted(true);
      return;
    }

    const results = await Promise.allSettled(
      sample.map(async (p) => {
        const [pa, pd] = await Promise.allSettled([
          careManagerService.patientAnalytics(p.patient_id),
          careManagerService.postDischarge(p.patient_id),
        ]);
        return {
          patient: p,
          analytics: pa.status === 'fulfilled' ? pa.value : null,
          postDischarge: pd.status === 'fulfilled' ? pd.value : null,
        };
      }),
    );

    if (!alive.current) return;

    const nextEnriched: EnrichedPatient[] = [];
    const nextAppointments: DerivedAppointment[] = [];
    const nextTasks: DerivedTask[] = [];

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { patient, analytics: pa, postDischarge: pd } = r.value as {
        patient: PatientListItem;
        analytics: PatientAnalytics | null;
        postDischarge: PostDischargeStatus | null;
      };

      nextEnriched.push({
        ...patient,
        riskScore: pa?.readmission_risk_score ?? null,
        riskLevel: pa?.readmission_risk_level ?? null,
        postDischargeStatus: pa?.post_discharge_status ?? pd?.care_plan?.status ?? null,
        lastActivityAt: pa?.last_activity_at ?? null,
        triageSessions: pa?.total_triage_sessions ?? 0,
        emergencyTriggers: pa?.emergency_triage_triggers ?? 0,
      });

      if (pd?.appointment?.is_appointment && pd.appointment.date) {
        nextAppointments.push({
          patientId: patient.patient_id,
          patientName: patient.name,
          date: pd.appointment.date,
          kind: 'Post discharge review',
        });
      }

      pd?.care_plan?.tasks?.forEach((t, idx) => {
        nextTasks.push({
          id: `${patient.patient_id}-${idx}`,
          patientId: patient.patient_id,
          patientName: patient.name,
          label: t.task,
          status: t.status,
        });
      });
    }

    // Highest risk first so the dashboard surfaces who needs attention.
    nextEnriched.sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1));
    nextAppointments.sort((a, b) => a.date.localeCompare(b.date));

    setEnriched(nextEnriched);
    setAppointments(nextAppointments);
    setTasks(nextTasks);
    setEnrichedAttempted(true);
  }, []);

  useEffect(() => { void load(); }, [load, tick]);

  return {
    analytics,
    patients,
    enriched,
    appointments,
    tasks,
    enrichedAttempted,
    loading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
