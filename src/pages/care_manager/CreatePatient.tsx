/**
 * CarePath — Create New Patient (Full-page form)
 * All fields from the backend PatientEHRCreate schema organized into sections.
 * Matches the visual reference: step-based left nav + form sections.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CareManagerLayout from '../../components/care_manager/CareManagerLayout';
import { useToast } from '../../components/ui/Toast';
import { ehrService } from '../../services/ehrService';
import { toApiError } from '../../services/apiClient';
import type { PatientCreatePayload } from '../../services/ehrService';

/* ── Enum options from backend ehr.py ── */
const GENDER_OPTS = ['male', 'female', 'other'];
const INSURANCE_OPTS = ['Medicare', 'Medicaid', 'Private', 'Self-pay', 'Medicare_Advantage', 'Uninsured'];
const ADM_TYPE_OPTS = ['elective', 'emergency', 'urgent'];
const DISC_DEST_OPTS = ['home', 'rehab', 'nursing_home', 'other'];

/* ── Section definitions for left stepper ── */
const SECTIONS = [
  { id: 'patient', num: 1, title: 'Patient Information', desc: 'Basic details and demographics' },
  { id: 'clinical', num: 2, title: 'Clinical Information', desc: 'Conditions, vitals, and labs' },
  { id: 'medications', num: 3, title: 'Medications', desc: 'Medication details and history' },
  { id: 'utilization', num: 4, title: 'Utilization History', desc: 'Previous visits and admissions' },
  { id: 'admission', num: 5, title: 'Admission & Follow-up', desc: 'Admission details and outcomes' },
  { id: 'notes', num: 6, title: 'Clinical Notes', desc: 'Additional observations' },
];

/* ── Default form state ── */
const EMPTY_FORM = {
  // Demographics
  first_name: '', last_name: '', date_of_birth: '', age: '',
  gender: 'male', bmi: '', insurance_type: 'Private', race: '',
  // Chronic conditions
  diabetes_flag: 0, heart_failure_flag: 0, cardiac_history_flag: 0,
  copd_asthma_flag: 0, ckd_flag: 0, cancer_flag: 0, dementia_flag: 0,
  hypertension_flag: 0, immunocompromised_flag: 0, charlson_comorbidity_index: '',
  // Vitals
  systolic_bp: '', diastolic_bp: '', heart_rate: '', respiratory_rate: '',
  temperature: '', spo2: '', pain_score_clinical: '',
  // Labs
  hemoglobin: '', creatinine: '', glucose: '', hba1c: '', wbc_count: '',
  total_bilirubin: '', platelet_count: '', sodium: '', potassium: '',
  troponin: '', bnp: '', lactate: '', inr: '',
  // Medications
  active_medication_count: '0', medication_count_at_discharge: '',
  polypharmacy_flag: 0, high_risk_medication_flag: 0,
  on_anticoagulants_flag: 0, on_insulin_flag: 0, medication_adherence_rate: '',
  // Utilization
  previous_admissions_12m: '0', previous_er_visits_12m: '0',
  prior_30_day_readmission_flag: 0, days_since_last_ed_visit: '',
  ed_visits_90d: '', ed_visits_30d: '', outpatient_visits_365d: '',
  days_since_last_pcp_visit: '', missed_appointments_6m: '',
  // Admission
  admission_date: '', discharge_date: '', admission_type: '',
  length_of_stay_days: '', icu_stay_flag: 0, discharge_destination: '',
  follow_up_within_7_days_flag: 0, follow_up_appointment_date: '',
  total_charges_index_stay: '',
  // Notes
  clinical_notes: '',
};

type FormState = typeof EMPTY_FORM;

/* ── Build backend payload from flat form ── */
function buildPayload(f: FormState): PatientCreatePayload {
  const n = (v: string) => (v === '' || v == null) ? undefined : Number(v);
  const flag = (v: number) => v || 0;

  return {
    demographics: {
      name: `${f.first_name.trim()} ${f.last_name.trim()}`.trim(),
      date_of_birth: f.date_of_birth,
      age: Number(f.age) || 0,
      gender: f.gender as 'male' | 'female' | 'other',
      bmi: Number(f.bmi) || 24,
      insurance_type: f.insurance_type as PatientCreatePayload['demographics']['insurance_type'],
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
      charlson_comorbidity_index: n(f.charlson_comorbidity_index) as number | undefined,
    },
    vital_signs_current: {
      systolic_bp: n(f.systolic_bp) as number | undefined,
      diastolic_bp: n(f.diastolic_bp) as number | undefined,
      heart_rate: n(f.heart_rate) as number | undefined,
      respiratory_rate: n(f.respiratory_rate) as number | undefined,
      temperature: n(f.temperature) as number | undefined,
      spo2: n(f.spo2) as number | undefined,
      pain_score_clinical: n(f.pain_score_clinical) as number | undefined,
    },
    lab_values: {
      hemoglobin: Number(f.hemoglobin) || 14,
      creatinine: Number(f.creatinine) || 0.9,
      glucose: Number(f.glucose) || 95,
      wbc_count: Number(f.wbc_count) || 7.5,
      hba1c: n(f.hba1c) as number | undefined,
      total_bilirubin: n(f.total_bilirubin) as number | undefined,
      platelet_count: n(f.platelet_count) as number | undefined,
      sodium: n(f.sodium) as number | undefined,
      potassium: n(f.potassium) as number | undefined,
      troponin: n(f.troponin) as number | undefined,
      bnp: n(f.bnp) as number | undefined,
      lactate: n(f.lactate) as number | undefined,
      inr: n(f.inr) as number | undefined,
    },
    medications: {
      active_medication_count: Number(f.active_medication_count) || 0,
      medication_count_at_discharge: n(f.medication_count_at_discharge) as number | undefined,
      polypharmacy_flag: flag(f.polypharmacy_flag),
      high_risk_medication_flag: flag(f.high_risk_medication_flag),
      on_anticoagulants_flag: flag(f.on_anticoagulants_flag),
      on_insulin_flag: flag(f.on_insulin_flag),
      medication_adherence_rate: n(f.medication_adherence_rate) as number | undefined,
    },
    utilization_history: {
      previous_admissions_12m: Number(f.previous_admissions_12m) || 0,
      previous_er_visits_12m: Number(f.previous_er_visits_12m) || 0,
      prior_30_day_readmission_flag: flag(f.prior_30_day_readmission_flag),
      days_since_last_ed_visit: n(f.days_since_last_ed_visit) as number | undefined,
      ed_visits_90d: n(f.ed_visits_90d) as number | undefined,
      ed_visits_30d: n(f.ed_visits_30d) as number | undefined,
      outpatient_visits_365d: n(f.outpatient_visits_365d) as number | undefined,
      days_since_last_pcp_visit: n(f.days_since_last_pcp_visit) as number | undefined,
      missed_appointments_6m: n(f.missed_appointments_6m) as number | undefined,
    },
    admission_data: {
      admission_date: f.admission_date || null,
      discharge_date: f.discharge_date || null,
      admission_type: (f.admission_type || null) as 'elective' | 'emergency' | 'urgent' | null,
      length_of_stay_days: n(f.length_of_stay_days) as number | undefined,
      icu_stay_flag: flag(f.icu_stay_flag),
      discharge_destination: (f.discharge_destination || null) as 'home' | 'rehab' | 'nursing_home' | 'other' | null,
      follow_up_within_7_days_flag: flag(f.follow_up_within_7_days_flag),
      follow_up_appointment_date: f.follow_up_appointment_date || null,
      total_charges_index_stay: n(f.total_charges_index_stay) as number | undefined,
    },
    clinical_notes: f.clinical_notes.trim() || null,
  };
}

export default function CreatePatientPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeSection, setActiveSection] = useState('patient');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setFlag = (key: keyof FormState) => () =>
    setForm((prev) => ({ ...prev, [key]: (prev[key] as number) === 1 ? 0 : 1 }));

  const handleSave = async () => {
    // Basic validation
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required.'); return;
    }
    if (!form.date_of_birth || !form.age) {
      setError('Date of birth and age are required.'); return;
    }
    if (!form.hemoglobin || !form.creatinine || !form.glucose || !form.wbc_count) {
      setError('Lab values (hemoglobin, creatinine, glucose, WBC) are required.'); return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(form);
      const created = await ehrService.create(payload);
      toast.success(`Patient created — MRN ${created.mrn}`);
      navigate('/care-manager/patients');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareManagerLayout breadcrumb="Create New Patient">
      <div className="cpf-page">
        {/* Left stepper nav */}
        <aside className="cpf-stepper">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`cpf-step${activeSection === s.id ? ' cpf-step--active' : ''}`}
              onClick={() => { setActiveSection(s.id); document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              <span className="cpf-step__num">{s.num}</span>
              <span className="cpf-step__text">
                <span className="cpf-step__title">{s.title}</span>
                <span className="cpf-step__desc">{s.desc}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* Main form */}
        <div className="cpf-form-area">
          {/* Header */}
          <div className="cpf-form-header">
            <div>
              <h1 className="cpf-form-header__title">Create New Patient</h1>
              <p className="cpf-form-header__sub">Add patient information to the EHR. All fields marked with * are required.</p>
            </div>
            <div className="cpf-form-header__actions">
              <button className="cp-btn cp-btn--ghost" onClick={() => navigate('/care-manager/patients')}>Cancel</button>
              <button className="cp-btn cp-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="cp-btn__spinner" /> Saving…</> : '💾 Save Patient'}
              </button>
            </div>
          </div>

          {error && (
            <div className="cpf-error">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Section 1: Patient Information */}
          <section id="section-patient" className="cpf-section">
            <h2 className="cpf-section__title">1. Patient Information</h2>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="First Name" required value={form.first_name} onChange={set('first_name')} placeholder="Enter first name" />
              <Inp label="Last Name" required value={form.last_name} onChange={set('last_name')} placeholder="Enter last name" />
              <Inp label="Date of Birth" required type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
              <Inp label="Age" required type="number" value={form.age} onChange={set('age')} placeholder="Enter age" />
              <Sel label="Gender" required value={form.gender} onChange={set('gender')} options={GENDER_OPTS} />
              <Inp label="Race / Ethnicity" value={form.race} onChange={set('race')} placeholder="Select race" />
              <Inp label="BMI" required type="number" value={form.bmi} onChange={set('bmi')} placeholder="Enter BMI" />
              <Sel label="Insurance Type" required value={form.insurance_type} onChange={set('insurance_type')} options={INSURANCE_OPTS} />
            </div>
          </section>

          {/* Section 2: Clinical Information */}
          <section id="section-clinical" className="cpf-section">
            <h2 className="cpf-section__title">2. Clinical Information</h2>

            <h3 className="cpf-subsection">Chronic Conditions</h3>
            <div className="cpf-flags">
              {[
                ['diabetes_flag', 'Diabetes'], ['heart_failure_flag', 'Heart Failure'],
                ['cardiac_history_flag', 'Cardiac History'], ['copd_asthma_flag', 'COPD / Asthma'],
                ['ckd_flag', 'Chronic Kidney Disease'], ['cancer_flag', 'Cancer'],
                ['dementia_flag', 'Dementia'], ['hypertension_flag', 'Hypertension'],
                ['immunocompromised_flag', 'Immunocompromised'],
              ].map(([key, label]) => (
                <FlagCheck key={key} label={label} checked={form[key as keyof FormState] === 1} onChange={setFlag(key as keyof FormState)} />
              ))}
            </div>
            <div className="cpf-grid cpf-grid--3" style={{ marginTop: 12 }}>
              <Inp label="Charlson Comorbidity Index" type="number" value={form.charlson_comorbidity_index} onChange={set('charlson_comorbidity_index')} placeholder="Enter index score" />
            </div>

            <h3 className="cpf-subsection">Vital Signs (Current)</h3>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="Systolic BP" type="number" value={form.systolic_bp} onChange={set('systolic_bp')} placeholder="Enter systolic" />
              <Inp label="Diastolic BP" type="number" value={form.diastolic_bp} onChange={set('diastolic_bp')} placeholder="Enter diastolic" />
              <Inp label="Heart Rate" type="number" value={form.heart_rate} onChange={set('heart_rate')} placeholder="Enter bpm" />
              <Inp label="Respiratory Rate" type="number" value={form.respiratory_rate} onChange={set('respiratory_rate')} placeholder="Enter rate" />
              <Inp label="Temperature (°F)" type="number" value={form.temperature} onChange={set('temperature')} placeholder="Enter temp" />
              <Inp label="SpO2 (%)" type="number" value={form.spo2} onChange={set('spo2')} placeholder="Enter SpO2" />
              <Inp label="Pain Score" type="number" value={form.pain_score_clinical} onChange={set('pain_score_clinical')} placeholder="Enter score" />
            </div>

            <h3 className="cpf-subsection">Lab Values</h3>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="Hemoglobin" required type="number" value={form.hemoglobin} onChange={set('hemoglobin')} placeholder="Enter value" />
              <Inp label="Creatinine" required type="number" value={form.creatinine} onChange={set('creatinine')} placeholder="Enter value" />
              <Inp label="Glucose" required type="number" value={form.glucose} onChange={set('glucose')} placeholder="Enter value" />
              <Inp label="HbA1c (%)" type="number" value={form.hba1c} onChange={set('hba1c')} placeholder="Enter value" />
              <Inp label="WBC Count" required type="number" value={form.wbc_count} onChange={set('wbc_count')} placeholder="Enter value" />
              <Inp label="Total Bilirubin" type="number" value={form.total_bilirubin} onChange={set('total_bilirubin')} placeholder="Enter value" />
              <Inp label="Platelet Count" type="number" value={form.platelet_count} onChange={set('platelet_count')} placeholder="Enter value" />
              <Inp label="Sodium" type="number" value={form.sodium} onChange={set('sodium')} placeholder="Enter value" />
              <Inp label="Potassium" type="number" value={form.potassium} onChange={set('potassium')} placeholder="Enter value" />
              <Inp label="Troponin" type="number" value={form.troponin} onChange={set('troponin')} placeholder="Enter value" />
              <Inp label="BNP" type="number" value={form.bnp} onChange={set('bnp')} placeholder="Enter value" />
              <Inp label="Lactate" type="number" value={form.lactate} onChange={set('lactate')} placeholder="Enter value" />
              <Inp label="INR" type="number" value={form.inr} onChange={set('inr')} placeholder="Enter value" />
            </div>
          </section>

          {/* Section 3: Medications */}
          <section id="section-medications" className="cpf-section">
            <h2 className="cpf-section__title">3. Medications</h2>
            <div className="cpf-grid cpf-grid--3">
              <Inp label="Active Medication Count" type="number" value={form.active_medication_count} onChange={set('active_medication_count')} placeholder="0" />
              <Inp label="Medication Count at Discharge" type="number" value={form.medication_count_at_discharge} onChange={set('medication_count_at_discharge')} placeholder="Enter count" />
              <Inp label="Medication Adherence Rate (%)" type="number" value={form.medication_adherence_rate} onChange={set('medication_adherence_rate')} placeholder="Enter percentage" />
            </div>
            <div className="cpf-flags" style={{ marginTop: 12 }}>
              {[
                ['polypharmacy_flag', 'Polypharmacy'], ['high_risk_medication_flag', 'High Risk Medication'],
                ['on_anticoagulants_flag', 'On Anticoagulants'], ['on_insulin_flag', 'On Insulin'],
              ].map(([key, label]) => (
                <FlagCheck key={key} label={label} checked={form[key as keyof FormState] === 1} onChange={setFlag(key as keyof FormState)} />
              ))}
            </div>
          </section>

          {/* Section 4: Utilization History */}
          <section id="section-utilization" className="cpf-section">
            <h2 className="cpf-section__title">4. Utilization History</h2>
            <div className="cpf-grid cpf-grid--3">
              <Inp label="Previous Admissions (12m)" type="number" value={form.previous_admissions_12m} onChange={set('previous_admissions_12m')} placeholder="0" />
              <Inp label="Previous ER Visits (12m)" type="number" value={form.previous_er_visits_12m} onChange={set('previous_er_visits_12m')} placeholder="0" />
              <Sel label="Prior 30-Day Readmission" value={String(form.prior_30_day_readmission_flag)} onChange={(e) => setForm((p) => ({ ...p, prior_30_day_readmission_flag: Number(e.target.value) }))} options={['0', '1']} optionLabels={['No', 'Yes']} />
              <Inp label="Days Since Last ED Visit" type="number" value={form.days_since_last_ed_visit} onChange={set('days_since_last_ed_visit')} placeholder="Enter days" />
              <Inp label="ED Visits (90d)" type="number" value={form.ed_visits_90d} onChange={set('ed_visits_90d')} placeholder="Enter count" />
              <Inp label="ED Visits (30d)" type="number" value={form.ed_visits_30d} onChange={set('ed_visits_30d')} placeholder="Enter count" />
              <Inp label="Outpatient Visits (365d)" type="number" value={form.outpatient_visits_365d} onChange={set('outpatient_visits_365d')} placeholder="Enter count" />
              <Inp label="Days Since Last PCP Visit" type="number" value={form.days_since_last_pcp_visit} onChange={set('days_since_last_pcp_visit')} placeholder="Enter days" />
              <Inp label="Missed Appointments (6m)" type="number" value={form.missed_appointments_6m} onChange={set('missed_appointments_6m')} placeholder="Enter count" />
            </div>
          </section>

          {/* Section 5: Admission & Follow-up */}
          <section id="section-admission" className="cpf-section">
            <h2 className="cpf-section__title">5. Admission & Follow-up</h2>
            <div className="cpf-grid cpf-grid--4">
              <Inp label="Admission Date" type="date" value={form.admission_date} onChange={set('admission_date')} />
              <Sel label="Admission Type" value={form.admission_type} onChange={set('admission_type')} options={ADM_TYPE_OPTS} />
              <Inp label="Length of Stay (Days)" type="number" value={form.length_of_stay_days} onChange={set('length_of_stay_days')} placeholder="Enter days" />
              <Sel label="ICU Stay" value={String(form.icu_stay_flag)} onChange={(e) => setForm((p) => ({ ...p, icu_stay_flag: Number(e.target.value) }))} options={['0', '1']} optionLabels={['No', 'Yes']} />
              <Inp label="Discharge Date" type="date" value={form.discharge_date} onChange={set('discharge_date')} />
              <Sel label="Discharge Destination" value={form.discharge_destination} onChange={set('discharge_destination')} options={DISC_DEST_OPTS} />
              <Sel label="Follow-up Within 7 Days" value={String(form.follow_up_within_7_days_flag)} onChange={(e) => setForm((p) => ({ ...p, follow_up_within_7_days_flag: Number(e.target.value) }))} options={['0', '1']} optionLabels={['No', 'Yes']} />
              <Inp label="Follow-up Appointment Date" type="date" value={form.follow_up_appointment_date} onChange={set('follow_up_appointment_date')} />
            </div>
          </section>

          {/* Section 6: Clinical Notes */}
          <section id="section-notes" className="cpf-section">
            <h2 className="cpf-section__title">6. Clinical Notes</h2>
            <label className="cpf-field">
              <span className="cpf-field__label">Clinical Notes (Optional)</span>
              <textarea
                className="cpf-textarea"
                rows={5}
                value={form.clinical_notes}
                onChange={set('clinical_notes')}
                placeholder="Enter any additional clinical notes or important information about this patient..."
              />
              <span className="cpf-field__hint">{form.clinical_notes.length} / 1000</span>
            </label>
          </section>

          {/* Footer actions */}
          <div className="cpf-footer">
            <button className="cp-btn cp-btn--ghost" onClick={() => navigate('/care-manager/patients')}>Back</button>
            <button className="cp-btn cp-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="cp-btn__spinner" /> Saving…</> : 'Save Patient →'}
            </button>
          </div>
        </div>
      </div>
    </CareManagerLayout>
  );
}

/* ── Reusable form components ── */

function Inp({ label, required, type = 'text', value, onChange, placeholder }: {
  label: string; required?: boolean; type?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string;
}) {
  return (
    <label className="cpf-field">
      <span className="cpf-field__label">{label}{required && <span className="cpf-field__req"> *</span>}</span>
      <input className="cpf-input" type={type} value={value} onChange={onChange} placeholder={placeholder} step={type === 'number' ? 'any' : undefined} />
    </label>
  );
}

function Sel({ label, required, value, onChange, options, optionLabels }: {
  label: string; required?: boolean;
  value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[]; optionLabels?: string[];
}) {
  return (
    <label className="cpf-field">
      <span className="cpf-field__label">{label}{required && <span className="cpf-field__req"> *</span>}</span>
      <select className="cpf-input cpf-select" value={value} onChange={onChange}>
        <option value="">— Select —</option>
        {options.map((o, i) => <option key={o} value={o}>{optionLabels ? optionLabels[i] : o.replace(/_/g, ' ')}</option>)}
      </select>
    </label>
  );
}

function FlagCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`cpf-flag${checked ? ' cpf-flag--on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="cpf-flag__box">{checked && '✓'}</span>
      {label}
    </label>
  );
}
