/**
 * CarePath — Patient detail + AI Readmission Prediction
 * Every figure on this screen comes from the backend record or model output.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import RiskBadge, { riskFromScore } from '../../components/ui/RiskBadge';
import { ErrorState, EmptyState, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ehrService, type PatientDetail as PatientRecord } from '../../services/ehrService';
import { predictionService, type ReadmissionDetails } from '../../services/predictionService';
import { careManagerService, type PostDischargeStatus } from '../../services/careManagerService';
import { toApiError } from '../../services/apiClient';

interface RiskFactor { label: string; detail: string; severity: 'high' | 'medium' | 'info' }

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [details, setDetails] = useState<ReadmissionDetails | null>(null);
  const [predictedAt, setPredictedAt] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [scoreMissing, setScoreMissing] = useState(false);

  const [postDischarge, setPostDischarge] = useState<PostDischargeStatus | null>(null);

  // ── Load record + any existing prediction ──
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await ehrService.getById(Number(id));
      setRecord(detail);

      // Latest stored predictions (may legitimately not exist yet)
      const [latest, pd] = await Promise.allSettled([
        predictionService.latest(detail.patient_id),
        careManagerService.postDischarge(detail.patient_id),
      ]);

      if (latest.status === 'fulfilled' && latest.value?.readmission) {
        const r = latest.value.readmission;
        setScore(r.risk_score);
        setDetails((r.prediction_result ?? null) as ReadmissionDetails | null);
        setPredictedAt(r.predicted_at);
        setModelVersion(r.model_version);
        setScoreMissing(false);
      } else {
        setScoreMissing(true);
      }

      if (pd.status === 'fulfilled') setPostDischarge(pd.value);
    } catch (err) {
      setError(toApiError(err).message);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // ── Run the model ──
  const runPredict = async () => {
    if (!record) return;
    setPredicting(true);
    try {
      const res = await predictionService.runReadmissionModel(record.patient_id);
      setScore(res.readmission_risk_score);
      setDetails(res.prediction_details ?? null);
      setPredictedAt(res.predicted_at);
      setModelVersion(res.model_version);
      setScoreMissing(false);
      toast.success('Readmission prediction generated');
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setPredicting(false);
    }
  };

  // ── Factors observed in this patient's record ──
  const factors = useMemo<RiskFactor[]>(() => {
    if (!record) return [];
    const out: RiskFactor[] = [];

    const admissions = details?.previous_admissions_12m ?? record.previous_admissions_12m;
    if (admissions > 0) {
      out.push({
        label: 'Previous admissions',
        detail: `${admissions} in the last 12 months`,
        severity: admissions >= 2 ? 'high' : 'medium',
      });
    }
    if (record.previous_er_visits_12m > 0) {
      out.push({
        label: 'Emergency visits',
        detail: `${record.previous_er_visits_12m} in the last 12 months`,
        severity: record.previous_er_visits_12m >= 3 ? 'high' : 'medium',
      });
    }
    if (record.prior_30_day_readmission_flag === 1) {
      out.push({ label: 'Prior 30-day readmission', detail: 'Flagged on record', severity: 'high' });
    }
    const los = details?.length_of_stay_days ?? record.length_of_stay_days;
    if (los) {
      out.push({
        label: 'Length of stay',
        detail: `${los} day${los === 1 ? '' : 's'}`,
        severity: los >= 7 ? 'medium' : 'info',
      });
    }
    if (record.icu_stay_flag === 1 || details?.icu_stay) {
      out.push({ label: 'ICU stay', detail: 'Recorded during index admission', severity: 'high' });
    }

    const chronic: string[] = [];
    if (record.diabetes_flag) chronic.push('Diabetes');
    if (record.heart_failure_flag) chronic.push('Heart failure');
    if (record.copd_asthma_flag) chronic.push('COPD/Asthma');
    if (record.ckd_flag) chronic.push('CKD');
    if (record.cancer_flag) chronic.push('Cancer');
    if (record.hypertension_flag) chronic.push('Hypertension');
    if (record.dementia_flag) chronic.push('Dementia');
    if (chronic.length > 0) {
      out.push({
        label: 'Chronic conditions',
        detail: chronic.join(', '),
        severity: chronic.length >= 3 ? 'high' : 'medium',
      });
    }

    const cci = details?.comorbidity_index ?? record.charlson_comorbidity_index;
    if (cci && cci > 0) {
      out.push({
        label: 'Comorbidity index',
        detail: `Charlson score ${cci}`,
        severity: cci >= 5 ? 'high' : 'medium',
      });
    }
    if (record.polypharmacy_flag === 1) {
      out.push({
        label: 'Polypharmacy',
        detail: `${record.active_medication_count} active medications`,
        severity: 'medium',
      });
    }
    if (record.missed_appointments_6m && record.missed_appointments_6m > 0) {
      out.push({
        label: 'Missed appointments',
        detail: `${record.missed_appointments_6m} in the last 6 months`,
        severity: 'medium',
      });
    }
    return out;
  }, [record, details]);

  // ── Operational next steps, each tied to a fact on the record ──
  const nextSteps = useMemo<string[]>(() => {
    if (!record) return [];
    const steps: string[] = [];
    const followUpScheduled = details?.follow_up_scheduled ?? Boolean(record.follow_up_within_7_days_flag);

    if (!followUpScheduled) steps.push('No follow-up is recorded within 7 days — schedule one.');
    if (record.polypharmacy_flag === 1 || record.active_medication_count >= 5) {
      steps.push(`Review the medication list (${record.active_medication_count} active).`);
    }
    if (record.medication_adherence_rate !== null && record.medication_adherence_rate !== undefined && record.medication_adherence_rate < 0.8) {
      steps.push(`Adherence is recorded at ${Math.round(record.medication_adherence_rate * 100)}% — confirm the patient can follow the plan.`);
    }
    if (record.missed_appointments_6m && record.missed_appointments_6m > 0) {
      steps.push('Confirm contact details and appointment reminders.');
    }
    if (postDischarge && !postDischarge.follow_up.is_scheduled) {
      steps.push('The follow-up agent has no scheduled check-in — arrange outreach.');
    }
    if (postDischarge?.care_plan?.status === 'at_risk') {
      steps.push('The care plan is flagged at risk — review open tasks.');
    }
    if (score !== null && score >= 0.7) {
      steps.push('Risk is in the high band — prioritise this patient in your review queue.');
    }
    if (steps.length === 0) steps.push('No outstanding gaps found on this record.');
    return steps;
  }, [record, details, postDischarge, score]);

  const pct = score !== null ? Math.round(score * 100) : null;
  const level = riskFromScore(score);

  return (
    <CareManagerLayout breadcrumb="Patient Detail">
      <button className="cmp-back" onClick={() => navigate('/care-manager/patients')}>
        ← Back to patients
      </button>

      {error ? (
        <ErrorState title="Unable to load this patient" message={error} onRetry={load} />
      ) : loading ? (
        <div className="cmp-detailskel">
          <Skeleton height={96} />
          <Skeleton height={220} />
          <Skeleton height={160} />
        </div>
      ) : !record ? (
        <EmptyState icon="🔍" title="Patient not found" message="This record may have been removed." />
      ) : (
        <>
          {/* ── Identity ── */}
          <section className="cmd-idcard">
            <span className="cmd-idcard__avatar">{record.name?.[0]?.toUpperCase() ?? 'P'}</span>
            <div className="cmd-idcard__main">
              <h1 className="cmd-idcard__name">{record.name}</h1>
              <p className="cmd-idcard__meta">
                <span className="cmp-mono">{record.mrn}</span>
                <span aria-hidden="true">·</span>
                <span>{record.patient_id}</span>
                <span aria-hidden="true">·</span>
                <span>Age {record.age}</span>
                <span aria-hidden="true">·</span>
                <span className="cmd-idcard__cap">{record.gender}</span>
              </p>
              <p className="cmd-idcard__tags">
                <span className="cmd-tag">{record.insurance_type?.replace('_', ' ')}</span>
                {record.admission_type && <span className="cmd-tag">{record.admission_type} admission</span>}
                {record.discharge_destination && <span className="cmd-tag">Discharge: {record.discharge_destination}</span>}
                <span className={`cmd-tag ${record.is_active === 1 ? 'cmd-tag--ok' : 'cmd-tag--off'}`}>
                  {record.is_active === 1 ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
            <div className="cmd-idcard__actions">
              <button className="cp-btn cp-btn--ghost" onClick={() => navigate('/care-manager/patients')}>
                Manage record
              </button>
            </div>
          </section>

          {/* ── AI prediction ── */}
          <section className="cmp-panel">
            <header className="cmp-panel__head">
              <div>
                <h2 className="cmp-panel__title">AI Readmission Prediction</h2>
                <p className="cmp-panel__sub">
                  30-day readmission risk
                  {modelVersion ? ` · model v${modelVersion}` : ''}
                  {predictedAt ? ` · ${new Date(predictedAt).toLocaleString()}` : ''}
                </p>
              </div>
              <button className="cp-btn cp-btn--primary" onClick={runPredict} disabled={predicting}>
                {predicting ? <><span className="cp-btn__spinner" /> Running model…</> : score !== null ? 'Re-run prediction' : 'Run prediction'}
              </button>
            </header>

            {score === null ? (
              <EmptyState
                icon="🤖"
                title={scoreMissing ? 'No prediction yet' : 'Prediction unavailable'}
                message="Run the model to generate a readmission risk score from this patient's current record."
                actionLabel={predicting ? undefined : 'Run prediction'}
                onAction={predicting ? undefined : runPredict}
              />
            ) : (
              <div className="cmd-predict">
                {/* Gauge */}
                <div className="cmd-gauge">
                  <RiskDial pct={pct ?? 0} level={level} />
                  <div className="cmd-gauge__caption">
                    <RiskBadge score={score} />
                    <span className="cmd-gauge__note">
                      {details?.features_used ? `${details.features_used} features` : 'Model output'}
                    </span>
                  </div>
                </div>

                {/* Factors */}
                <div className="cmd-block">
                  <h3 className="cmd-block__title">Factors on this record</h3>
                  {factors.length === 0 ? (
                    <p className="cmp-muted">No elevated factors recorded.</p>
                  ) : (
                    <ul className="cmd-factors">
                      {factors.map((f) => (
                        <li key={f.label} className={`cmd-factor cmd-factor--${f.severity}`}>
                          <span className="cmd-factor__dot" aria-hidden="true" />
                          <span className="cmd-factor__text">
                            <strong>{f.label}</strong>
                            <span>{f.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Next steps */}
                <div className="cmd-block">
                  <h3 className="cmd-block__title">Suggested next steps</h3>
                  <ul className="cmd-steps">
                    {nextSteps.map((s, i) => (
                      <li key={i}>
                        <span className="cmd-steps__mark" aria-hidden="true">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                  <p className="cmd-disclaimer">
                    Operational prompts derived from this record. They are not clinical advice.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── Clinical snapshot ── */}
          <div className="cmp-analytics cmp-analytics--two">
            <section className="cmp-card">
              <header className="cmp-card__head"><h3 className="cmp-card__title">Clinical snapshot</h3></header>
              <dl className="cmd-dl">
                <Row label="BMI" value={record.bmi} />
                <Row label="Hemoglobin" value={record.hemoglobin} suffix=" g/dL" />
                <Row label="Creatinine" value={record.creatinine} suffix=" mg/dL" />
                <Row label="Glucose" value={record.glucose} suffix=" mg/dL" />
                <Row label="WBC count" value={record.wbc_count} />
                <Row label="Blood pressure" value={record.systolic_bp && record.diastolic_bp ? `${record.systolic_bp}/${record.diastolic_bp}` : null} />
                <Row label="Heart rate" value={record.heart_rate} suffix=" bpm" />
                <Row label="SpO₂" value={record.spo2} suffix="%" />
              </dl>
            </section>

            <section className="cmp-card">
              <header className="cmp-card__head"><h3 className="cmp-card__title">Post-discharge agents</h3></header>
              {!postDischarge ? (
                <EmptyState compact icon="📡" title="No agent data" message="The post-discharge module returned nothing for this patient." />
              ) : (
                <div className="cmd-agents">
                  <div className="cmd-agent">
                    <span className="cmd-agent__label">Care plan</span>
                    <span className={`cmd-agent__pill cmd-agent__pill--${postDischarge.care_plan.status === 'at_risk' ? 'warn' : 'ok'}`}>
                      {postDischarge.care_plan.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="cmd-agent">
                    <span className="cmd-agent__label">Follow-up</span>
                    <span className={`cmd-agent__pill cmd-agent__pill--${postDischarge.follow_up.is_scheduled ? 'ok' : 'warn'}`}>
                      {postDischarge.follow_up.is_scheduled ? 'Scheduled' : 'Not scheduled'}
                    </span>
                  </div>
                  <div className="cmd-agent">
                    <span className="cmd-agent__label">Appointment</span>
                    <span className={`cmd-agent__pill cmd-agent__pill--${postDischarge.appointment.is_appointment ? 'ok' : 'off'}`}>
                      {postDischarge.appointment.is_appointment
                        ? (postDischarge.appointment.date ?? 'Booked')
                        : 'None'}
                    </span>
                  </div>

                  {postDischarge.care_plan.tasks.length > 0 && (
                    <ul className="cmd-tasklist">
                      {postDischarge.care_plan.tasks.map((t, i) => (
                        <li key={i} className={t.status === 'completed' ? 'cmd-tasklist--done' : ''}>
                          <span aria-hidden="true">{t.status === 'completed' ? '✓' : '○'}</span> {t.task}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>

          {record.clinical_notes && (
            <section className="cmp-card">
              <header className="cmp-card__head"><h3 className="cmp-card__title">Clinical notes</h3></header>
              <p className="cmd-notes">{record.clinical_notes}</p>
            </section>
          )}
        </>
      )}
    </CareManagerLayout>
  );
}

function Row({ label, value, suffix = '' }: { label: string; value: number | string | null | undefined; suffix?: string }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="cmd-dl__row">
      <dt>{label}</dt>
      <dd>{empty ? <span className="cmp-metric-na">N/A</span> : <>{value}{suffix}</>}</dd>
    </div>
  );
}

/** Circular risk dial drawn with SVG so it scales cleanly. */
function RiskDial({ pct, level }: { pct: number; level: string }) {
  const size = 168;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);

  const color = level === 'high' ? '#e06a4f' : level === 'medium' ? '#f5a08a' : '#7cc4a4';

  return (
    <div className="cmd-dial" role="img" aria-label={`Readmission risk ${pct} percent, ${level}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(242,132,107,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="cmd-dial__center">
        <strong>{pct}%</strong>
        <span>{level === 'high' ? 'High risk' : level === 'medium' ? 'Medium risk' : 'Low risk'}</span>
      </div>
    </div>
  );
}
