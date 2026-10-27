import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AppThemeId = 'premium' | 'white';
export type BillStyleId = 'royal-framed' | 'traditional-patrika';

export interface ThemeConfig {
  id: AppThemeId;
  name: string;
  /** Translation key for the display name, so the label follows the chosen language. */
  labelKey: 'theme_royal_mandi' | 'theme_standard_white';
  description: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  sidebarBorder: string;
  sidebarAccent: string;
  primaryColor: string;
  primaryHover: string;
  accentColor: string;
  accentText: string;
  lightBg: string;
  cardBorder: string;
  billHeaderBg: string;
  billHeaderText: string;
  billBorderColor: string;
  billTableHeadBg: string;
  billTableHeadText: string;
  billRibbonBg: string;
  swatches: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
}

export const THEMES: Record<AppThemeId, ThemeConfig> = {
  premium: {
    id: 'premium',
    name: 'Royal Mandi Theme',
    labelKey: 'theme_royal_mandi',
    description: 'Official royal emerald and warm harvest gold luxury theme.',
    sidebarBg: 'bg-[#04251a]',
    sidebarText: 'text-emerald-100',
    sidebarActiveBg: 'bg-emerald-500/20',
    sidebarActiveText: 'text-amber-300',
    sidebarBorder: 'border-emerald-900/60',
    sidebarAccent: 'text-amber-400',
    primaryColor: 'bg-emerald-800 hover:bg-emerald-900 text-white',
    primaryHover: 'hover:bg-emerald-900',
    accentColor: 'bg-amber-600 hover:bg-amber-700 text-white',
    accentText: 'text-amber-600',
    lightBg: 'bg-[#f4f7f4]',
    cardBorder: 'border-emerald-900/15',
    billHeaderBg: 'bg-emerald-950',
    billHeaderText: 'text-white',
    billBorderColor: 'border-emerald-900',
    billTableHeadBg: 'bg-emerald-950',
    billTableHeadText: 'text-white',
    billRibbonBg: 'bg-emerald-900',
    swatches: {
      primary: '#064e3b',
      secondary: '#04251a',
      accent: '#d97706',
      bg: '#f4f7f4',
    },
  },
  white: {
    id: 'white',
    name: 'Standard White',
    labelKey: 'theme_standard_white',
    description: 'Clean modern standard white and slate style.',
    sidebarBg: 'bg-slate-900',
    sidebarText: 'text-slate-200',
    sidebarActiveBg: 'bg-white/10',
    sidebarActiveText: 'text-white',
    sidebarBorder: 'border-slate-800',
    sidebarAccent: 'text-slate-300',
    primaryColor: 'bg-slate-900 hover:bg-slate-800 text-white',
    primaryHover: 'hover:bg-slate-800',
    accentColor: 'bg-slate-800 hover:bg-slate-700 text-white',
    accentText: 'text-slate-800',
    lightBg: 'bg-[#f8fafc]',
    cardBorder: 'border-slate-200',
    billHeaderBg: 'bg-slate-900',
    billHeaderText: 'text-white',
    billBorderColor: 'border-slate-900',
    billTableHeadBg: 'bg-slate-900',
    billTableHeadText: 'text-white',
    billRibbonBg: 'bg-slate-900',
    swatches: {
      primary: '#0f172a',
      secondary: '#ffffff',
      accent: '#64748b',
      bg: '#ffffff',
    },
  },
};

interface ThemeContextType {
  currentTheme: ThemeConfig;
  themeId: AppThemeId;
  setThemeId: (id: AppThemeId) => void;
  billStyle: BillStyleId;
  setBillStyle: (style: BillStyleId) => void;
  isThemeModalOpen: boolean;
  setIsThemeModalOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<AppThemeId>(() => {
    const saved = localStorage.getItem('bodhale_app_theme') as AppThemeId;
    return saved && THEMES[saved] ? saved : 'premium';
  });

  const [billStyle, setBillStyleState] = useState<BillStyleId>(() => {
    const saved = localStorage.getItem('bodhale_bill_layout') as BillStyleId;
    return saved === 'traditional-patrika' ? 'traditional-patrika' : 'royal-framed';
  });

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  const setThemeId = (id: AppThemeId) => {
    setThemeIdState(id);
    localStorage.setItem('bodhale_app_theme', id);
  };

  const setBillStyle = (style: BillStyleId) => {
    setBillStyleState(style);
    localStorage.setItem('bodhale_bill_layout', style);
  };

  const currentTheme = THEMES[themeId] || THEMES.premium;

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeId,
        setThemeId,
        billStyle,
        setBillStyle,
        isThemeModalOpen,
        setIsThemeModalOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
