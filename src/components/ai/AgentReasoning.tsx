/**
 * CarePath — Agent Reasoning Trace
 *
 * Drop-in panel shown between the safety checklist submission and the
 * verdict card. While `isStreaming` is true it shows a shimmering
 * "Analyzing…" label; once the safety evaluation resolves it collapses
 * automatically and becomes a "Thought for N seconds" summary the patient
 * can expand to see what the agent workflow checked.
 *
 * Now also includes a visual SVG pipeline showing which agent stages
 * (Intake → Safety Check → Risk Model → Care Plan) are complete/active.
 */
import type { RedFlagsPayload, IntakeFeatures, SafetyEvaluationResponse } from '../../services/api';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './Reasoning';
import { buildReasoningNarrative } from './reasoningNarrative';
import AgentPipeline, { type PipelineStage } from './AgentPipeline';

interface AgentReasoningProps {
  isStreaming: boolean;
  redFlags: Partial<RedFlagsPayload> | null;
  intakeFeatures: IntakeFeatures | null;
  safetyResult: SafetyEvaluationResponse | null;
  /** Actual elapsed seconds captured by the caller, so the collapsed
   *  summary reads "Thought for N seconds" instead of a vague fallback. */
  duration?: number;
}

export default function AgentReasoning({ isStreaming, redFlags, intakeFeatures, safetyResult, duration }: AgentReasoningProps) {
  const narrative = buildReasoningNarrative(redFlags, intakeFeatures, safetyResult);

  // Determine pipeline state
  const completedStages: PipelineStage[] = ['intake']; // intake always done by this point
  let activeStage: PipelineStage = 'safety';
  let progressMessage = '';

  if (redFlags) completedStages.push('safety');
  if (safetyResult && safetyResult.result !== 'PENDING') {
    completedStages.push('safety');
    if (safetyResult.pathway) {
      completedStages.push('risk_model');
      if (safetyResult.pathway.care_plan && safetyResult.pathway.care_plan.length > 0) {
        completedStages.push('care_plan');
        activeStage = 'care_plan';
        progressMessage = 'Finalizing care recommendations...';
      } else {
        activeStage = 'care_plan';
        progressMessage = 'Discovering nearby providers...';
      }
    } else {
      activeStage = 'risk_model';
      progressMessage = 'Running ML risk model...';
    }
  } else if (redFlags) {
    activeStage = 'risk_model';
    progressMessage = 'Analyzing risk factors...';
  } else {
    progressMessage = 'Checking safety rules...';
  }

  // When streaming (still running), show the active stage as the last non-completed one
  if (isStreaming && !safetyResult) {
    activeStage = redFlags ? 'risk_model' : 'safety';
    progressMessage = redFlags ? 'Running ML risk model...' : 'Checking safety rules...';
  }

  return (
    <div className="ai-reasoning-wrapper">
      {/* Visual pipeline tracker */}
      <AgentPipeline
        activeStage={activeStage}
        completedStages={[...new Set(completedStages)]}
      />

      {/* Progress message below pipeline */}
      {isStreaming && progressMessage && (
        <div style={{
          textAlign: 'center',
          padding: '8px 0',
          fontSize: '0.875rem',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="15 25" strokeLinecap="round" />
          </svg>
          <span>{progressMessage}</span>
        </div>
      )}

      {/* Collapsible reasoning text */}
      <Reasoning isStreaming={isStreaming} duration={duration} defaultOpen>
        <ReasoningTrigger />
        <ReasoningContent>{narrative}</ReasoningContent>
      </Reasoning>
    </div>
  );
}
