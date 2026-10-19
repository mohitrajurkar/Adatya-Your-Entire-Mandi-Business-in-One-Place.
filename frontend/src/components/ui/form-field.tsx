import * as React from 'react';
import { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * A labelled form control with hint and error text wired up correctly.
 *
 * Forms previously placed a bare styled span above each input with no htmlFor,
 * so nothing announced the label and tapping it did not focus the field. Error
 * text was a separate block elsewhere on the page with no association to the
 * control it referred to.
 */
export interface FormFieldProps {
  label: string;
  /** Supply when wrapping your own control; otherwise one is generated. */
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode | ((ids: FieldIds) => React.ReactNode);
}

export interface FieldIds {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const ids: FieldIds = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-2xs font-semibold tracking-wide text-ink uppercase">
        {label}
        {required && (
          <span className="ml-0.5 text-due-fg" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {typeof children === 'function' ? children(ids) : children}

      {hint && !error && (
        <p id={hintId} className="text-2xs text-ink-subtle">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="flex items-center gap-1 text-2xs font-medium text-due-fg">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Text input styled from the tokens, for use inside a FormField. */
export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink transition-colors',
        'placeholder:text-ink-subtle hover:border-line-strong',
        'focus-visible:border-brand-600 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
        'aria-[invalid=true]:border-due-fg',
        className
      )}
      {...props}
    />
  )
);
TextInput.displayName = 'TextInput';

/** Select styled to match TextInput. */
export const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink transition-colors',
        'hover:border-line-strong focus-visible:border-brand-600 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
        'aria-[invalid=true]:border-due-fg',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
SelectInput.displayName = 'SelectInput';

/**
 * Numeric input for quantities and money.
 *
 * inputMode="decimal" brings up the number pad on a phone, which matters for
 * traders entering weights at the yard.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <TextInput
      ref={ref}
      type="number"
      inputMode="decimal"
      className={cn('tabular', className)}
      {...props}
    />
  )
);
NumberInput.displayName = 'NumberInput';
