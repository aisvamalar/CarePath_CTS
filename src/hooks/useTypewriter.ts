/**
 * useTypewriter — reveals text progressively, ChatGPT-style.
 *
 * Reveals a few characters per tick rather than one, so long clinical
 * summaries finish in a reasonable time while still reading as "streaming".
 * Respects prefers-reduced-motion by revealing instantly.
 */
import { useEffect, useRef, useState } from 'react';

interface Options {
  /** Characters revealed per tick. */
  charsPerTick?: number;
  /** Milliseconds between ticks. */
  tickMs?: number;
  /** When false, nothing streams and text stays empty. */
  enabled?: boolean;
}

export function useTypewriter(full: string, { charsPerTick = 3, tickMs = 16, enabled = true }: Options = {}) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);

    if (!enabled || !full) {
      setShown('');
      setDone(false);
      return;
    }

    // Accessibility: skip the animation entirely when reduced motion is requested.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(full);
      setDone(true);
      return;
    }

    setShown('');
    setDone(false);
    let i = 0;

    timer.current = setInterval(() => {
      i += charsPerTick;
      if (i >= full.length) {
        setShown(full);
        setDone(true);
        if (timer.current) clearInterval(timer.current);
      } else {
        setShown(full.slice(0, i));
      }
    }, tickMs);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [full, charsPerTick, tickMs, enabled]);

  /** Reveal the rest immediately (used by a "skip" affordance). */
  const skip = () => {
    if (timer.current) clearInterval(timer.current);
    setShown(full);
    setDone(true);
  };

  return { shown, done, skip };
}

export default useTypewriter;
