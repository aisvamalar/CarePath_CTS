/**
 * CarePath — AI-assisted patient retrieval summary.
 *
 * Streams a clinical narrative composed from the patient's real EHR record,
 * stored readmission model output, and post-discharge agent status. The
 * Reasoning panel above shows which data sources were read.
 *
 * Note: the streaming is a client-side reveal over a narrative built from real
 * DB fields — the backend exposes no LLM summary endpoint for this screen.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '../ai/Reasoning';
import { useTypewriter } from '../../hooks/useTypewriter';
import { buildPatientNarrative, buildRetrievalReasoning, type NarrativeInput } from './patientNarrative';

interface Props extends NarrativeInput {
  /** True while the underlying record/prediction requests are still in flight. */
  loading: boolean;
  /** Fired once the narrative has finished typing, so the caller can reveal the sheet. */
  onDone?: () => void;
}

export default function PatientAISummary({ record, score, details, postDischarge, loading, onDone }: Props) {
  const input = useMemo(
    () => ({ record, score, details, postDischarge }),
    [record, score, details, postDischarge],
  );

  const reasoning = useMemo(() => buildRetrievalReasoning(input), [input]);
  const narrative = useMemo(() => buildPatientNarrative(input), [input]);

  const { shown, done, skip } = useTypewriter(narrative, {
    charsPerTick: 2,
    tickMs: 18,
    enabled: !loading,
  });

  // Tell the parent when the reveal completes (also fires when `skip` is used).
  useEffect(() => {
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <div className="pas">
      {/* Retrieval reasoning trace */}
      <Reasoning isStreaming={loading} defaultOpen>
        <ReasoningTrigger
          getThinkingMessage={(streaming, duration) =>
            streaming ? (
              <span>Retrieving patient record…</span>
            ) : duration !== undefined ? (
              <span>Retrieved in {duration}s · AI-assisted</span>
            ) : (
              <span>Retrieved from EHR · AI-assisted</span>
            )
          }
        />
        <ReasoningContent>{reasoning}</ReasoningContent>
      </Reasoning>

      {/* Streamed clinical summary */}
      <section className="pas-doc">
        <header className="pas-doc__head">
          {/* Left group */}
          <div className="pas-doc__headline">
            <span className="pas-doc__badge">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1.5l1.4 3.2 3.2 1.4-3.2 1.4L7 10.7 5.6 7.5 2.4 6.1l3.2-1.4L7 1.5z" fill="currentColor" />
              </svg>
              AI Generated
            </span>
            <h2 className="pas-doc__title">Clinical Summary</h2>
          </div>

          {/* Right group — skip control only */}
          {!done && !loading && (
            <div className="pas-doc__headright">
              <button className="pas-doc__skip" onClick={skip}>Skip</button>
            </div>
          )}
        </header>

        <div className="pas-doc__body" aria-live="polite" aria-busy={!done}>
          {loading ? (
            <p className="pas-doc__loading">Reading record…</p>
          ) : (
            renderNarrative(
              shown,
              !done ? (
                <>
                  <span className="pas-caret" aria-hidden="true" />
                  <span className="pas-aibadge" role="status">
                    <span className="pas-aibadge__icon" aria-hidden="true"><SparkleIcon /></span>
                    <span className="pas-aibadge__text">AI-Assisted Resolution</span>
                  </span>
                </>
              ) : null,
            )
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Renders the narrative markup: `## heading` lines become headings,
 * `**bold**` inline. `trailing` is appended *inside* the final block so the
 * caret and badge sit on the same line as the text currently being typed and
 * travel down with it.
 */
function renderNarrative(text: string, trailing?: ReactNode) {
  const blocks = text.split('\n').filter((l) => l.trim().length > 0);

  // Nothing typed yet — still show the badge so the state reads as active.
  if (blocks.length === 0) {
    return trailing ? <p className="pas-doc__p">{trailing}</p> : null;
  }

  return blocks.map((line, i) => {
    const isLast = i === blocks.length - 1;
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="pas-doc__h">
          {line.slice(3)}
          {isLast && trailing}
        </h3>
      );
    }
    return (
      <p key={i} className="pas-doc__p">
        {inlineBold(line)}
        {isLast && trailing}
      </p>
    );
  });
}

function inlineBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  );
}

/** Four-point sparkle pair, matching the reference banner. */
function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M9.5 3l1.5 4.2 4.2 1.5-4.2 1.5L9.5 14.4 8 10.2 3.8 8.7 8 7.2 9.5 3z"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M17 4.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" fill="currentColor" />
      <path d="M15.5 15l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" fill="currentColor" />
    </svg>
  );
}
