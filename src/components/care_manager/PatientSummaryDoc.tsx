/**
 * CarePath — Patient Summary Document (right-hand panel).
 *
 * A printable-style structured record sheet mirroring the reference layout:
 * header block, patient information, insurance, medical history, and the
 * final model prediction. All values come straight off the EHR record.
 *
 * PDF export: clicking "Download PDF" opens a focused print dialog scoped
 * to this document only — no extra libraries needed.
 */
import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { PatientDetail } from '../../services/ehrService';
import type { PostDischargeStatus } from '../../services/careManagerService';

interface Props {
  record: PatientDetail;
  score: number | null;
  predictedAt: string | null;
  modelVersion: string | null;
  postDischarge: PostDischargeStatus | null;
}

const NA = <span className="psd-na">Not recorded</span>;

function val(v: string | number | null | undefined, suffix = '') {
  if (v === null || v === undefined || v === '') return NA;
  return <>{v}{suffix}</>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function riskBand(score: number) {
  if (score >= 0.7) return { label: 'HIGH', cls: 'high' };
  if (score >= 0.4) return { label: 'MEDIUM', cls: 'medium' };
  return { label: 'LOW', cls: 'low' };
}

export default function PatientSummaryDoc({ record, score, predictedAt, modelVersion, postDischarge }: Props) {
  const docRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = () => {
    const el = docRef.current;
    if (!el) return;

    // Open a focused print window containing only the document HTML + styles
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;

    // Collect all stylesheet <link> and <style> tags from the host page
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('\n');

    printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${record.name} — Patient Record</title>
  ${styles}
  <style>
    /* Print-only overrides */
    @page { size: A4; margin: 18mm 16mm; }
    body { background: white !important; margin: 0; padding: 0; font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
    .psd { box-shadow: none !important; border: none !important; padding: 0 !important; animation: none !important; }
    .psd::before { display: none !important; }
    .psd-pdf-bar { display: none !important; }
    .psd-cols { grid-template-columns: 1fr 1fr !important; }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`);

    printWin.document.close();
    printWin.focus();

    // Small delay for styles to apply, then print
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 400);
  };

  const conditions: string[] = [];
  if (record.diabetes_flag) conditions.push('Diabetes');
  if (record.heart_failure_flag) conditions.push('Heart failure');
  if (record.cardiac_history_flag) conditions.push('Cardiac history');
  if (record.copd_asthma_flag) conditions.push('COPD/Asthma');
  if (record.ckd_flag) conditions.push('CKD');
  if (record.cancer_flag) conditions.push('Cancer');
  if (record.dementia_flag) conditions.push('Dementia');
  if (record.hypertension_flag) conditions.push('Hypertension');
  if (record.immunocompromised_flag) conditions.push('Immunocompromised');

  const band = score !== null ? riskBand(score) : null;

  return (
    <div className="psd-wrapper">
      {/* ── Download bar (hidden during print) ── */}
      <div className="psd-pdf-bar">
        <span className="psd-pdf-bar__label">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.5" y="1.5" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 6h6M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Patient Record
        </span>
        <button className="psd-pdf-btn" onClick={handleDownloadPdf} aria-label="Download patient record as PDF">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.5 12.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Download PDF
        </button>
      </div>

      {/* ── The printable document ── */}
      <div className="psd" ref={docRef}>
      {/* ── Document header ── */}
      <div className="psd-header">
        <h2 className="psd-header__title">PATIENT RECORD</h2>
        <div className="psd-header__mark" aria-hidden="true">
          <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="6" width="28" height="34" rx="3" fill="#fce4d6" stroke="#f2846b" strokeWidth="1.6" />
            <path d="M14 16h16M14 22h16M14 28h10" stroke="#f2846b" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ── Transmittal-style meta table ── */}
      <table className="psd-meta">
        <tbody>
          <tr><th>RECORD ID:</th><td>{record.patient_id}</td></tr>
          <tr><th>MRN:</th><td>{record.mrn}</td></tr>
          <tr><th>GENERATED:</th><td>{new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td></tr>
          <tr><th>STATUS:</th><td>{record.is_active === 1 ? 'Active' : 'Inactive'}</td></tr>
          <tr><th>SOURCE:</th><td>CarePath EHR</td></tr>
        </tbody>
      </table>

      {/* ── Two columns so the whole record fits one page ── */}
      <div className="psd-cols">
        <Section icon="user" title="Patient Information">
          <Field label="Patient Name" value={record.name} />
          <Field label="Date of Birth" value={fmtDate(record.date_of_birth) ?? undefined} />
          <Field label="Age" value={record.age != null ? `${record.age} years` : undefined} />
          <Field label="Gender" value={record.gender} capitalize />
          <Field label="Address" value={record.address ?? undefined} />
          <Field label="Phone" value={record.contact_number ?? undefined} />
          <Field label="Email" value={record.email ?? undefined} />
        </Section>

        <Section icon="shield" title="Insurance">
          <Field label="Insurance Type" value={record.insurance_type?.replace('_', ' ')} />
          <Field label="Insurance ID" value={record.insurance_id ?? undefined} />
        </Section>

        <Section icon="heart" title="Medical History">
          <Field
            label="Chronic Conditions"
            value={conditions.length > 0 ? conditions.join(', ') : undefined}
          />
          <Field
            label="Comorbidity Index"
            value={record.charlson_comorbidity_index != null ? `Charlson ${record.charlson_comorbidity_index}` : undefined}
          />
          <Field
            label="Current Medications"
            value={record.active_medication_count != null ? `${record.active_medication_count} active` : undefined}
          />
          <Field
            label="Prior Admissions"
            value={record.previous_admissions_12m != null ? `${record.previous_admissions_12m} in 12 mo` : undefined}
          />
          <Field
            label="Prior ED Visits"
            value={record.previous_er_visits_12m != null ? `${record.previous_er_visits_12m} in 12 mo` : undefined}
          />
        </Section>

        <Section icon="calendar" title="Admission Details">
          <Field label="Admission Date" value={fmtDate(record.admission_date) ?? undefined} />
          <Field label="Discharge Date" value={fmtDate(record.discharge_date) ?? undefined} />
          <Field label="Admission Type" value={record.admission_type} capitalize />
          <Field label="Length of Stay" value={record.length_of_stay_days != null ? `${record.length_of_stay_days} days` : undefined} />
          <Field label="Discharge To" value={record.discharge_destination?.replace('_', ' ')} capitalize />
          <Field label="ICU Stay" value={record.icu_stay_flag ? 'Yes' : 'No'} />
        </Section>

        <Section icon="chart" title="Vitals & Labs">
          <Field
            label="Blood Pressure"
            value={record.systolic_bp && record.diastolic_bp ? `${record.systolic_bp}/${record.diastolic_bp} mmHg` : undefined}
          />
          <Field label="Heart Rate" value={record.heart_rate != null ? `${record.heart_rate} bpm` : undefined} />
          <Field label="SpO2" value={record.spo2 != null ? `${record.spo2}%` : undefined} />
          <Field label="BMI" value={record.bmi ?? undefined} />
          <Field label="Hemoglobin" value={record.hemoglobin != null ? `${record.hemoglobin} g/dL` : undefined} />
          <Field label="Creatinine" value={record.creatinine != null ? `${record.creatinine} mg/dL` : undefined} />
          <Field label="Glucose" value={record.glucose != null ? `${record.glucose} mg/dL` : undefined} />
          <Field label="WBC Count" value={record.wbc_count ?? undefined} />
        </Section>

        <Section icon="heart" title="Post-Discharge">
          <Field
            label="Care Plan"
            value={postDischarge ? (postDischarge.care_plan?.status ?? '').replace('_', ' ') : undefined}
            capitalize
          />
          <Field
            label="Tasks"
            value={
              postDischarge?.care_plan?.tasks?.length
                ? `${postDischarge.care_plan.tasks.filter((t) => t.status === 'completed').length}/${postDischarge.care_plan.tasks.length} complete`
                : undefined
            }
          />
          <Field
            label="Follow-up"
            value={postDischarge ? (postDischarge.follow_up?.is_scheduled ? 'Scheduled' : 'Not scheduled') : undefined}
          />
          <Field
            label="Appointment"
            value={postDischarge?.appointment?.is_appointment ? (postDischarge.appointment.date ?? 'Booked') : undefined}
          />
        </Section>
      </div>

      {/* ── Final prediction ── */}
      <Section icon="chart" title="Final Prediction">
        {score === null ? (
          <p className="psd-empty">No readmission prediction stored. Run the model to populate this section.</p>
        ) : (
          <>
            <div className={`psd-verdict psd-verdict--${band!.cls}`}>
              <span className="psd-verdict__pct">{Math.round(score * 100)}%</span>
              <span className="psd-verdict__band">{band!.label} RISK</span>
              <span className="psd-verdict__caption">30-day readmission probability</span>
            </div>
            <Field label="Model Version" value={modelVersion ?? undefined} />
            <Field label="Predicted At" value={predictedAt ? new Date(predictedAt).toLocaleString() : undefined} />
          </>
        )}
      </Section>

      <p className="psd-foot">
        Generated from the CarePath EHR record. Operational summary only — not clinical advice.
      </p>
    </div>
    </div>
  );
}

function Field({ label, value, capitalize }: { label: string; value?: string | number | null; capitalize?: boolean }) {
  return (
    <div className="psd-field">
      <span className="psd-field__label">{label}:</span>
      <span className={`psd-field__value${capitalize ? ' psd-field__value--cap' : ''}`}>{val(value)}</span>
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  user: <path d="M8 7.2a2.4 2.4 0 100-4.8 2.4 2.4 0 000 4.8zM2.8 14c0-2.6 2-4.2 5.2-4.2s5.2 1.6 5.2 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  shield: <path d="M8 1.8L2.8 3.6v4.2c0 3.4 2.4 5.4 5.2 6.4 2.8-1 5.2-3 5.2-6.4V3.6L8 1.8z" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  heart: <path d="M8 13.5S2.5 10.2 2.5 6.6A2.9 2.9 0 018 5.1a2.9 2.9 0 015.5 1.5c0 3.6-5.5 6.9-5.5 6.9z" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  calendar: <><rect x="2.4" y="3.4" width="11.2" height="10.4" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M5.4 2v2.6M10.6 2v2.6M2.4 7h11.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
  chart: <path d="M2.6 11.4l3.4-3.8 2.8 2.4 2.8-3.8 2.2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
};

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="psd-section">
      <h3 className="psd-section__title">
        <span className="psd-section__icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 16 16">{ICONS[icon]}</svg>
        </span>
        {title}
      </h3>
      <div className="psd-section__body">{children}</div>
    </section>
  );
}
