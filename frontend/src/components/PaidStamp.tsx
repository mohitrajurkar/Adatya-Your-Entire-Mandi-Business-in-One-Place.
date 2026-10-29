import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../lib/utils';

interface PaidStampProps {
  status?: string;
  date?: string | Date;
  amount?: number;
  remainingAmount?: number;
  className?: string;
}

/**
 * The payment stamp on a bill.
 *
 * This used to accept status and remainingAmount and then ignore both, so
 * every bill was stamped PAID no matter what was still owed. A farmer handed
 * a part-paid bill saw a document saying the money had been settled, which is
 * the worst kind of thing for a ledger to get wrong.
 *
 * The outstanding balance decides what is shown, not the status string: a bill
 * is only PAID when nothing is left to pay. The status is used as a fallback
 * for the wording when no balance has been supplied.
 */
export default function PaidStamp({
  status,
  amount,
  remainingAmount,
  className = '',
}: PaidStampProps) {
  const { t } = useLanguage();

  // Work from the balance where we have one. A rupee or two of rounding should
  // not leave a bill looking unpaid, hence the small tolerance.
  const due = typeof remainingAmount === 'number' ? remainingAmount : null;
  const paidInFull =
    due !== null ? due <= 0.009 : (status || '').toLowerCase() === 'paid';

  const nothingPaidYet =
    due !== null && typeof amount === 'number'
      ? due >= amount - 0.009
      : (status || '').toLowerCase() === 'pending';

  const variant = paidInFull ? 'paid' : nothingPaidYet ? 'unpaid' : 'partial';

  const palette = {
    paid: { border: 'border-emerald-600', text: 'text-emerald-700', ring: '16, 185, 129' },
    partial: { border: 'border-amber-600', text: 'text-amber-700', ring: '217, 119, 6' },
    unpaid: { border: 'border-red-600', text: 'text-red-600', ring: '220, 38, 38' },
  }[variant];

  const headline = {
    paid: 'PAID',
    partial: t('stamp_part_paid'),
    unpaid: t('stamp_unpaid'),
  }[variant];

  // Under the headline: what was paid, or what is still owed.
  const subtitle = paidInFull
    ? t('amount_paid_2')
    : due !== null
      ? `${t('stamp_balance_due')}: ${formatCurrency(due)}`
      : t('stamp_payment_pending');

  return (
    <div
      className={`relative inline-block border-[3.5px] ${palette.border} ${palette.text} font-bold uppercase tracking-widest px-4 sm:px-6 py-2 rounded-sm transform -rotate-12 select-none print:transform print:-rotate-12 ${className}`}
      style={{
        boxShadow: `0 0 0 1px rgba(${palette.ring}, 0.4), inset 0 0 0 1px rgba(${palette.ring}, 0.3)`,
      }}
    >
      <div className="flex flex-col items-center justify-center text-center leading-none py-0.5">
        <span className={`text-2xl sm:text-3xl font-black tracking-[0.2em] sm:tracking-[0.25em] ${palette.text} font-sans whitespace-nowrap`}>
          {headline}
        </span>
        <span className={`text-[9px] sm:text-[10px] font-bold tracking-wider ${palette.text} mt-1 border-t border-current/60 pt-0.5 w-full whitespace-nowrap`}>
          {subtitle}
        </span>
      </div>
    </div>
  );
}
