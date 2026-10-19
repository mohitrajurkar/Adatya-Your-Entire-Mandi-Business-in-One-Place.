import * as React from 'react';
import { cn } from '../../lib/utils';

/* ==========================================================================
   Skeleton
   ========================================================================== */

/**
 * Loading placeholder. The .skeleton utility honours prefers-reduced-motion.
 *
 * The class existed in the stylesheet before but was never used anywhere, so
 * every screen simply showed nothing while it loaded.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...props} />;
}

/** A few stacked lines, for a loading card or paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Placeholder rows matching the shape of a DataTable. */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" style={{ maxWidth: c === 0 ? 140 : undefined }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   EmptyState
   ========================================================================== */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  /** What the trader can do about it. An empty screen should never be a dead end. */
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ==========================================================================
   StatusBadge
   ========================================================================== */

export type PaymentStatus = 'Paid' | 'Partial' | 'Pending';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  Paid: 'bg-paid-bg text-paid-fg',
  Partial: 'bg-partial-bg text-partial-fg',
  Pending: 'bg-due-bg text-due-fg',
};

const STOCK_STYLES: Record<StockStatus, string> = {
  in_stock: 'bg-paid-bg text-paid-fg',
  low_stock: 'bg-partial-bg text-partial-fg',
  out_of_stock: 'bg-due-bg text-due-fg',
};

/**
 * One colour always means one thing: green settled, amber needs attention,
 * rose outstanding. Status was previously styled ad hoc per page.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: PaymentStatus | StockStatus;
  label?: string;
  className?: string;
}) {
  const style =
    status in PAYMENT_STYLES
      ? PAYMENT_STYLES[status as PaymentStatus]
      : STOCK_STYLES[status as StockStatus];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap',
        style,
        className
      )}
    >
      {label ?? status}
    </span>
  );
}

/* ==========================================================================
   MoneyText
   ========================================================================== */

/**
 * Renders a rupee figure exactly as the server sent it.
 *
 * The server holds money as numeric(14,2) and serialises it as a JSON number,
 * so the string form is already correct; this only formats grouping. Nothing
 * here recalculates or rounds, which is the rule the interface must follow
 * now that the backend owns every total.
 */
export function MoneyText({
  value,
  className,
  showPaise = false,
  signed = false,
}: {
  value: number | string | null | undefined;
  className?: string;
  /** Paise matter on a bill line; they are noise on a dashboard tile. */
  showPaise?: boolean;
  /** Show a + for positive values, for ledger movements. */
  signed?: boolean;
}) {
  const numeric = typeof value === 'string' ? Number(value) : value;

  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) {
    return <span className={cn('tabular text-ink-subtle', className)}>—</span>;
  }

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(Math.abs(numeric));

  const sign = numeric < 0 ? '−' : signed && numeric > 0 ? '+' : '';

  return (
    <span className={cn('tabular whitespace-nowrap', className)}>
      {sign}
      {formatted}
    </span>
  );
}

/** Quantities are quintals to three decimals, matching numeric(12,3). */
export function QuantityText({
  value,
  unit = 'Qtl',
  className,
}: {
  value: number | string | null | undefined;
  unit?: string;
  className?: string;
}) {
  const numeric = typeof value === 'string' ? Number(value) : value;

  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) {
    return <span className={cn('tabular text-ink-subtle', className)}>—</span>;
  }

  // Trailing zeros are dropped so 10.000 reads as 10, but 10.500 keeps its half.
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(numeric);

  return (
    <span className={cn('tabular whitespace-nowrap', className)}>
      {formatted}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}
