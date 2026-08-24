/**
 * CarePath — Update Patient (Full-page form)
 *
 * Pre-fills every field from the existing EHR record, lets the care manager
 * edit anything, and PUTs the changes via PUT /ehr/patients/{id}.
 *
 * Route: /care-manager/patients/:id/edit
 * Backend: PUT /api/v1/ehr/patients/{id}  (PatientUpdatePayload — all fields optional)
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { ehrService, type PatientDetail } from '../../services/ehrService';
import { toApiError } from '../../services/apiClient';
import type { PatientUpdatePayload } from '../../services/ehrService';

/* ── Enum options (mirrors backend ehr.py) ── */
const GENDER_OPTS     = ['male', 'female', 'other'];
const INSURANCE_OPTS  = ['Medicare', 'Medicaid', 'Private', 'Self-pay', 'Medicare_Advantage', 'Uninsured'];
const ADM_TYPE_OPTS   = ['elective', 'emergency', 'urgent'];
const DISC_DEST_OPTS  = ['home', 'rehab', 'nursing_home', 'other'];

/* ── Stepper sections ── */
const SECTIONS = [
  { id: 'patient',      num: 1, title: 'Patient Information',   desc: 'Basic details and demographics' },
  { id: 'clinical',     num: 2, title: 'Clinical Information',  desc: 'Conditions, vitals, and labs' },
  { id: 'medications',  num: 3, title: 'Medications',           desc: 'Medication details and history' },
  { id: 'utilization',  num: 4, title: 'Utilization History',   desc: 'Previous visits and admissions' },
  { id: 'admission',    num: 5, title: 'Admission & Follow-up', desc: 'Admission details and outcomes' },
  { id: 'notes',        num: 6, title: 'Clinical Notes',        desc: 'Additional observations' },
];

/* ── Flat form state (all strings so inputs stay controlled) ── */
interface FormState {
  first_name: string; last_name: string; date_of_birth: string; age: string;
  gender: string; bmi: string; insurance_type: string; race: string;
  contact_number: string; email: string; address: string;

  diabetes_flag: number; heart_failure_flag: number; cardiac_history_flag: number;
  copd_asthma_flag: number; ckd_flag: number; cancer_flag: number;
  dementia_flag: number; hypertension_flag: number; immunocompromised_flag: number;
  charlson_comorbidity_index: string;

  systolic_bp: string; diastolic_bp: string; heart_rate: string;
  respiratory_rate: string; temperature: string; spo2: string; pain_score_clinical: string;

  hemoglobin: string; creatinine: string; glucose: string; hba1c: string;
  wbc_count: string; total_bilirubin: string; platelet_count: string;
  sodium: string; potassium: string; troponin: string; bnp: string;
  lactate: string; inr: string;

  active_medication_count: string; medication_count_at_discharge: string;
  polypharmacy_flag: number; high_risk_medication_flag: number;
  on_anticoagulants_flag: number; on_insulin_flag: number;
  medication_adherence_rate: string;

  previous_admissions_12m: string; previous_er_visits_12m: string;
  prior_30_day_readmission_flag: number; days_since_last_ed_visit: string;
  ed_visits_90d: string; ed_visits_30d: string; outpatient_visits_365d: string;
  days_since_last_pcp_visit: string; missed_appointments_6m: string;

  admission_date: string; discharge_date: string; admission_type: string;
  length_of_stay_days: string; icu_stay_flag: number; discharge_destination: string;
  follow_up_within_7_days_flag: number; follow_up_appointment_date: string;
  total_charges_index_stay: string;

  clinical_notes: string;
}

/* ── Map PatientDetail → flat FormState ── */
function recordToForm(p: PatientDetail): FormState {
  const s = (v: unknown) => (v == null ? '' : String(v));
  // Split name into first / last
  const parts = (p.name ?? '').trim().split(/\s+/);
  const first_name = parts[0] ?? '';
  const last_name  = parts.slice(1).join(' ');

  return {
    first_name, last_name,
    date_of_birth: s(p.date_of_birth), age: s(p.age),
    gender: p.gender ?? 'other', bmi: s(p.bmi),
    insurance_type: p.insurance_type ?? 'Private', race: p.race ?? '',
    contact_number: p.contact_number ?? '', email: p.email ?? '', address: p.address ?? '',

    diabetes_flag:           p.diabetes_flag           ?? 0,
    heart_failure_flag:      p.heart_failure_flag      ?? 0,
    cardiac_history_flag:    p.cardiac_history_flag    ?? 0,
    copd_asthma_flag:        p.copd_asthma_flag        ?? 0,
    ckd_flag:                p.ckd_flag                ?? 0,
    cancer_flag:             p.cancer_flag             ?? 0,
    dementia_flag:           p.dementia_flag           ?? 0,
    hypertension_flag:       p.hypertension_flag       ?? 0,
    immunocompromised_flag:  p.immunocompromised_flag  ?? 0,
    charlson_comorbidity_index: s(p.charlson_comorbidity_index),

    systolic_bp: s(p.systolic_bp), diastolic_bp: s(p.diastolic_bp),
    heart_rate: s(p.heart_rate), respiratory_rate: s(p.respiratory_rate),
    temperature: s(p.temperature), spo2: s(p.spo2),
    pain_score_clinical: s(p.pain_score_clinical),

    hemoglobin: s(p.hemoglobin), creatinine: s(p.creatinine),
    glucose: s(p.glucose), hba1c: s(p.hba1c), wbc_count: s(p.wbc_count),
    total_bilirubin: s(p.total_bilirubin), platelet_count: s(p.platelet_count),
    sodium: s(p.sodium), potassium: s(p.potassium), troponin: s(p.troponin),
    bnp: s(p.bnp), lactate: s(p.lactate), inr: s(p.inr),

    active_medication_count: s(p.active_medication_count),
    medication_count_at_discharge: s(p.medication_count_at_discharge),
    polypharmacy_flag:        p.polypharmacy_flag        ?? 0,
    high_risk_medication_flag:p.high_risk_medication_flag ?? 0,
    on_anticoagulants_flag:   p.on_anticoagulants_flag   ?? 0,
    on_insulin_flag:          p.on_insulin_flag           ?? 0,
    medication_adherence_rate: s(p.medication_adherence_rate),

    previous_admissions_12m: s(p.previous_admissions_12m),
    previous_er_visits_12m:  s(p.previous_er_visits_12m),
    prior_30_day_readmission_flag: p.prior_30_day_readmission_flag ?? 0,
    days_since_last_ed_visit: s(p.days_since_last_ed_visit),
    ed_visits_90d: s(p.ed_visits_90d), ed_visits_30d: s(p.ed_visits_30d),
    outpatient_visits_365d: s(p.outpatient_visits_365d),
    days_since_last_pcp_visit: s(p.days_since_last_pcp_visit),
    missed_appointments_6m: s(p.missed_appointments_6m),

    admission_date: s(p.admission_date), discharge_date: s(p.discharge_date),
    admission_type: p.admission_type ?? '',
    length_of_stay_days: s(p.length_of_stay_days),
    icu_stay_flag: p.icu_stay_flag ?? 0,
    discharge_destination: p.discharge_destination ?? '',
    follow_up_within_7_days_flag: p.follow_up_within_7_days_flag ?? 0,
    follow_up_appointment_date: s(p.follow_up_appointment_date),
    total_charges_index_stay: s(p.total_charges_index_stay),

    clinical_notes: p.clinical_notes ?? '',
  };
}

/* ── Map FormState → PUT payload ── */
function buildPayload(f: FormState): PatientUpdatePayload {
  const n = (v: string) => (v === '' ? undefined : Number(v));
  const flag = (v: number) => v;
  const fullName = `${f.first_name.trim()} ${f.last_name.trim()}`.trim();

  return {
    demographics: {
      name: fullName,
      date_of_birth: f.date_of_birth,
      age: Number(f.age) || 0,
      gender: f.gender as 'male' | 'female' | 'other',
      bmi: Number(f.bmi) || 24,
      insurance_type: f.insurance_type as PatientUpdatePayload['demographics'] extends infer D
        ? D extends { insurance_type: infer I } ? I : never : never,
      race: f.race.trim() || null,
    },
    chronic_conditions: {
      diabetes_flag: flag(f.diabetes_flag),
      heart_failure_flag: flag(f.heart_failure_flag),
      cardiac_history_flag: flag(f.cardiac_history_flag),
      copd_asthma_flag: flag(f.copd_asthma_flag),
      ckd_flag: flag(f.ckd_flag),
      cancer_flag: flag(f.cancer_flag),
      dementia_flag: flag(f.dementia_flag),
      hypertension_flag: flag(f.hypertension_flag),
      immunocompromised_flag: flag(f.immunocompromised_flag),
      charlson_comorbidity_index: n(f.charlson_comorbidity_index),
    },
    vital_signs_current: {
      systolic_bp: n(f.systolic_bp), diastolic_bp: n(f.diastolic_bp),
      heart_rate: n(f.heart_rate), respiratory_rate: n(f.respiratory_rate),
      temperature: n(f.temperature), spo2: n(f.spo2),
      pain_score_clinical: n(f.pain_score_clinical),
    },
    lab_values: {
      hemoglobin: Number(f.hemoglobin) || 14,
      creatinine: Number(f.creatinine) || 0.9,
      glucose: Number(f.glucose) || 95,
      wbc_count: Number(f.wbc_count) || 7.5,
      hba1c: n(f.hba1c), total_bilirubin: n(f.total_bilirubin),
      platelet_count: n(f.platelet_count), sodium: n(f.sodium),
      potassium: n(f.potassium), troponin: n(f.troponin),
      bnp: n(f.bnp), lactate: n(f.lactate), inr: n(f.inr),
    },
    medications: {
      active_medication_count: Number(f.active_medication_count) || 0,
      medication_count_at_discharge: n(f.medication_count_at_discharge),
      polypharmacy_flag: flag(f.polypharmacy_flag),
      high_risk_medication_flag: flag(f.high_risk_medication_flag),
      on_anticoagulants_flag: flag(f.on_anticoagulants_flag),
      on_insulin_flag: flag(f.on_insulin_flag),
      medication_adherence_rate: n(f.medication_adherence_rate),
    },
    utilization_history: {
      previous_admissions_12m: Number(f.previous_admissions_12m) || 0,
      previous_er_visits_12m: Number(f.previous_er_visits_12m) || 0,
      prior_30_day_readmission_flag: flag(f.prior_30_day_readmission_flag),
      days_since_last_ed_visit: n(f.days_since_last_ed_visit),
      ed_visits_90d: n(f.ed_visits_90d), ed_visits_30d: n(f.ed_visits_30d),
      outpatient_visits_365d: n(f.outpatient_visits_365d),
      days_since_last_pcp_visit: n(f.days_since_last_pcp_visit),
      missed_appointments_6m: n(f.missed_appointments_6m),
    },
    admission_data: {
      admission_date: f.admission_date || null,
      discharge_date: f.discharge_date || null,
      admission_type: (f.admission_type || null) as 'elective' | 'emergency' | 'urgent' | null,
      length_of_stay_days: n(f.length_of_stay_days),
      icu_stay_flag: flag(f.icu_stay_flag),
      discharge_destination: (f.discharge_destination || null) as 'home' | 'rehab' | 'nursing_home' | 'other' | null,
      follow_up_within_7_days_flag: flag(f.follow_up_within_7_days_flag),
      follow_up_appointment_date: f.follow_up_appointment_date || null,
      total_charges_index_stay: n(f.total_charges_index_stay),
    },
    clinical_notes: f.clinical_notes.trim() || null,
    contact_number: f.contact_number.trim() || null,
    email: f.email.trim() || null,
    address: f.address.trim() || null,
  };
}

/* ══════════════════════════════════════════════════
   Page component
══════════════════════════════════════════════════ */
export default function UpdatePatientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [record, setRecord]             = useState<PatientDetail | null>(null);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const [form, setForm]               = useState<FormState | null>(null);
  const [activeSection, setActiveSection] = useState('patient');
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [hasChanges, setHasChanges]   = useState(false);

  /* ── Load existing record ── */
  const loadRecord = useCallback(async () => {
    if (!id) return;
    setLoadingRecord(true);
    setLoadError(null);
    try {
      const detail = await ehrService.getById(Number(id));
      setRecord(detail);
      setForm(recordToForm(detail));
    } catch (err) {
      setLoadError(toApiError(err).message);
    } finally {
      setLoadingRecord(false);
    }
  }, [id]);

  useEffect(() => { void loadRecord(); }, [loadRecord]);

  /* ── Field helpers ── */
  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => prev ? { ...prev, [key]: e.target.value } : prev);
      setHasChanges(true);
      setFormError('');
    };

  const setFlag = (key: keyof FormState) => () => {
    setForm((prev) => prev ? { ...prev, [key]: (prev[key] as number) === 1 ? 0 : 1 } : prev);
    setHasChanges(true);
  };

  const scrollTo = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── Save (PUT) ── */
  const handleUpdate = async () => {
    if (!form || !record) return;
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('First name and last name are required.'); return;
    }
    if (!form.date_of_birth || !form.age) {
      setFormError('Date of birth and age are required.'); return;
    }
    if (!form.hemoglobin || !form.creatinine || !form.glucose || !form.wbc_count) {
      setFormError('Lab values (hemoglobin, creatinine, glucose, WBC) are required.'); return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = buildPayload(form);
      await ehrService.update(record.id, payload);
      toast.success(`Patient record updated — MRN ${record.mrn}`);
      navigate(`/care-manager/patients/${id}`);
    } catch (err) {
      setFormError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Guard: cancel with unsaved changes ── */
  const handleCancel = () => {
    if (hasChanges) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    navigate(`/care-manager/patients/${id}`);
  };

  /* ── Render: loading / error ── */
  if (loadingRecord) {
    return (
      <CareManagerLayout breadcrumb="Update Patient">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={64} />
          <Skeleton height={400} />
        </div>
      </CareManagerLayout>
    );
  }

  if (loadError || !record || !form) {
    return (
      <CareManagerLayout breadcrumb="Update Patient">
        <ErrorState
          title="Could not load patient record"
          message={loadError ?? 'Record not found.'}
          onRetry={loadRecord}
        />
      </CareManagerLayout>
    );
  }

  /* ── Main render ── */
  return (
    <CareManagerLayout breadcrumb="Update Patient">
      <div className="cpf-page">

        {/* ── Left stepper ── */}
        <aside className="cpf-stepper">
          {/* Patient identity badge */}
          <div className="cpf-stepper__patient">
            <span className="cpf-stepper__avatar">{record.name?.[0]?.toUpperCase() ?? 'P'}</span>
            <div className="cpf-stepper__pinfo">
              <span className="cpf-stepper__pname">{record.name}</span>
              <span className="cpf-stepper__pmrn">MRN {record.mrn}</span>
            </div>
          </div>
          <div className="cpf-stepper__divider" />
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`cpf-step${activeSection === s.id ? ' cpf-step--active' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              <span className="cpf-step__num">{s.num}</span>
              <span className="cpf-step__text">
                <span className="cpf-step__title">{s.title}</span>
                <span className="cpf-step__desc">{s.desc}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* ── Form area ── */}
        <div className="cpf-form-area">

          {/* Header */}
          <div className="cpf-form-header cpf-form-header--update">
            <div className="cpf-form-header__left">
              <div className="cpf-form-header__badge">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Editing
              </div>
              <h1 className="cpf-form-header__title">Update Patient Record</h1>
              <p className="cpf-form-header__sub">
                Editing <strong>{record.name}</strong> · MRN {record.mrn}
                {record.updated_at && (
                  <> · Last updated {new Date(record.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                )}
              </p>
            </div>
            <div className="cpf-form-header__actions">
              <button className="cp-btn cp-btn--ghost" onClick={handleCancel}>
                Cancel
              </button>
              <button
                className="cp-btn cp-btn--primary"
                onClick={handleUpdate}
                disabled={saving || !hasChanges}
              >
                {saving
                  ? <><span className="cp-btn__spinner" /> Saving…</>
                  : <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 2H5L2 5v9h12V2zM10 2v4H5V2M8 8v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Save Changes</>
                }
              </button>
            </div>
          </div>

          {/* Unsaved banner */}
          {hasChanges && (
            <div className="cpf-unsaved">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 10.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              You have unsaved changes.
            </div>
          )}

          {/* Validation error */}
          {formError && (
            <div className="cpf-error">
              <span>⚠</span> {formError}
            </div>
          )}

          {/* ── Section 1: Patient Information ── */}
          <section id="section-patient" className="cpf-section">
            <h2 className="cpf-section__title">1. Patient Information</h2>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="First Name" required value={form.first_name} onChange={set('first_name')} placeholder="First name" />
              <Inp label="Last Name"  required value={form.last_name}  onChange={set('last_name')}  placeholder="Last name" />
              <Inp label="Date of Birth" required type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
              <Inp label="Age" required type="number" value={form.age} onChange={set('age')} placeholder="Age" />
              <Sel label="Gender" required value={form.gender} onChange={set('gender')} options={GENDER_OPTS} />
              <Inp label="Race / Ethnicity" value={form.race} onChange={set('race')} placeholder="Optional" />
              <Inp label="BMI" required type="number" value={form.bmi} onChange={set('bmi')} placeholder="BMI" />
              <Sel label="Insurance Type" required value={form.insurance_type} onChange={set('insurance_type')} options={INSURANCE_OPTS} />
              <Inp label="Contact Number" value={form.contact_number} onChange={set('contact_number')} placeholder="Optional" />
              <Inp label="Email" type="email" value={form.email} onChange={set('email')} placeholder="Optional" />
              <Inp label="Address" value={form.address} onChange={set('address')} placeholder="Optional" className="cpf-span2" />
            </div>
          </section>

          {/* ── Section 2: Clinical Information ── */}
          <section id="section-clinical" className="cpf-section">
            <h2 className="cpf-section__title">2. Clinical Information</h2>

            <h3 className="cpf-subsection">Chronic Conditions</h3>
            <div className="cpf-flags">
              {([
                ['diabetes_flag',          'Diabetes'],
                ['heart_failure_flag',     'Heart Failure'],
                ['cardiac_history_flag',   'Cardiac History'],
                ['copd_asthma_flag',       'COPD / Asthma'],
                ['ckd_flag',               'Chronic Kidney Disease'],
                ['cancer_flag',            'Cancer'],
                ['dementia_flag',          'Dementia'],
                ['hypertension_flag',      'Hypertension'],
                ['immunocompromised_flag', 'Immunocompromised'],
              ] as [keyof FormState, string][]).map(([key, label]) => (
                <FlagCheck key={key} label={label}
                  checked={form[key] === 1}
                  onChange={setFlag(key)} />
              ))}
            </div>
            <div className="cpf-grid cpf-grid--3" style={{ marginTop: 12 }}>
              <Inp label="Charlson Comorbidity Index" type="number" value={form.charlson_comorbidity_index} onChange={set('charlson_comorbidity_index')} placeholder="Score" />
            </div>

            <h3 className="cpf-subsection">Vital Signs (Current)</h3>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="Systolic BP"      type="number" value={form.systolic_bp}        onChange={set('systolic_bp')}        placeholder="mmHg" />
              <Inp label="Diastolic BP"     type="number" value={form.diastolic_bp}       onChange={set('diastolic_bp')}       placeholder="mmHg" />
              <Inp label="Heart Rate"       type="number" value={form.heart_rate}         onChange={set('heart_rate')}         placeholder="bpm" />
              <Inp label="Respiratory Rate" type="number" value={form.respiratory_rate}   onChange={set('respiratory_rate')}   placeholder="/min" />
              <Inp label="Temperature (°F)" type="number" value={form.temperature}        onChange={set('temperature')}        placeholder="°F" />
              <Inp label="SpO2 (%)"         type="number" value={form.spo2}               onChange={set('spo2')}               placeholder="%" />
              <Inp label="Pain Score"       type="number" value={form.pain_score_clinical} onChange={set('pain_score_clinical')} placeholder="0–10" />
            </div>

            <h3 className="cpf-subsection">Lab Values</h3>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="Hemoglobin"       required type="number" value={form.hemoglobin}       onChange={set('hemoglobin')}       placeholder="g/dL" />
              <Inp label="Creatinine"       required type="number" value={form.creatinine}       onChange={set('creatinine')}       placeholder="mg/dL" />
              <Inp label="Glucose"          required type="number" value={form.glucose}          onChange={set('glucose')}          placeholder="mg/dL" />
              <Inp label="HbA1c (%)"                type="number" value={form.hba1c}             onChange={set('hba1c')}             placeholder="%" />
              <Inp label="WBC Count"        required type="number" value={form.wbc_count}        onChange={set('wbc_count')}        placeholder="10³/µL" />
              <Inp label="Total Bilirubin"          type="number" value={form.total_bilirubin}   onChange={set('total_bilirubin')}   placeholder="mg/dL" />
              <Inp label="Platelet Count"           type="number" value={form.platelet_count}    onChange={set('platelet_count')}    placeholder="10³/µL" />
              <Inp label="Sodium"                   type="number" value={form.sodium}            onChange={set('sodium')}            placeholder="mEq/L" />
              <Inp label="Potassium"                type="number" value={form.potassium}         onChange={set('potassium')}         placeholder="mEq/L" />
              <Inp label="Troponin"                 type="number" value={form.troponin}          onChange={set('troponin')}          placeholder="ng/mL" />
              <Inp label="BNP"                      type="number" value={form.bnp}               onChange={set('bnp')}               placeholder="pg/mL" />
              <Inp label="Lactate"                  type="number" value={form.lactate}           onChange={set('lactate')}           placeholder="mmol/L" />
              <Inp label="INR"                      type="number" value={form.inr}               onChange={set('inr')}               placeholder="ratio" />
            </div>
          </section>

          {/* ── Section 3: Medications ── */}
          <section id="section-medications" className="cpf-section">
            <h2 className="cpf-section__title">3. Medications</h2>
            <div className="cpf-grid cpf-grid--3">
              <Inp label="Active Medication Count"        type="number" value={form.active_medication_count}        onChange={set('active_medication_count')}        placeholder="0" />
              <Inp label="Medication Count at Discharge"  type="number" value={form.medication_count_at_discharge}  onChange={set('medication_count_at_discharge')}  placeholder="Count" />
              <Inp label="Medication Adherence Rate (%)"  type="number" value={form.medication_adherence_rate}      onChange={set('medication_adherence_rate')}      placeholder="%" />
            </div>
            <div className="cpf-flags" style={{ marginTop: 12 }}>
              {([
                ['polypharmacy_flag',         'Polypharmacy'],
                ['high_risk_medication_flag', 'High Risk Medication'],
                ['on_anticoagulants_flag',    'On Anticoagulants'],
                ['on_insulin_flag',           'On Insulin'],
              ] as [keyof FormState, string][]).map(([key, label]) => (
                <FlagCheck key={key} label={label} checked={form[key] === 1} onChange={setFlag(key)} />
              ))}
            </div>
          </section>

          {/* ── Section 4: Utilization History ── */}
          <section id="section-utilization" className="cpf-section">
            <h2 className="cpf-section__title">4. Utilization History</h2>
            <div className="cpf-grid cpf-grid--3">
              <Inp label="Previous Admissions (12m)"  type="number" value={form.previous_admissions_12m}  onChange={set('previous_admissions_12m')}  placeholder="0" />
              <Inp label="Previous ER Visits (12m)"   type="number" value={form.previous_er_visits_12m}   onChange={set('previous_er_visits_12m')}   placeholder="0" />
              <Sel label="Prior 30-Day Readmission"
                value={String(form.prior_30_day_readmission_flag)}
                onChange={(e) => { setForm((p) => p ? { ...p, prior_30_day_readmission_flag: Number(e.target.value) } : p); setHasChanges(true); }}
                options={['0', '1']} optionLabels={['No', 'Yes']} />
              <Inp label="Days Since Last ED Visit"   type="number" value={form.days_since_last_ed_visit}  onChange={set('days_since_last_ed_visit')}  placeholder="Days" />
              <Inp label="ED Visits (90d)"            type="number" value={form.ed_visits_90d}             onChange={set('ed_visits_90d')}             placeholder="Count" />
              <Inp label="ED Visits (30d)"            type="number" value={form.ed_visits_30d}             onChange={set('ed_visits_30d')}             placeholder="Count" />
              <Inp label="Outpatient Visits (365d)"   type="number" value={form.outpatient_visits_365d}    onChange={set('outpatient_visits_365d')}    placeholder="Count" />
              <Inp label="Days Since Last PCP Visit"  type="number" value={form.days_since_last_pcp_visit} onChange={set('days_since_last_pcp_visit')} placeholder="Days" />
              <Inp label="Missed Appointments (6m)"   type="number" value={form.missed_appointments_6m}   onChange={set('missed_appointments_6m')}   placeholder="Count" />
            </div>
          </section>

          {/* ── Section 5: Admission & Follow-up ── */}
          <section id="section-admission" className="cpf-section">
            <h2 className="cpf-section__title">5. Admission & Follow-up</h2>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="Admission Date"         type="date"   value={form.admission_date}         onChange={set('admission_date')} />
              <Sel label="Admission Type"         value={form.admission_type}         onChange={set('admission_type')}         options={ADM_TYPE_OPTS} />
              <Inp label="Length of Stay (Days)"  type="number" value={form.length_of_stay_days}    onChange={set('length_of_stay_days')}   placeholder="Days" />
              <Sel label="ICU Stay"
                value={String(form.icu_stay_flag)}
                onChange={(e) => { setForm((p) => p ? { ...p, icu_stay_flag: Number(e.target.value) } : p); setHasChanges(true); }}
                options={['0', '1']} optionLabels={['No', 'Yes']} />
              <Inp label="Discharge Date"         type="date"   value={form.discharge_date}         onChange={set('discharge_date')} />
              <Sel label="Discharge Destination"  value={form.discharge_destination}  onChange={set('discharge_destination')}  options={DISC_DEST_OPTS} />
              <Sel label="Follow-up Within 7 Days"
                value={String(form.follow_up_within_7_days_flag)}
                onChange={(e) => { setForm((p) => p ? { ...p, follow_up_within_7_days_flag: Number(e.target.value) } : p); setHasChanges(true); }}
                options={['0', '1']} optionLabels={['No', 'Yes']} />
              <Inp label="Follow-up Appointment Date" type="date" value={form.follow_up_appointment_date} onChange={set('follow_up_appointment_date')} />
              <Inp label="Total Charges (Index Stay)"  type="number" value={form.total_charges_index_stay} onChange={set('total_charges_index_stay')} placeholder="USD" />
            </div>
          </section>

          {/* ── Section 6: Clinical Notes ── */}
          <section id="section-notes" className="cpf-section">
            <h2 className="cpf-section__title">6. Clinical Notes</h2>
            <label className="cpf-field">
              <span className="cpf-field__label">Clinical Notes (Optional)</span>
              <textarea
                className="cpf-textarea"
                rows={5}
                value={form.clinical_notes}
                onChange={set('clinical_notes')}
                placeholder="Update any clinical notes or observations…"
                maxLength={1000}
              />
              <span className="cpf-field__hint">{form.clinical_notes.length} / 1000</span>
            </label>
          </section>

          {/* ── Sticky footer ── */}
          <div className="cpf-footer cpf-footer--update">
            <button className="cp-btn cp-btn--ghost" onClick={handleCancel}>
              ← Cancel
            </button>
            <div className="cpf-footer__right">
              {hasChanges && (
                <span className="cpf-footer__unsaved">Unsaved changes</span>
              )}
              <button
                className="cp-btn cp-btn--primary"
                onClick={handleUpdate}
                disabled={saving || !hasChanges}
              >
                {saving
                  ? <><span className="cp-btn__spinner" /> Saving…</>
                  : 'Save Changes →'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </CareManagerLayout>
  );
}

/* ── Reusable form atoms ── */

function Inp({ label, required, type = 'text', value, onChange, placeholder, className }: {
  label: string; required?: boolean; type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`cpf-field${className ? ` ${className}` : ''}`}>
      <span className="cpf-field__label">
        {label}{required && <span className="cpf-field__req"> *</span>}
      </span>
      <input
        className="cpf-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : undefined}
      />
    </label>
  );
}

function Sel({ label, required, value, onChange, options, optionLabels }: {
  label: string; required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[]; optionLabels?: string[];
}) {
  return (
    <label className="cpf-field">
      <span className="cpf-field__label">
        {label}{required && <span className="cpf-field__req"> *</span>}
      </span>
      <select className="cpf-input cpf-select" value={value} onChange={onChange}>
        <option value="">— Select —</option>
        {options.map((o, i) => (
          <option key={o} value={o}>
            {optionLabels ? optionLabels[i] : o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}

function FlagCheck({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className={`cpf-flag${checked ? ' cpf-flag--on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="cpf-flag__box">{checked ? '✓' : ''}</span>
      {label}
    </label>
  );
}
