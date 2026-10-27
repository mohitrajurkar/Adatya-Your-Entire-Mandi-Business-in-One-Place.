import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface PaidStampProps {
  status?: string;
  date?: string | Date;
  amount?: number;
  remainingAmount?: number;
  className?: string;
}

export default function PaidStamp({
  className = ''
}: PaidStampProps) {
  const { t } = useLanguage();
  return (
    <div
      className={`relative inline-block border-[3.5px] border-red-600 text-red-600 font-bold uppercase tracking-widest px-6 py-2 rounded-sm transform -rotate-12 select-none print:transform print:-rotate-12 ${className}`}
      style={{
        boxShadow: '0 0 0 1px rgba(220, 38, 38, 0.4), inset 0 0 0 1px rgba(220, 38, 38, 0.3)',
      }}
    >
      <div className="flex flex-col items-center justify-center text-center leading-none py-0.5">
        <span className="text-3xl font-black tracking-[0.25em] text-red-600 font-sans">
          PAID
        </span>
        <span className="text-[10px] font-bold tracking-wider text-red-600 mt-1 border-t border-red-500/80 pt-0.5 w-full">
          {t('amount_paid_2')}
        </span>
      </div>
    </div>
  );
}
