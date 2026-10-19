import * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Application-wide notifications.
 *
 * There was no notification mechanism before: pages either set an inline
 * message string of their own or, for destructive actions, used the browser's
 * window.alert and window.confirm, which cannot be styled or translated.
 *
 * Messages are announced to assistive technology; errors assertively, since a
 * failed save is something the trader has to know about immediately.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  /** Milliseconds on screen. Errors stay until dismissed when this is 0. */
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  notify: (message: string, tone?: ToastTone, duration?: number) => string;
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts(current => current.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info', duration = DEFAULT_DURATION) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Errors are left on screen so a failure cannot be missed.
      const life = tone === 'error' && duration === DEFAULT_DURATION ? 0 : duration;

      setToasts(current => [...current.slice(-3), { id, tone, message, duration: life }]);

      if (life > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), life)
        );
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      notify,
      dismiss,
      success: (m: string) => notify(m, 'success'),
      error: (m: string) => notify(m, 'error'),
      warning: (m: string) => notify(m, 'warning'),
      info: (m: string) => notify(m, 'info'),
    }),
    [toasts, notify, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const TONE_STYLE: Record<ToastTone, { ring: string; icon: React.ReactNode }> = {
  success: { ring: 'border-brand-200 bg-brand-50', icon: <CheckCircle2 className="h-4 w-4 text-paid-fg" /> },
  error: { ring: 'border-due-bg bg-due-bg', icon: <XCircle className="h-4 w-4 text-due-fg" /> },
  warning: { ring: 'border-partial-bg bg-partial-bg', icon: <AlertTriangle className="h-4 w-4 text-partial-fg" /> },
  info: { ring: 'border-line bg-surface', icon: <Info className="h-4 w-4 text-ink-subtle" /> },
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      // Bottom on phones so it does not cover the header; bottom-right on desktop.
      className="no-print pointer-events-none fixed inset-x-4 bottom-20 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-card border p-3 shadow-raised',
            TONE_STYLE[toast.tone].ring
          )}
        >
          <span className="mt-0.5 shrink-0">{TONE_STYLE[toast.tone].icon}</span>
          <p className="flex-1 text-sm leading-snug font-medium text-ink">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="-m-1 shrink-0 rounded p-1 text-ink-subtle transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
