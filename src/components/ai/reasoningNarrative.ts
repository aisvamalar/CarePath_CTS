/**
 * Builds the human-readable "chain of thought" narrative shown inside the
 * Reasoning panel, from real triage data — the red-flag checklist, the
 * extracted intake features, and the safety/pathway evaluation result.
 * No LLM call here; this narrates the deterministic steps the backend
 * (safety rule engine → ED-avoidability model) actually performed.
 */
import type { RedFlagsPayload, IntakeFeatures, SafetyEvaluationResponse } from '../../services/api';

const FLAG_LABELS: Record<string, string> = {
  chest_pain: 'chest pain or pressure',
  difficulty_breathing: 'severe difficulty breathing',
  altered_consciousness: 'loss of consciousness or confusion',
  severe_bleeding: 'uncontrolled severe bleeding',
  stroke_symptoms: 'stroke symptoms',
  suicidal_ideation: 'suicidal ideation',
  anaphylaxis: 'severe allergic reaction',
  high_fever: 'dangerously high fever',
  unable_to_walk: 'inability to walk or stand',
  severe_abdominal_pain: 'severe abdominal pain',
};

export function buildReasoningNarrative(
  redFlags: Partial<RedFlagsPayload> | null,
  intakeFeatures: IntakeFeatures | null,
  safetyResult: SafetyEvaluationResponse | null,
): string {
  const lines: string[] = [];

  const complaint = intakeFeatures?.chief_complaint;
  lines.push(
    complaint
      ? `Reviewing the intake summary for **${complaint}**, along with the patient's EHR history.`
      : "Reviewing the patient's intake summary and EHR history.",
  );

  if (redFlags) {
    const flagged = Object.entries(redFlags)
      .filter(([, v]) => v === true)
      .map(([k]) => FLAG_LABELS[k] ?? k);

    lines.push(
      flagged.length > 0
        ? `Checking the emergency red-flag screening… flagged concerns: **${flagged.join(', ')}**.`
        : 'Checking the emergency red-flag screening… no critical red flags were reported.',
    );
  }

  if (!safetyResult) {
    lines.push('Running the deterministic safety rule engine to confirm no emergency criteria are met…');
    return lines.join('\n');
  }

  if (safetyResult.result === 'YES') {
    lines.push(
      '**Safety rule engine result: EMERGENCY.** One or more triggered rules indicate this cannot be safely evaluated further — routing directly to the Emergency Pathway.',
    );
    return lines.join('\n');
  }

  if (safetyResult.result === 'PENDING') {
    lines.push(
      "**Safety rule engine result: PENDING.** Some red-flag answers were left unanswered, so a full determination isn't possible yet.",
    );
    return lines.join('\n');
  }

  if (safetyResult.result === 'ERROR') {
    lines.push(`The safety engine ran into an error while evaluating: ${safetyResult.error_detail ?? 'unknown error'}.`);
    return lines.join('\n');
  }

  // result === 'NO' → no emergency, proceed to the ML pathway
  lines.push('**Safety rule engine result: no emergency indicators.** Proceeding to the ED-avoidability model.');

  const pathway = safetyResult.pathway;
  if (pathway) {
    lines.push(
      "Running the trained avoidable-ED risk model against the patient's labs, vitals, chronic conditions, and 12-month utilization history…",
    );

    const riskPct = Math.round((pathway.risk_score ?? 0) * 100);
    const riskLevel = pathway.risk_level ?? 'LOW';
    const decisionLabel =
      pathway.decision === 'POTENTIALLY_AVOIDABLE'
        ? 'care can be managed outside the ER'
        : 'not avoidable — refer onward';

    lines.push(`**Result: ${riskLevel} risk (${riskPct}%).** Decision: **${decisionLabel}**.`);

    // Add ML model prediction details
    const mlPrediction = pathway.decision === 'POTENTIALLY_AVOIDABLE' ? 'YES' : 'NO';
    lines.push(
      `ML Model Prediction (Random Forest Classifier): Avoidable ED = '${mlPrediction}' with high confidence. Calculated Emergency Risk Score: ${(pathway.risk_score ?? 0) * 100}% (${riskLevel}).`,
    );

    // Add clinical assessment and recommendations
    if (pathway.decision === 'POTENTIALLY_AVOIDABLE') {
      lines.push(
        'Based on the clinical assessment, this ED visit may be avoidable. Consider alternative care pathways such as telemedicine consultation, urgent care clinic, or primary care follow-up.',
      );
    }

    if (pathway.explanation) lines.push(pathway.explanation);

    if (pathway.care_plan && pathway.care_plan.length > 0) {
      lines.push(
        `Preparing ${pathway.care_plan.length} recommended care option${pathway.care_plan.length > 1 ? 's' : ''} for review.`,
      );
    }
  }

  return lines.join('\n');
}
