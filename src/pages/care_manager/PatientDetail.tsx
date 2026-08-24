/**
 * CarePath — Patient detail.
 *
 * Two-column workspace that fills the viewport beside the sidebar:
 *   Left  — AI-assisted retrieval summary, typed out progressively, own scroll.
 *   Right — spinner while the summary streams, then a PDF-style record sheet.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import RiskBadge from '../../components/ui/RiskBadge';
import { ErrorState, EmptyState, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ehrService, type PatientDetail as PatientRecord } from '../../services/ehrService';
import { predictionService, type ReadmissionDetails } from '../../services/predictionService';
import { careManagerService, type PostDischargeStatus } from '../../services/careManagerService';
import { toApiError } from '../../services/apiClient';
import PatientAISummary from '../../components/care_manager/PatientAISummary';
import PatientSummaryDoc from '../../components/care_manager/PatientSummaryDoc';

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

  const [postDischarge, setPostDischarge] = useState<PostDischargeStatus | null>(null);

  /** Flips true when the left-hand summary has finished typing. */
  const [streamDone, setStreamDone] = useState(false);

  // ── Load record + any existing prediction ──
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setStreamDone(false);
    try {
      const detail = await ehrService.getById(Number(id));
      setRecord(detail);

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

  // ── Run the model, then restream the summary with the new score ──
  const runPredict = async () => {
    if (!record) return;
    setPredicting(true);
    try {
      const res = await predictionService.runReadmissionModel(record.patient_id);
      setScore(res.readmission_risk_score);
      setDetails(res.prediction_details ?? null);
      setPredictedAt(res.predicted_at);
      setModelVersion(res.model_version);
      setStreamDone(false);
      toast.success('Readmission prediction generated');
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setPredicting(false);
    }
  };

  return (
    <CareManagerLayout breadcrumb="Patient Detail">
      {error ? (
        <ErrorState title="Unable to load this patient" message={error} onRetry={load} />
      ) : loading ? (
        <div className="cmd-detailskel">
          <Skeleton height={64} />
          <Skeleton height={420} />
        </div>
      ) : !record ? (
        <EmptyState icon="🔍" title="Patient not found" message="This record may have been removed." />
      ) : (
        <div className="cmd-work">
          {/* ── Toolbar ── */}
          <div className="cmd-work__bar">
            <button className="cmd-work__back" onClick={() => navigate('/care-manager/patients')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Patients
            </button>

            <span className="cmd-work__avatar">{record.name?.[0]?.toUpperCase() ?? 'P'}</span>
            <div className="cmd-work__id">
              <h1 className="cmd-work__name">{record.name}</h1>
              <p className="cmd-work__meta">
                <span className="cmp-mono">{record.mrn}</span>
                <span aria-hidden="true">·</span>
                <span>Age {record.age}</span>
                <span aria-hidden="true">·</span>
                <span className="cmd-work__cap">{record.gender}</span>
              </p>
            </div>

            {score !== null && <RiskBadge score={score} showScore />}

            {/* Update button — navigates to full edit form pre-filled with current data */}
            <button
              className="cp-btn cp-btn--ghost cmd-work__run"
              onClick={() => navigate(`/care-manager/patients/${id}/edit`)}
              aria-label="Edit patient record"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Update
            </button>

            <button className="cp-btn cp-btn--primary cmd-work__run" onClick={runPredict} disabled={predicting}>
              {predicting ? <><span className="cp-btn__spinner" /> Running…</> : score !== null ? 'Re-run prediction' : 'Run prediction'}
            </button>
          </div>

          {/* ── Split workspace ── */}
          <div className="cmd-work__split">
            {/* Left: streaming summary, own scroll */}
            <div className="cmd-work__left">
              <PatientAISummary
                record={record}
                score={score}
                details={details}
                postDischarge={postDischarge}
                loading={false}
                onDone={() => setStreamDone(true)}
              />
            </div>

            {/* Right: spinner until the summary finishes, then the record sheet */}
            <div className="cmd-work__right">
              {streamDone ? (
                <PatientSummaryDoc
                  record={record}
                  score={score}
                  predictedAt={predictedAt}
                  modelVersion={modelVersion}
                  postDischarge={postDischarge}
                />
              ) : (
                <DocPending />
              )}
            </div>
          </div>
        </div>
      )}
    </CareManagerLayout>
  );
}

/**
 * Placeholder shown on the right while the summary is still streaming.
 * A scan line sweeps top-to-bottom on a loop to signal the document is
 * being read/assembled, over a ghost outline of the sheet.
 */
function DocPending() {
  return (
    <div className="cmd-pending" role="status" aria-live="polite">
      {/* Looping scan line across the whole pending sheet */}
      <span className="cmd-pending__scan" aria-hidden="true" />

      <div className="cmd-pending__spinner" aria-hidden="true" />
      <p className="cmd-pending__title">Scanning record</p>
      <p className="cmd-pending__sub">The document builds once the summary finishes.</p>

      {/* Ghost outline of the sheet being assembled */}
      <div className="cmd-pending__ghost" aria-hidden="true">
        <span className="cmd-pending__bar cmd-pending__bar--title" />
        <span className="cmd-pending__bar" />
        <span className="cmd-pending__bar cmd-pending__bar--short" />
        <span className="cmd-pending__gap" />
        <span className="cmd-pending__bar" />
        <span className="cmd-pending__bar cmd-pending__bar--short" />
        <span className="cmd-pending__gap" />
        <span className="cmd-pending__bar" />
        <span className="cmd-pending__bar cmd-pending__bar--short" />
        <span className="cmd-pending__gap" />
        <span className="cmd-pending__bar" />
        <span className="cmd-pending__bar cmd-pending__bar--short" />
      </div>
    </div>
  );
}
