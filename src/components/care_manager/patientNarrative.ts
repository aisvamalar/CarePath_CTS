/**
 * Builds the patient clinical narrative that gets streamed on the detail page.
 *
 * Every sentence is derived from fields on the real EHR record, the stored
 * readmission model output, and the post-discharge agent status. Nothing is
 * invented — when a field is absent the corresponding line is omitted.
 */
import type { PatientDetail } from '../../services/ehrService';
import type { PostDischargeStatus } from '../../services/careManagerService';
import type { ReadmissionDetails } from '../../services/predictionService';

export interface NarrativeInput {
  record: PatientDetail;
  score: number | null;
  details: ReadmissionDetails | null;
  postDischarge: PostDischargeStatus | null;
}

/** Chronic condition flags → readable labels. */
function chronicConditions(r: PatientDetail): string[] {
  const out: string[] = [];
  if (r.diabetes_flag) out.push('diabetes');
  if (r.heart_failure_flag) out.push('heart failure');
  if (r.cardiac_history_flag) out.push('cardiac history');
  if (r.copd_asthma_flag) out.push('COPD/asthma');
  if (r.ckd_flag) out.push('chronic kidney disease');
  if (r.cancer_flag) out.push('cancer');
  if (r.dementia_flag) out.push('dementia');
  if (r.hypertension_flag) out.push('hypertension');
  if (r.immunocompromised_flag) out.push('immunocompromised status');
  return out;
}

function riskBand(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 0.7) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  return 'LOW';
}

/** The reasoning trace — what the retrieval "looked at". */
export function buildRetrievalReasoning({ record, score, postDischarge }: NarrativeInput): string {
  const lines: string[] = [];

  lines.push(`Reading the EHR record for **${record.name}** (MRN ${record.mrn}).`);

  const conditions = chronicConditions(record);
  lines.push(
    conditions.length > 0
      ? `Found **${conditions.length} chronic condition flag${conditions.length === 1 ? '' : 's'}**: ${conditions.join(', ')}.`
      : 'No chronic condition flags are set on this record.',
  );

  const labs: string[] = [];
  if (record.hemoglobin != null) labs.push('hemoglobin');
  if (record.creatinine != null) labs.push('creatinine');
  if (record.glucose != null) labs.push('glucose');
  if (record.hba1c != null) labs.push('HbA1c');
  if (record.wbc_count != null) labs.push('WBC');
  if (labs.length > 0) lines.push(`Pulling lab values: ${labs.join(', ')}.`);

  lines.push(
    `Reviewing utilisation history — **${record.previous_admissions_12m ?? 0} admission(s)** and **${record.previous_er_visits_12m ?? 0} ED visit(s)** in the last 12 months.`,
  );

  if (score !== null) {
    lines.push(
      `Reading the stored readmission model output: **${Math.round(score * 100)}%** (${riskBand(score)} band).`,
    );
  } else {
    lines.push('No readmission prediction is stored for this patient yet.');
  }

  if (postDischarge) {
    const taskCount = postDischarge.care_plan?.tasks?.length ?? 0;
    lines.push(
      `Checking the post-discharge agents — care plan is **${(postDischarge.care_plan?.status ?? 'unknown').replace('_', ' ')}** with ${taskCount} task(s).`,
    );
  }

  lines.push('Composing the clinical summary below.');
  return lines.join('\n');
}

/** The streamed clinical summary document body. */
export function buildPatientNarrative({ record, score, details, postDischarge }: NarrativeInput): string {
  const s: string[] = [];
  const conditions = chronicConditions(record);

  // ── Patient Summary ──
  s.push('## Patient Summary');
  const genderWord = record.gender ? record.gender.toLowerCase() : 'patient';
  let intro = `${record.name} is a ${record.age}-year-old ${genderWord}`;
  if (record.admission_type) intro += `, admitted as a ${record.admission_type} admission`;
  if (record.length_of_stay_days) intro += ` with a ${record.length_of_stay_days}-day length of stay`;
  if (record.discharge_destination) intro += `, discharged to ${record.discharge_destination.replace('_', ' ')}`;
  intro += '.';
  s.push(intro);

  if (conditions.length > 0) {
    s.push(`Active chronic conditions on record: ${conditions.join(', ')}.`);
  }
  if (record.charlson_comorbidity_index) {
    s.push(`Charlson comorbidity index is ${record.charlson_comorbidity_index}.`);
  }

  // ── Clinical Picture ──
  s.push('## Clinical Picture');
  const vitals: string[] = [];
  if (record.systolic_bp && record.diastolic_bp) vitals.push(`BP ${record.systolic_bp}/${record.diastolic_bp} mmHg`);
  if (record.heart_rate) vitals.push(`HR ${record.heart_rate} bpm`);
  if (record.respiratory_rate) vitals.push(`RR ${record.respiratory_rate}`);
  if (record.temperature) vitals.push(`temp ${record.temperature}°F`);
  if (record.spo2) vitals.push(`SpO2 ${record.spo2}%`);
  s.push(vitals.length > 0 ? `Latest recorded vitals: ${vitals.join(', ')}.` : 'No current vital signs are recorded.');

  const labLines: string[] = [];
  if (record.hemoglobin != null) labLines.push(`hemoglobin ${record.hemoglobin} g/dL`);
  if (record.creatinine != null) labLines.push(`creatinine ${record.creatinine} mg/dL`);
  if (record.glucose != null) labLines.push(`glucose ${record.glucose} mg/dL`);
  if (record.hba1c != null) labLines.push(`HbA1c ${record.hba1c}%`);
  if (record.wbc_count != null) labLines.push(`WBC ${record.wbc_count}`);
  if (labLines.length > 0) s.push(`Laboratory values: ${labLines.join(', ')}.`);

  if (record.bmi) s.push(`BMI is recorded at ${record.bmi}.`);

  // ── Medications ──
  s.push('## Medications');
  const medBits: string[] = [];
  medBits.push(`${record.active_medication_count ?? 0} active medication(s)`);
  if (record.polypharmacy_flag) medBits.push('flagged for polypharmacy');
  if (record.high_risk_medication_flag) medBits.push('on high-risk medication');
  if (record.on_anticoagulants_flag) medBits.push('on anticoagulants');
  if (record.on_insulin_flag) medBits.push('on insulin');
  s.push(`${medBits.join(', ')}.`);
  if (record.medication_adherence_rate != null) {
    const pct = Math.round(record.medication_adherence_rate * 100);
    s.push(
      pct < 80
        ? `Medication adherence is recorded at ${pct}%, which is below the 80% threshold.`
        : `Medication adherence is recorded at ${pct}%.`,
    );
  }

  // ── Utilisation ──
  s.push('## Utilisation History');
  s.push(
    `${record.previous_admissions_12m ?? 0} inpatient admission(s) and ${record.previous_er_visits_12m ?? 0} emergency visit(s) in the past 12 months.`,
  );
  if (record.prior_30_day_readmission_flag) {
    s.push('A prior 30-day readmission is flagged on this record.');
  }
  if (record.icu_stay_flag) s.push('An ICU stay was recorded during the index admission.');
  if (record.missed_appointments_6m) {
    s.push(`${record.missed_appointments_6m} missed appointment(s) in the last 6 months.`);
  }

  // ── Final prediction ──
  s.push('## Readmission Prediction');
  if (score !== null) {
    const pct = Math.round(score * 100);
    const band = riskBand(score);
    s.push(`**30-day readmission risk: ${pct}% — ${band} risk band.**`);
    if (details?.features_used) {
      s.push(`The model evaluated ${details.features_used} features from this record.`);
    }
    s.push(
      band === 'HIGH'
        ? 'This patient sits in the high-risk band and should be prioritised for review and proactive outreach.'
        : band === 'MEDIUM'
          ? 'This patient sits in the medium-risk band; routine monitoring with attention to the gaps below is appropriate.'
          : 'This patient sits in the low-risk band based on the current record.',
    );
  } else {
    s.push('No readmission prediction has been generated yet. Run the model to populate this section.');
  }

  // ── Care plan status ──
  if (postDischarge) {
    s.push('## Post-Discharge Status');
    const status = (postDischarge.care_plan?.status ?? 'unknown').replace('_', ' ');
    s.push(`Care plan status is **${status}**.`);
    const tasks = postDischarge.care_plan?.tasks ?? [];
    if (tasks.length > 0) {
      const doneCount = tasks.filter((t) => t.status === 'completed').length;
      s.push(`${doneCount} of ${tasks.length} care-plan task(s) are complete.`);
    }
    s.push(
      postDischarge.follow_up?.is_scheduled
        ? `A follow-up check-in is scheduled${postDischarge.follow_up.next_checkin ? ` for ${postDischarge.follow_up.next_checkin}` : ''}.`
        : 'No follow-up check-in is currently scheduled.',
    );
  }

  // ── Clinical notes ──
  if (record.clinical_notes) {
    s.push('## Clinical Notes');
    s.push(record.clinical_notes);
  }

  return s.join('\n');
}
