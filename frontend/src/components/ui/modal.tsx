import * as React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

/**
 * Dialog shell: focus is trapped while open, Escape closes, the background
 * does not scroll, and focus returns to whatever opened it.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Off for dialogs that must be answered, so a stray click cannot dismiss. */
  dismissOnBackdrop?: boolean;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog rather than leaving it on the page behind.
    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button:not([data-close])'
      );
      (target ?? panelRef.current)?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep Tab inside the dialog.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={event => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'max-h-[92vh] w-full overflow-y-auto rounded-t-card bg-surface shadow-overlay outline-none sm:rounded-card',
          SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="-m-1.5 shrink-0 rounded p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   ConfirmDialog
   ========================================================================== */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Say what will happen, in the trader's terms, not "Are you sure?". */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  busy?: boolean;
  /**
   * When set, the exact text the user must type to proceed. Reserved for
   * actions that cannot be undone.
   */
  requireTyped?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces window.confirm, which could not be styled, translated or tested,
 * and which gave no room to say what was about to happen.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  requireTyped,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const unlocked = !requireTyped || typed.trim() === requireTyped;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={title}
      size="sm"
      dismissOnBackdrop={!requireTyped && !busy}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy || !unlocked}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <span className="mt-0.5 shrink-0">
            <AlertTriangle className="h-5 w-5 text-due-fg" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-ink-muted">{message}</p>

          {requireTyped && (
            <label className="mt-4 block">
              <span className="text-2xs font-semibold tracking-wide text-ink uppercase">
                Type <span className="font-mono text-due-fg">{requireTyped}</span> to confirm
              </span>
              <input
                value={typed}
                onChange={event => setTyped(event.target.value)}
                autoComplete="off"
                className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm outline-none focus-visible:border-brand-600"
              />
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}
