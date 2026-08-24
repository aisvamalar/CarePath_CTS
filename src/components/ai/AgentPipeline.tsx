/**
 * CarePath — Agent Workflow Pipeline Visualization
 *
 * Lightweight SVG-only pipeline showing the agent workflow stages:
 *   Intake → Safety Check → Risk Model → Care Plan
 *
 * Features:
 * - Animated dot travels along the active edge (like ReactFlow's Animated edge)
 * - Dashed "pending" edges for incomplete stages (like ReactFlow's Temporary edge)
 * - Solid completed edges with smooth bezier curves
 * - No external dependencies (pure SVG + React state)
 *
 * Renders inline in the chat, between the checklist submission and the verdict.
 */
import { memo } from 'react';

export type PipelineStage = 'intake' | 'safety' | 'risk_model' | 'care_plan';

interface AgentPipelineProps {
  /** Which stage is currently running (dot animates on its incoming edge). */
  activeStage: PipelineStage;
  /** Which stages are done. */
  completedStages: PipelineStage[];
  className?: string;
}

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'intake', label: 'Intake' },
  { id: 'safety', label: 'Safety Check' },
  { id: 'risk_model', label: 'Risk Model' },
  { id: 'care_plan', label: 'Care Plan' },
];

// Layout constants
const NODE_W = 130;
const NODE_H = 40;
const GAP = 60; // horizontal gap between nodes
const SVG_W = STAGES.length * NODE_W + (STAGES.length - 1) * GAP + 40; // + padding
const SVG_H = 80;
const START_X = 20;
const NODE_Y = (SVG_H - NODE_H) / 2;

function nodeX(index: number): number {
  return START_X + index * (NODE_W + GAP);
}

export const AgentPipeline = memo(({ activeStage, completedStages, className = '' }: AgentPipelineProps) => {
  const activeIdx = STAGES.findIndex((s) => s.id === activeStage);

  return (
    <div className={`ai-pipeline ${className}`}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height="auto"
        style={{ maxWidth: SVG_W, display: 'block', margin: '0 auto' }}
        aria-label="Agent workflow pipeline"
        role="img"
      >
        {/* Edges (between nodes) */}
        {STAGES.slice(0, -1).map((stage, i) => {
          const fromX = nodeX(i) + NODE_W;
          const toX = nodeX(i + 1);
          const y = SVG_H / 2;

          const nextStage = STAGES[i + 1];
          const isCompleted = completedStages.includes(nextStage.id);
          const isActive = nextStage.id === activeStage;

          // Bezier control points (subtle curve)
          const midX = (fromX + toX) / 2;
          const path = `M ${fromX} ${y} C ${midX} ${y - 8}, ${midX} ${y + 8}, ${toX} ${y}`;

          return (
            <g key={`edge-${stage.id}-${nextStage.id}`}>
              {/* Edge line */}
              <path
                d={path}
                fill="none"
                stroke={isCompleted ? 'var(--cp-coral)' : '#d1d5db'}
                strokeWidth={isCompleted ? 2 : 1.5}
                strokeDasharray={isCompleted || isActive ? 'none' : '5,5'}
                strokeLinecap="round"
              />

              {/* Animated dot on active edge */}
              {isActive && (
                <circle fill="var(--cp-coral)" r="4">
                  <animateMotion dur="2s" path={path} repeatCount="indefinite" />
                </circle>
              )}

              {/* Handle dots at edge endpoints */}
              <circle cx={fromX} cy={y} r="3.5" fill={isCompleted || isActive ? 'var(--cp-charcoal)' : '#9ca3af'} />
              <circle cx={toX} cy={y} r="3.5" fill={isCompleted ? 'var(--cp-charcoal)' : '#9ca3af'} />
            </g>
          );
        })}

        {/* Nodes */}
        {STAGES.map((stage, i) => {
          const x = nodeX(i);
          const isCompleted = completedStages.includes(stage.id);
          const isActive = stage.id === activeStage;

          // Determine status label
          let statusLabel = 'Pending';
          let statusColor = '#9ca3af';
          if (isCompleted) {
            statusLabel = 'Completed';
            statusColor = '#10b981'; // green
          } else if (isActive) {
            statusLabel = 'In Progress';
            statusColor = 'var(--cp-coral)';
          }

          return (
            <g key={stage.id}>
              {/* Node box */}
              <rect
                x={x}
                y={NODE_Y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill={isCompleted ? 'rgba(242,132,107,0.06)' : 'white'}
                stroke={
                  isActive ? 'var(--cp-coral)' : isCompleted ? 'var(--cp-coral)' : '#e5e7eb'
                }
                strokeWidth={isActive ? 2 : 1.2}
              />

              {/* Completed checkmark */}
              {isCompleted && (
                <circle cx={x + 16} cy={SVG_H / 2} r={6} fill="var(--cp-coral)">
                  {/* simple dot indicator */}
                </circle>
              )}

              {/* Active pulse ring */}
              {isActive && (
                <circle
                  cx={x + 16}
                  cy={SVG_H / 2}
                  r={6}
                  fill="none"
                  stroke="var(--cp-coral)"
                  strokeWidth="2"
                  opacity="0.6"
                >
                  <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Pending/inactive dot */}
              {!isCompleted && !isActive && (
                <circle cx={x + 16} cy={SVG_H / 2} r={4} fill="#d1d5db" />
              )}

              {/* Stage name label */}
              <text
                x={x + NODE_W / 2 + 6}
                y={SVG_H / 2 - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isActive ? 'var(--cp-coral-dark)' : isCompleted ? 'var(--cp-charcoal)' : '#6b7280'}
                fontSize="11"
                fontWeight={isActive ? '700' : '500'}
                fontFamily="var(--font-sans)"
              >
                {stage.label}
              </text>

              {/* Status label below stage name */}
              <text
                x={x + NODE_W / 2 + 6}
                y={SVG_H / 2 + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={statusColor}
                fontSize="9"
                fontWeight="500"
                fontFamily="var(--font-sans)"
              >
                {statusLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

AgentPipeline.displayName = 'AgentPipeline';

export default AgentPipeline;
