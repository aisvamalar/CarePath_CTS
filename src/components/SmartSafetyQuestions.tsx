import React, { useState, useEffect } from 'react';
import { safetyAPI } from '../services/api';
import type { RedFlagsPayload } from '../services/api';

interface RelevantRedFlag {
  field: keyof RedFlagsPayload;
  question: string;
  relevance_reason: string;
  priority: 'critical' | 'high' | 'medium';
}

interface SmartFilterResult {
  relevant_flags: RelevantRedFlag[];
  total_relevant: number;
  skipped_count: number;
  reasoning: string;
}

interface SmartSafetyQuestionsProps {
  sessionId: string;
  chiefComplaint: string;
  extractedFeatures: Record<string, any>;
  onSubmit: (flags: RedFlagsPayload) => void;
  loading: boolean;
}

export default function SmartSafetyQuestions({
  sessionId,
  chiefComplaint,
  extractedFeatures,
  onSubmit,
  loading,
}: SmartSafetyQuestionsProps) {
  const [relevantFlags, setRelevantFlags] = useState<RelevantRedFlag[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [filterLoading, setFilterLoading] = useState(true);
  const [filterError, setFilterError] = useState('');
  const [reasoning, setReasoning] = useState('');

  useEffect(() => {
    async function fetchSmartFilter() {
      setFilterLoading(true);
      setFilterError('');
      
      console.log('[SmartSafety] Fetching filter for:', { sessionId, chiefComplaint, extractedFeatures });
      
      try {
        const result: SmartFilterResult = await safetyAPI.smartFilter(
          sessionId,
          chiefComplaint,
          extractedFeatures || {}
        );
        
        console.log('[SmartSafety] Got filtered flags:', result);
        
        setRelevantFlags(result.relevant_flags);
        setReasoning(result.reasoning);

        // Initialize answers
        const initialAnswers: Record<string, boolean> = {};
        result.relevant_flags.forEach((flag) => {
          initialAnswers[flag.field] = false;
        });
        setAnswers(initialAnswers);
      } catch (error) {
        console.error('[SmartSafety] Filter error:', error);
        
        // Better error messages
        let errorMessage = 'Failed to load safety questions. Please try again.';
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response?.status === 401) {
            errorMessage = 'Your session has expired. Please log in again.';
          } else if (axiosError.response?.status === 404) {
            errorMessage = 'Safety assessment not found. Please start a new assessment.';
          } else if (axiosError.response?.data?.detail) {
            errorMessage = axiosError.response.data.detail;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        setFilterError(errorMessage);
      } finally {
        setFilterLoading(false);
      }
    }

    fetchSmartFilter();
  }, [sessionId, chiefComplaint, extractedFeatures]);

  const setAnswer = (field: string, value: boolean) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build complete RedFlagsPayload
    // Set all non-asked questions to false (not present = not concerning)
    const fullPayload: RedFlagsPayload = {
      chest_pain: answers.chest_pain ?? false,
      difficulty_breathing: answers.difficulty_breathing ?? false,
      altered_consciousness: answers.altered_consciousness ?? false,
      severe_bleeding: answers.severe_bleeding ?? false,
      stroke_symptoms: answers.stroke_symptoms ?? false,
      suicidal_ideation: answers.suicidal_ideation ?? false,
      anaphylaxis: answers.anaphylaxis ?? false,
      high_fever: answers.high_fever ?? false,
      unable_to_walk: answers.unable_to_walk ?? false,
      severe_abdominal_pain: answers.severe_abdominal_pain ?? false,
    };

    onSubmit(fullPayload);
  };

  if (filterLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Analyzing your symptoms...</p>
        <p style={{ ...styles.loadingText, fontSize: '0.8125rem', marginTop: '-8px', color: '#9ca3af' }}>
          Using AI to determine which safety questions are most relevant
        </p>
      </div>
    );
  }

  // Show error state - don't fall back, show the error
  if (filterError) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <h3 style={styles.errorTitle}>Unable to Load Safety Questions</h3>
        <p style={styles.errorText}>{filterError}</p>
        <button style={styles.retryBtn} onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (relevantFlags.length === 0) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>🤔</div>
        <h3 style={styles.errorTitle}>No Safety Questions Available</h3>
        <p style={styles.errorText}>Unable to determine relevant safety questions for your symptoms.</p>
      </div>
    );
  }

  const yesCount = Object.values(answers).filter(Boolean).length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon} aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" fill="#FFF5F5" stroke="#D92D20" strokeWidth="1.5"/>
            <path d="M16 9v8" stroke="#D92D20" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="21.5" r="1.5" fill="#D92D20"/>
          </svg>
        </div>
        <div>
          <h2 style={styles.title}>Quick Safety Check</h2>
          <p style={styles.subtitle}>
            Based on your {chiefComplaint}, I need to ask you {relevantFlags.length} important question{relevantFlags.length !== 1 ? 's' : ''}:
          </p>
        </div>
      </div>

      {/* AI Reasoning */}
      {reasoning && (
        <div style={styles.reasoningBox}>
          <span style={styles.aiIcon}>🤖</span>
          <p style={styles.reasoningText}>{reasoning}</p>
        </div>
      )}

      {/* Progress */}
      <div style={styles.progressWrap}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(yesCount / relevantFlags.length) * 100}%`,
            }}
          />
        </div>
        <span style={styles.progressLabel}>
          {yesCount} concern{yesCount !== 1 ? 's' : ''} noted
        </span>
      </div>

      <form onSubmit={handleSubmit} aria-label="Smart safety screening form">
        <div style={styles.questions}>
          {relevantFlags.map((item, index) => (
            <div
              key={item.field}
              style={{
                ...styles.questionCard,
                ...(answers[item.field] ? styles.questionCardYes : {}),
              }}
            >
              <div style={styles.questionTop}>
                <span style={styles.questionNum} aria-hidden="true">
                  {index + 1}
                </span>
                <span 
                  style={{
                    ...styles.priorityBadge,
                    ...(item.priority === 'critical' ? styles.priorityCritical : 
                        item.priority === 'high' ? styles.priorityHigh : 
                        styles.priorityMedium)
                  }}
                >
                  {item.priority}
                </span>
                <p style={styles.questionText}>{item.question}</p>
              </div>
              
              {/* Relevance hint */}
              <p style={styles.relevanceHint}>
                <span style={styles.hintIcon}>ℹ️</span>
                {item.relevance_reason}
              </p>

              <div
                style={styles.buttonGroup}
                role="group"
                aria-label={`Answer for question ${index + 1}`}
              >
                <button
                  type="button"
                  style={{
                    ...styles.answerBtn,
                    ...(answers[item.field] === false ? styles.answerBtnNoSelected : styles.answerBtnUnselected),
                  }}
                  onClick={() => setAnswer(item.field, false)}
                  aria-pressed={answers[item.field] === false}
                  disabled={loading}
                >
                  <span style={styles.answerIcon}>✗</span>
                  No
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.answerBtn,
                    ...(answers[item.field] === true ? styles.answerBtnYesSelected : styles.answerBtnUnselected),
                  }}
                  onClick={() => setAnswer(item.field, true)}
                  aria-pressed={answers[item.field] === true}
                  disabled={loading}
                >
                  <span style={styles.answerIcon}>✓</span>
                  Yes
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.submitRow}>
          <p style={styles.submitNote}>
            {relevantFlags.length} targeted questions • {10 - relevantFlags.length} skipped as not relevant
          </p>
          <button
            type="submit"
            className="btn-primary"
            style={styles.submitBtn}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span style={styles.loadingDots}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ ...styles.loadingDot, animationDelay: `${i * 0.18}s` }} />
                  ))}
                </span>
                Evaluating…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8l3 3 7-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Submit Answers
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '3px solid rgba(242,132,107,0.3)',
    borderTopColor: '#e06a4f',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.9375rem',
    color: '#6b7c84',
    textAlign: 'center',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  errorIcon: {
    fontSize: '3rem',
  },
  errorTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#172b35',
    margin: 0,
    textAlign: 'center',
  },
  errorText: {
    fontSize: '0.9375rem',
    color: '#6b7c84',
    textAlign: 'center',
    margin: 0,
  },
  retryBtn: {
    marginTop: '12px',
    padding: '10px 24px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#e06a4f',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  container: {
    width: '100%',
    maxWidth: '700px',
    margin: '0 auto',
    padding: '0 16px 32px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '24px 0 16px',
    borderBottom: '1px solid #e3e8ea',
    marginBottom: '20px',
  },
  headerIcon: {
    flexShrink: 0,
    marginTop: '2px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#172b35',
    marginBottom: '6px',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#6b7c84',
    lineHeight: 1.55,
  },
  reasoningBox: {
    display: 'flex',
    gap: '12px',
    padding: '14px 16px',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  aiIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  reasoningText: {
    fontSize: '0.875rem',
    color: '#0c4a6e',
    lineHeight: 1.5,
    margin: 0,
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  progressBar: {
    flex: 1,
    height: '4px',
    backgroundColor: '#e3e8ea',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d92d20',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: '0.8125rem',
    color: '#6b7c84',
    flexShrink: 0,
  },
  questions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  questionCard: {
    padding: '16px 18px',
    backgroundColor: '#f8fafb',
    border: '1.5px solid #e3e8ea',
    borderRadius: '14px',
    transition: 'all 0.2s ease',
  },
  questionCardYes: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  questionTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '10px',
  },
  questionNum: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6b7c84',
    backgroundColor: '#e3e8ea',
    borderRadius: '6px',
    padding: '3px 8px',
    flexShrink: 0,
    marginTop: '1px',
  },
  priorityBadge: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    padding: '3px 8px',
    borderRadius: '6px',
    flexShrink: 0,
    letterSpacing: '0.03em',
  },
  priorityCritical: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  priorityHigh: {
    backgroundColor: '#fed7aa',
    color: '#9a3412',
  },
  priorityMedium: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  questionText: {
    fontSize: '0.9375rem',
    color: '#172b35',
    lineHeight: 1.55,
    fontWeight: 500,
    flex: 1,
    margin: 0,
  },
  relevanceHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8125rem',
    color: '#6b7c84',
    fontStyle: 'italic' as const,
    marginBottom: '12px',
    paddingLeft: '36px',
  },
  hintIcon: {
    fontSize: '0.875rem',
    flexShrink: 0,
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
  },
  answerBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '2px solid',
    transition: 'all 0.15s ease',
  },
  answerBtnUnselected: {
    borderColor: '#e3e8ea',
    backgroundColor: '#ffffff',
    color: '#6b7c84',
  },
  answerBtnNoSelected: {
    borderColor: '#179c88',
    backgroundColor: '#f0fdf4',
    color: '#179c88',
  },
  answerBtnYesSelected: {
    borderColor: '#d92d20',
    backgroundColor: '#fff5f5',
    color: '#d92d20',
  },
  answerIcon: {
    fontSize: '1rem',
    fontWeight: 700,
  },
  submitRow: {
    marginTop: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  submitNote: {
    fontSize: '0.875rem',
    color: '#6b7c84',
    textAlign: 'center' as const,
  },
  submitBtn: {
    width: '100%',
    maxWidth: '340px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  loadingDots: {
    display: 'flex',
    gap: '4px',
  },
  loadingDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'inline-block',
    animation: 'dotBounce 1.2s ease-in-out infinite',
  },
};
