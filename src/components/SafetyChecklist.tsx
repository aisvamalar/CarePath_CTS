import React, { useState } from 'react';
import type { RedFlagsPayload } from '../services/api';

const RED_FLAG_QUESTIONS: Array<{ field: keyof RedFlagsPayload; question: string; icon: string }> = [
  {
    field: 'chest_pain',
    question: 'Are you having chest pain or pressure — squeezing, tightness, or pressure in the chest?',
    icon: '🫀',
  },
  {
    field: 'difficulty_breathing',
    question: 'Are you having SEVERE difficulty breathing — unable to speak in full sentences, or gasping for air?',
    icon: '🫁',
  },
  {
    field: 'altered_consciousness',
    question: 'Have you lost consciousness, fainted, or are you acutely confused / unresponsive?',
    icon: '🧠',
  },
  {
    field: 'severe_bleeding',
    question: 'Are you bleeding severely and unable to stop it despite direct pressure?',
    icon: '🩹',
  },
  {
    field: 'stroke_symptoms',
    question: 'Do you have facial drooping, sudden arm/leg weakness, or inability to speak — happening RIGHT NOW?',
    icon: '⚡',
  },
  {
    field: 'suicidal_ideation',
    question: 'Are you having thoughts of hurting yourself or ending your life?',
    icon: '💙',
  },
  {
    field: 'anaphylaxis',
    question: 'Are you having a severe allergic reaction — throat swelling, widespread hives, or feeling faint?',
    icon: '⚠️',
  },
  {
    field: 'high_fever',
    question: 'Do you have a dangerously high fever — 103°F (39.4°C) or higher?',
    icon: '🌡️',
  },
  {
    field: 'unable_to_walk',
    question: 'Are you completely unable to walk, stand, or bear any weight?',
    icon: '🦵',
  },
  {
    field: 'severe_abdominal_pain',
    question: 'Are you having severe, sharp, or crushing abdominal (belly) pain?',
    icon: '🔴',
  },
];

interface SafetyChecklistProps {
  onSubmit: (flags: RedFlagsPayload) => void;
  loading: boolean;
}

export default function SafetyChecklist({ onSubmit, loading }: SafetyChecklistProps) {
  const [answers, setAnswers] = useState<Record<keyof RedFlagsPayload, boolean>>({
    chest_pain: false,
    difficulty_breathing: false,
    altered_consciousness: false,
    severe_bleeding: false,
    stroke_symptoms: false,
    suicidal_ideation: false,
    anaphylaxis: false,
    high_fever: false,
    unable_to_walk: false,
    severe_abdominal_pain: false,
  });

  const setAnswer = (field: keyof RedFlagsPayload, value: boolean) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(answers);
  };

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
          <h2 style={styles.title}>Emergency Safety Screening</h2>
          <p style={styles.subtitle}>
            Please answer each question honestly. These questions help identify if you need immediate emergency care.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={styles.progressWrap}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(yesCount / 10) * 100}%`,
            }}
          />
        </div>
        <span style={styles.progressLabel}>{yesCount} concern{yesCount !== 1 ? 's' : ''} noted</span>
      </div>

      <form onSubmit={handleSubmit} aria-label="Emergency safety screening form">
        <div style={styles.questions}>
          {RED_FLAG_QUESTIONS.map((item, index) => (
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
                <span style={styles.questionIcon} aria-hidden="true">{item.icon}</span>
                <p style={styles.questionText}>{item.question}</p>
              </div>
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
            Review your answers above, then submit for evaluation.
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
                Submit for Evaluation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    gap: '10px',
  },
  questionCard: {
    padding: '14px 16px',
    backgroundColor: '#f8fafb',
    border: '1.5px solid #e3e8ea',
    borderRadius: '12px',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
  },
  questionCardYes: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  questionTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '12px',
  },
  questionNum: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6b7c84',
    backgroundColor: '#e3e8ea',
    borderRadius: '4px',
    padding: '2px 6px',
    flexShrink: 0,
    marginTop: '1px',
  },
  questionIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  questionText: {
    fontSize: '0.9375rem',
    color: '#172b35',
    lineHeight: 1.55,
    fontWeight: 500,
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  answerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1.5px solid',
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
    fontSize: '0.875rem',
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
    textAlign: 'center',
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
