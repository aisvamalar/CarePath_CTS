/**
 * Shimmer — animated gradient-sweep text, used for "Thinking..." labels.
 * Pure CSS animation, no extra dependency.
 */
import type { ReactNode } from 'react';

interface ShimmerProps {
  children: ReactNode;
  duration?: number;
  className?: string;
}

export function Shimmer({ children, duration = 1.4, className = '' }: ShimmerProps) {
  return (
    <span
      className={`ai-shimmer ${className}`}
      style={{ animationDuration: `${duration}s` }}
    >
      {children}
    </span>
  );
}

export default Shimmer;
