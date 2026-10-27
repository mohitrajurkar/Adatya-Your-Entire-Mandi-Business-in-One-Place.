import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, Check, Palette, Layers } from 'lucide-react';
import { useTheme, THEMES, AppThemeId, BillStyleId } from '../context/ThemeContext';
import { Button } from './ui/button';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeSelectorModal({ isOpen, onClose }: ThemeSelectorModalProps) {
  const { t } = useLanguage();
  const { themeId, setThemeId, billStyle, setBillStyle } = useTheme();

  if (!isOpen) return null;

  const themesList = Object.values(THEMES);

  const billStylesList: { id: BillStyleId; title: string; titleMr: string }[] = [
    {
      id: 'royal-framed',
      title: 'Royal Mandi Double Frame',
      titleMr: t('royal_double_frame'),
    },
    {
      id: 'traditional-patrika',
      title: 'Traditional Vyapari Patrika',
      titleMr: t('traditional_trader_ledger_bill'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Minimal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Select Theme & Bill Layout
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Body */}
        <div className="p-5 space-y-5">
          {/* Section 1: 2 Themes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              {t('theme')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {themesList.map((themeItem) => {
                const isSelected = themeId === themeItem.id;
                return (
                  <button
                    key={themeItem.id}
                    type="button"
                    onClick={() => setThemeId(themeItem.id as AppThemeId)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/40 font-bold'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-900">{t(themeItem.labelKey)}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: themeItem.swatches.primary }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: themeItem.swatches.accent }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: 2 Bill Layouts */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              {t('bill_voucher_layout')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {billStylesList.map((style) => {
                const isSelected = billStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setBillStyle(style.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600/40 font-bold'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{style.title}</div>
                      <div className="text-[11px] text-emerald-800 font-medium">{style.titleMr}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <Button
            onClick={onClose}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
