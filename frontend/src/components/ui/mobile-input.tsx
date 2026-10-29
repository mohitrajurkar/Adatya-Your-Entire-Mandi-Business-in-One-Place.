import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * A 10-digit Indian mobile number field.
 *
 * Every mobile input in the application previously accepted any text of any
 * length, so a trader could type eleven digits, paste a number with spaces or
 * a +91 prefix, and only find out it was wrong when the server rejected it.
 *
 * This strips anything that is not a digit as it is typed, drops a leading
 * country code, and stops at ten, so an invalid number cannot be entered in
 * the first place. A first digit outside 6-9 is refused as well, since no
 * Indian mobile number begins with one. inputMode="numeric" brings up the number pad on a phone.
 */
export interface MobileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  /** Receives the cleaned value: digits only, at most ten. */
  onValueChange: (value: string) => void;
}

/**
 * Digits only, country code and trunk prefix removed, capped at ten.
 *
 * Indian mobile numbers begin with 6, 7, 8 or 9, so a leading digit outside
 * that range is dropped rather than accepted and rejected later by the
 * server. A pasted "+91 98230 11001" or "098230 11001" both reduce to
 * "9823011001".
 */
export function normaliseMobile(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');

  // Strip a country code or trunk prefix wherever it leaves a plausible number.
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  while (digits.length > 0 && digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  // A first digit below 6 cannot start a mobile number.
  while (digits.length > 0 && !/[6-9]/.test(digits[0])) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export const MobileInput = React.forwardRef<HTMLInputElement, MobileInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => (
    <input
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={10}
      value={value}
      onChange={event => onValueChange(normaliseMobile(event.target.value))}
      className={cn(
        'tabular flex h-10 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors',
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
MobileInput.displayName = 'MobileInput';
