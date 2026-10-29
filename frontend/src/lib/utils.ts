import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format as formatDateFns } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function numberToWordsINR(num: number | null | undefined): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const rounded = Math.floor(num);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  }

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const remaining = rounded % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertLessThanThousand(crore) + ' Crore');
  if (lakh > 0) parts.push(convertLessThanThousand(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertLessThanThousand(thousand) + ' Thousand');
  if (remaining > 0) parts.push(convertLessThanThousand(remaining));

  return (parts.join(' ') + ' Rupees Only').trim();
}

/**
 * Format a date for display without ever throwing.
 *
 * date-fns `format` raises "RangeError: Invalid time value" when handed an
 * unparseable date, and a throw inside a table cell takes the whole page down
 * with it. That is what a single malformed row did here: the Purchases list
 * went blank, with nothing on screen to say why.
 *
 * The date column is free text rather than a real date type, so a bad value
 * can always find its way in -- from an older release, an import, or a manual
 * fix in the database. One broken row should cost the trader that one cell,
 * not the entire page.
 */
export function formatDate(
  value: string | Date | null | undefined,
  pattern = 'dd MMM yyyy',
  fallback = '—'
): string {
  if (!value) return fallback;

  const parsed = value instanceof Date ? value : new Date(value);
  if (isNaN(parsed.getTime())) {
    // Show whatever was stored rather than a dash: a trader who can see
    // "30/10/2026" sitting in the date column can tell someone what is wrong,
    // where a dash tells them nothing.
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  try {
    return formatDateFns(parsed, pattern);
  } catch {
    return fallback;
  }
}
