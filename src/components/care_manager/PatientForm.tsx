/**
 * CarePath — Patient record form (create + update).
 * Field groups mirror the backend PatientEHRCreate / PatientEHRUpdate schemas.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type {
  PatientCreatePayload, PatientDetail, Gender, InsuranceType,
} from '../../services/ehrService';

export interface PatientFormValues {
  name: string;
  date_of_birth: string;
  age: string;
  gender: Gender;
  bmi: string;
  insurance_type: InsuranceType;
  race: string;

  hemoglobin: string;
  creatinine: string;
  glucose: string;
  wbc_count: string;

  previous_admissions_12m: string;
  previous_er_visits_12m: string;

  diabetes_flag: boolean;
  heart_failure_flag: boolean;
  copd_asthma_flag: boolean;
  ckd_flag: boolean;
  hypertension_flag: boolean;
  cancer_flag: boolean;

  active_medication_count: string;
  contact_number: string;
  email: string;
  address: string;
  clinical_notes: string;
}

const EMPTY: PatientFormValues = {
  name: '', date_of_birth: '', age: '', gender: 'other', bmi: '24',
  insurance_type: 'Private', race: '',
  hemoglobin: '14', creatinine: '0.9', glucose: '95', wbc_count: '7.5',
  previous_admissions_12m: '0', previous_er_visits_12m: '0',
  diabetes_flag: false, heart_failure_flag: false, copd_asthma_flag: false,
  ckd_flag: false, hypertension_flag: false, cancer_flag: false,
  active_medication_count: '0',
  contact_number: '', email: '', address: '', clinical_notes: '',
};

const INSURANCE: InsuranceType[] = ['Private', 'Medicare', 'Medicaid', 'Self-pay', 'Medicare_Advantage', 'Uninsured'];

export function fromPatient(p: PatientDetail): PatientFormValues {
  return {
    name: p.name ?? '',
    date_of_birth: p.date_of_birth ?? '',
    age: String(p.age ?? ''),
    gender: (p.gender as Gender) ?? 'other',
    bmi: String(p.bmi ?? ''),
    insurance_type: (p.insurance_type as InsuranceType) ?? 'Private',
    race: p.race ?? '',
    hemoglobin: String(p.hemoglobin ?? ''),
    creatinine: String(p.creatinine ?? ''),
    glucose: String(p.glucose ?? ''),
    wbc_count: String(p.wbc_count ?? ''),
    previous_admissions_12m: String(p.previous_admissions_12m ?? 0),
    previous_er_visits_12m: String(p.previous_er_visits_12m ?? 0),
    diabetes_flag: Boolean(p.diabetes_flag),
    heart_failure_flag: Boolean(p.heart_failure_flag),
    copd_asthma_flag: Boolean(p.copd_asthma_flag),
    ckd_flag: Boolean(p.ckd_flag),
    hypertension_flag: Boolean(p.hypertension_flag),
    cancer_flag: Boolean(p.cancer_flag),
    active_medication_count: String(p.active_medication_count ?? 0),
    contact_number: p.contact_number ?? '',
    email: p.email ?? '',
    address: p.address ?? '',
    clinical_notes: p.clinical_notes ?? '',
  };
}

export function toPayload(v: PatientFormValues): PatientCreatePayload {
  const flag = (b: boolean) => (b ? 1 : 0);
  return {
    demographics: {
      name: v.name.trim(),
      date_of_birth: v.date_of_birth,
      age: Number(v.age),
      gender: v.gender,
      bmi: Number(v.bmi),
      insurance_type: v.insurance_type,
      race: v.race.trim() || null,
    },
    chronic_conditions: {
      diabetes_flag: flag(v.diabetes_flag),
      heart_failure_flag: flag(v.heart_failure_flag),
      cardiac_history_flag: 0,
      copd_asthma_flag: flag(v.copd_asthma_flag),
      ckd_flag: flag(v.ckd_flag),
      cancer_flag: flag(v.cancer_flag),
      dementia_flag: 0,
      hypertension_flag: flag(v.hypertension_flag),
      immunocompromised_flag: 0,
      charlson_comorbidity_index: 0,
    },
    lab_values: {
      hemoglobin: Number(v.hemoglobin),
      creatinine: Number(v.creatinine),
      glucose: Number(v.glucose),
      wbc_count: Number(v.wbc_count),
    },
    medications: {
      active_medication_count: Number(v.active_medication_count) || 0,
    },
    utilization_history: {
      previous_admissions_12m: Number(v.previous_admissions_12m) || 0,
      previous_er_visits_12m: Number(v.previous_er_visits_12m) || 0,
    },
    clinical_notes: v.clinical_notes.trim() || null,
    contact_number: v.contact_number.trim() || null,
    email: v.email.trim() || null,
    address: v.address.trim() || null,
  };
}

export function validate(v: PatientFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = 'Full name is required';
  if (!v.date_of_birth) e.date_of_birth = 'Date of birth is required';
  const age = Number(v.age);
  if (!v.age) e.age = 'Age is required';
  else if (Number.isNaN(age) || age < 0 || age > 120) e.age = 'Age must be between 0 and 120';
  const bmi = Number(v.bmi);
  if (!v.bmi) e.bmi = 'BMI is required';
  else if (Number.isNaN(bmi) || bmi < 10 || bmi > 80) e.bmi = 'BMI must be between 10 and 80';

  const num = (key: keyof PatientFormValues, label: string) => {
    const raw = v[key] as string;
    if (raw === '') e[key as string] = `${label} is required`;
    else if (Number.isNaN(Number(raw))) e[key as string] = `${label} must be a number`;
  };
  num('hemoglobin', 'Hemoglobin');
  num('creatinine', 'Creatinine');
  num('glucose', 'Glucose');
  num('wbc_count', 'WBC count');

  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) {
    e.email = 'Enter a valid email address';
  }
  return e;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PatientForm({
  initial,
  errors,
  onChange,
}: {
  initial?: PatientFormValues;
  errors: Record<string, string>;
  onChange: (v: PatientFormValues) => void;
}) {
  const [values, setValues] = useState<PatientFormValues>(initial ?? EMPTY);

  useEffect(() => { onChange(values); }, [values, onChange]);

  const set = <K extends keyof PatientFormValues>(key: K, val: PatientFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  /** Keep age in sync when a date of birth is chosen. */
  const onDob = (dob: string) => {
    setValues((prev) => {
      if (!dob) return { ...prev, date_of_birth: dob };
      const d = new Date(dob);
      if (Number.isNaN(d.getTime())) return { ...prev, date_of_birth: dob };
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
      return { ...prev, date_of_birth: dob, age: a >= 0 && a <= 120 ? String(a) : prev.age };
    });
  };

  const conditions = useMemo(() => ([
    { key: 'diabetes_flag' as const, label: 'Diabetes' },
    { key: 'heart_failure_flag' as const, label: 'Heart failure' },
    { key: 'copd_asthma_flag' as const, label: 'COPD / Asthma' },
    { key: 'ckd_flag' as const, label: 'Chronic kidney disease' },
    { key: 'hypertension_flag' as const, label: 'Hypertension' },
    { key: 'cancer_flag' as const, label: 'Cancer' },
  ]), []);

  return (
    <div className="pf">
      <p className="pf__note">MRN and Patient ID are generated by the backend.</p>

      <fieldset className="pf__group">
        <legend className="pf__legend">Demographics</legend>
        <div className="pf__grid">
          <Field label="Full name" required error={errors.name} className="pf__span2">
            <input className="pf__input" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Eleanor Pena" />
          </Field>
          <Field label="Date of birth" required error={errors.date_of_birth}>
            <input className="pf__input" type="date" value={values.date_of_birth} onChange={(e) => onDob(e.target.value)} />
          </Field>
          <Field label="Age" required error={errors.age}>
            <input className="pf__input" type="number" min={0} max={120} value={values.age} onChange={(e) => set('age', e.target.value)} />
          </Field>
          <Field label="Gender" required>
            <select className="pf__input" value={values.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="BMI" required error={errors.bmi}>
            <input className="pf__input" type="number" step="0.1" min={10} max={80} value={values.bmi} onChange={(e) => set('bmi', e.target.value)} />
          </Field>
          <Field label="Insurance" required>
            <select className="pf__input" value={values.insurance_type} onChange={(e) => set('insurance_type', e.target.value as InsuranceType)}>
              {INSURANCE.map((i) => <option key={i} value={i}>{i.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Race / ethnicity">
            <input className="pf__input" value={values.race} onChange={(e) => set('race', e.target.value)} placeholder="Optional" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="pf__group">
        <legend className="pf__legend">Lab values</legend>
        <div className="pf__grid">
          <Field label="Hemoglobin (g/dL)" required error={errors.hemoglobin}>
            <input className="pf__input" type="number" step="0.1" value={values.hemoglobin} onChange={(e) => set('hemoglobin', e.target.value)} />
          </Field>
          <Field label="Creatinine (mg/dL)" required error={errors.creatinine}>
            <input className="pf__input" type="number" step="0.01" value={values.creatinine} onChange={(e) => set('creatinine', e.target.value)} />
          </Field>
          <Field label="Glucose (mg/dL)" required error={errors.glucose}>
            <input className="pf__input" type="number" value={values.glucose} onChange={(e) => set('glucose', e.target.value)} />
          </Field>
          <Field label="WBC count" required error={errors.wbc_count}>
            <input className="pf__input" type="number" step="0.1" value={values.wbc_count} onChange={(e) => set('wbc_count', e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="pf__group">
        <legend className="pf__legend">Utilisation history</legend>
        <div className="pf__grid">
          <Field label="Admissions (12 months)" required>
            <input className="pf__input" type="number" min={0} value={values.previous_admissions_12m} onChange={(e) => set('previous_admissions_12m', e.target.value)} />
          </Field>
          <Field label="ER visits (12 months)" required>
            <input className="pf__input" type="number" min={0} value={values.previous_er_visits_12m} onChange={(e) => set('previous_er_visits_12m', e.target.value)} />
          </Field>
          <Field label="Active medications">
            <input className="pf__input" type="number" min={0} value={values.active_medication_count} onChange={(e) => set('active_medication_count', e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="pf__group">
        <legend className="pf__legend">Chronic conditions</legend>
        <div className="pf__checks">
          {conditions.map((c) => (
            <label key={c.key} className={`pf__check${values[c.key] ? ' pf__check--on' : ''}`}>
              <input type="checkbox" checked={values[c.key]} onChange={(e) => set(c.key, e.target.checked)} />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="pf__group">
        <legend className="pf__legend">Contact &amp; notes</legend>
        <div className="pf__grid">
          <Field label="Contact number">
            <input className="pf__input" value={values.contact_number} onChange={(e) => set('contact_number', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className="pf__input" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Address" className="pf__span2">
            <input className="pf__input" value={values.address} onChange={(e) => set('address', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Clinical notes" className="pf__span2">
            <textarea className="pf__input pf__textarea" rows={3} value={values.clinical_notes} onChange={(e) => set('clinical_notes', e.target.value)} placeholder="Optional" />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}

function Field({
  label, required, error, children, className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`pf__field${className ? ` ${className}` : ''}`}>
      <span className="pf__label">
        {label}{required && <span className="pf__req" aria-hidden="true"> *</span>}
      </span>
      {children}
      {error && <span className="pf__err">{error}</span>}
    </label>
  );
}

export { EMPTY as emptyPatientForm };
