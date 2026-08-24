/**
 * CarePath — Reasoning / Agent-Workflow Trace
 *
 * A collapsible "chain of thought" panel shown while the triage agent is
 * working (safety rule engine → ED-avoidability model → care pathway) and
 * afterwards as a "Thought for N seconds" summary of what it checked.
 *
 * Self-contained re-implementation (no Radix / streamdown dependency) that
 * matches this project's existing design system and build setup.
 */
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import Shimmer from './Shimmer';

// ── Context ──────────────────────────────────────────────────────────────────

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoning() {
  const ctx = useContext(ReasoningContext);
  if (!ctx) throw new Error('Reasoning components must be used within <Reasoning>');
  return ctx;
}

// ── Root ─────────────────────────────────────────────────────────────────────

export interface ReasoningProps {
  className?: string;
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Controlled duration (seconds). If provided, overrides internal timing. */
  duration?: number;
  children: ReactNode;
}

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className = '',
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
  }: ReasoningProps) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const isOpen = open ?? uncontrolledOpen;

    const [internalDuration, setInternalDuration] = useState<number | undefined>(durationProp);
    const duration = durationProp ?? internalDuration;

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    const setIsOpen = (next: boolean) => {
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    };

    // Sync externally controlled duration into internal state.
    useEffect(() => {
      if (durationProp !== undefined) setInternalDuration(durationProp);
    }, [durationProp]);

    // Track elapsed time only when the caller doesn't supply a duration itself.
    useEffect(() => {
      if (durationProp !== undefined) return;
      if (isStreaming) {
        if (startTimeRef.current === null) startTimeRef.current = Date.now();
      } else if (startTimeRef.current !== null) {
        setInternalDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
        startTimeRef.current = null;
      }
    }, [isStreaming, durationProp]);

    // Auto-open while streaming, auto-close shortly after streaming ends (once).
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);
        return () => clearTimeout(timer);
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming, isOpen, defaultOpen, hasAutoClosed]);

    return (
      <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration }}>
        <div className={`ai-reasoning ${className}`}>{children}</div>
      </ReasoningContext.Provider>
    );
  },
);
Reasoning.displayName = 'Reasoning';

// ── Trigger ──────────────────────────────────────────────────────────────────

export interface ReasoningTriggerProps extends Omit<ComponentProps<'button'>, 'children'> {
  children?: ReactNode;
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
}

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Analyzing your responses…</Shimmer>;
  }
  if (duration === undefined) return <span>Thought for a few seconds</span>;
  return <span>Thought for {duration} second{duration === 1 ? '' : 's'}</span>;
};

export const ReasoningTrigger = memo(
  ({ className = '', children, getThinkingMessage = defaultGetThinkingMessage, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration, setIsOpen } = useReasoning();
    return (
      <button
        type="button"
        className={`ai-reasoning__trigger ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="ai-reasoning__brain" />
            <span className="ai-reasoning__label">{getThinkingMessage(isStreaming, duration)}</span>
            <ChevronIcon className={`ai-reasoning__chevron${isOpen ? ' ai-reasoning__chevron--open' : ''}`} />
          </>
        )}
      </button>
    );
  },
);
ReasoningTrigger.displayName = 'ReasoningTrigger';

// ── Content ──────────────────────────────────────────────────────────────────

export interface ReasoningContentProps {
  className?: string;
  children: string;
}

export const ReasoningContent = memo(({ className = '', children }: ReasoningContentProps) => {
  const { isOpen } = useReasoning();
  if (!isOpen) return null;

  // Render each line/paragraph separately; bold **text** segments for readability.
  const paragraphs = children.split(/\n+/).filter(Boolean);

  return (
    <div className={`ai-reasoning__content fade-in ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="ai-reasoning__para">
          {renderInlineBold(p)}
        </p>
      ))}
    </div>
  );
});
ReasoningContent.displayName = 'ReasoningContent';

/** Minimal **bold** markdown support without pulling in a markdown renderer. */
function renderInlineBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Icons ────────────────────────────────────────────────────────────────────

function BrainIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8 3.5c-1.5 0-2.7 1-3 2.4-1.2.2-2.1 1.3-2.1 2.5 0 .6.2 1.1.5 1.5-.5.5-.8 1.1-.8 1.8 0 1.3 1 2.3 2.2 2.4.2 1.2 1.3 2.1 2.6 2.1.5 0 1-.1 1.4-.4"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M12 3.5c1.5 0 2.7 1 3 2.4 1.2.2 2.1 1.3 2.1 2.5 0 .6-.2 1.1-.5 1.5.5.5.8 1.1.8 1.8 0 1.3-1 2.3-2.2 2.4-.2 1.2-1.3 2.1-2.6 2.1-.5 0-1-.1-1.4-.4"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M10 3.5v13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
