/**
 * CarePath — Modal + confirmation dialog.
 * Focus is moved into the dialog and Escape closes it.
 */

import React, { useEffect, useRef } from 'react';

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog for keyboard and screen-reader users.
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="cp-modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cp-modal__head">
          <div>
            <h2 className="cp-modal__title" id="cp-modal-title">{title}</h2>
            {subtitle && <p className="cp-modal__sub">{subtitle}</p>}
          </div>
          <button className="cp-modal__close" onClick={onClose} aria-label="Close dialog">✕</button>
        </header>
        <div className="cp-modal__body">{children}</div>
        {footer && <footer className="cp-modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button className="cp-btn cp-btn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`cp-btn ${danger ? 'cp-btn--danger' : 'cp-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <><span className="cp-btn__spinner" /> Working…</> : confirmLabel}
          </button>
        </>
      }
    >
      <p className="cp-modal__text">{message}</p>
    </Modal>
  );
}
