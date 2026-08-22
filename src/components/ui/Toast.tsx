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

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'success') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#16a34a" />
        <path d="M6 10.2l2.4 2.4L14 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#dc2626" />
        <path d="M10 6v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="13.6" r="0.9" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#2563eb" />
      <path d="M10 9v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="6.4" r="0.9" fill="#fff" />
    </svg>
  );
}

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
              <ToastIcon kind={t.kind} />
            </span>
            <span className="cp-toast__msg">{t.message}</span>
            <button className="cp-toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
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
