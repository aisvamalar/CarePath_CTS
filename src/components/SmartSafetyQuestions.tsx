/**
 * CarePath — Smart Safety Questions
 * Exact replication of reference screenshot 1:
 * - Full-width layout, no centering
 * - Left column: question + hint; Right column: No / Yes buttons
 * - Orange numbered circles, "CRITICAL" / "HIGH RISK" badges
 * - "Clear answers" link at bottom right
 */

import { useState, useEffect } from 'react';
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

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH RISK',
  medium: 'MEDIUM',
};

interface Props {
  sessionId: string;
  chiefComplaint: string;
  extractedFeatures: Record<string, unknown>;
  onSubmit: (flags: RedFlagsPayload) => void;
  loading: boolean;
}

export default function SmartSafetyQuestions({ sessionId, chiefComplaint, extractedFeatures, onSubmit, loading }: Props) {
  const [flags, setFlags] = useState<RelevantRedFlag[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [filterLoading, setFilterLoading] = useState(true);
  const [filterError, setFilterError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFilterLoading(true); setFilterError('');
      try {
        const res: SmartFilterResult = await safetyAPI.smartFilter(sessionId, chiefComplaint, extractedFeatures || {});
        if (cancelled) return;
        setFlags(res.relevant_flags);
        const init: Record<string, boolean> = {};
        res.relevant_flags.forEach(f => { init[f.field] = false; });
        setAnswers(init);
      } catch (err: unknown) {
        if (cancelled) return;
        let msg = 'Failed to load safety questions.';
        if (err && typeof err === 'object' && 'response' in err) {
          const e = err as { response?: { status?: number; data?: { detail?: string } } };
          if (e.response?.status === 401) msg = 'Session expired. Please log in again.';
          else if (e.response?.data?.detail) msg = e.response.data.detail;
        }
        setFilterError(msg);
      } finally { if (!cancelled) setFilterLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [sessionId, chiefComplaint, extractedFeatures]);

  const clearAnswers = () => {
    const reset: Record<string, boolean> = {};
    flags.forEach(f => { reset[f.field] = false; });
    setAnswers(reset);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
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
    });
  };

  if (filterLoading) {
    return (
      <div className="ssq-root">
        <div className="ssq-header">
          <div className="ssq-header__icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#e06a4f" strokeWidth="2" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <h2 className="ssq-header__title">Quick Safety Check</h2>
            <p className="ssq-header__sub">Analyzing your symptoms…</p>
          </div>
        </div>
        <div className="ssq-loading">
          <div className="ssq-loading__spinner" />
          <p className="ssq-loading__text">Loading safety questions…</p>
        </div>
      </div>
    );
  }

  if (filterError) {
    return (
      <div className="ssq-root">
        <div className="ssq-error">
          <span className="ssq-error__icon">⚠️</span>
          <h3 className="ssq-error__title">Unable to Load Questions</h3>
          <p className="ssq-error__text">{filterError}</p>
          <button className="ssq-retry" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ssq-root">
      {/* Header */}
      <div className="ssq-header">
        <div className="ssq-header__icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#e06a4f" strokeWidth="2" strokeLinejoin="round"/></svg>
        </div>
        <div>
          <h2 className="ssq-header__title">Quick Safety Check</h2>
          <p className="ssq-header__sub">Based on your {chiefComplaint}, {flags.length} important question{flags.length !== 1 ? 's' : ''} to check.</p>
        </div>
      </div>

      {/* Questions */}
      <form onSubmit={handleSubmit}>
        <div className="ssq-questions">
          {flags.map((item, i) => (
            <div key={item.field} className={`ssq-row ${answers[item.field] ? 'ssq-row--yes' : ''}`}>
              {/* Left: number + priority + question text */}
              <div className="ssq-row__left">
                <div className="ssq-row__meta">
                  <span className="ssq-row__num">{i + 1}</span>
                  <span className={`ssq-row__badge ssq-row__badge--${item.priority}`}>
                    {PRIORITY_LABEL[item.priority]}
                  </span>
                  <p className="ssq-row__question">{item.question}</p>
                </div>
                <p className="ssq-row__hint">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0, marginRight:4, opacity:0.55}}>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {item.relevance_reason}
                </p>
              </div>

              {/* Right: No / Yes buttons */}
              <div className="ssq-row__btns">
                <button
                  type="button"
                  className={`ssq-ans ssq-ans--no ${answers[item.field] === false ? 'ssq-ans--no-active' : ''}`}
                  onClick={() => setAnswers(p => ({ ...p, [item.field]: false }))}
                  disabled={loading}
                >
                  <span>✕</span> No
                </button>
                <button
                  type="button"
                  className={`ssq-ans ssq-ans--yes ${answers[item.field] === true ? 'ssq-ans--yes-active' : ''}`}
                  onClick={() => setAnswers(p => ({ ...p, [item.field]: true }))}
                  disabled={loading}
                >
                  <span>✓</span> Yes
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="ssq-footer">
          <button type="button" className="ssq-clear" onClick={clearAnswers}>
            Clear answers
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{marginLeft:4}}><path d="M13 3c-2-2-5-2-7 0M3 13c2 2 5 2 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 8A6 6 0 1114 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        <button type="submit" className="ssq-submit" disabled={loading}>
          {loading ? <><span className="ssq-spinner" /> Evaluating…</> : '✓ Submit Answers'}
        </button>
      </form>
    </div>
  );
}
