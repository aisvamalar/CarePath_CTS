/**
 * CarePath — Toast notifications
 * Lightweight provider; no external dependency.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, string> = {
  success: '✓',
  error: '!',
  info: 'i',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (m: string) => notify(m, 'success'),
      error: (m: string) => notify(m, 'error'),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="cp-toast-stack" role="region" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className={`cp-toast cp-toast--${t.kind}`} role="status" aria-live="polite">
            <span className={`cp-toast__icon cp-toast__icon--${t.kind}`} aria-hidden="true">
              {ICONS[t.kind]}
            </span>
            <span className="cp-toast__msg">{t.message}</span>
            <button className="cp-toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // Fall back to a no-op so components remain usable outside the provider.
  if (!ctx) {
    return {
      notify: () => undefined,
      success: () => undefined,
      error: () => undefined,
    };
  }
  return ctx;
}
