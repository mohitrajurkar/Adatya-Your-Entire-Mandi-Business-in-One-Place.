import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'mr' | 'en';

export interface Translations {
  [key: string]: {
    mr: string;
    en: string;
  };
}

export const translations: Translations = {
  // Navigation
  dashboard: { mr: 'डॅशबोर्ड', en: 'Dashboard' },
  purchases: { mr: 'खरेदी नोंदी', en: 'Purchases' },
  farmers: { mr: 'शेतकरी यादी', en: 'Farmers' },
  reports: { mr: 'अहवाल', en: 'Reports' },
  profile: { mr: 'प्रोफाइल', en: 'Profile' },
  settings: { mr: 'सेटिंग्ज', en: 'Settings' },
  logout: { mr: 'लॉगआउट', en: 'Logout' },

  // Dashboard Stats & Actions
  newPurchaseSlip: { mr: 'नवीन खरेदी पावती', en: 'New Purchase Slip' },
  editProfile: { mr: 'प्रोफाइल संपादित करा', en: 'Edit Profile' },
  allBills: { mr: 'सर्व पावत्या', en: 'All Bills' },
  totalPurchased: { mr: 'एकूण खरेदी', en: 'Total Purchased' },
  amountPaid: { mr: 'अदा केलेली रक्कम', en: 'Amount Paid' },
  pendingBalance: { mr: 'शिल्लक बाकी', en: 'Pending Balance' },
  farmersRegistered: { mr: 'नोंदणीकृत शेतकरी', en: 'Farmers Registered' },
  procurementValueTrends: { mr: 'खरेदी उलाढाल आलेख', en: 'Procurement Trends' },
  recentPurchases: { mr: 'ताजी खरेदी', en: 'Recent Purchases' },
  viewAll: { mr: 'सर्व पहा', en: 'View All' },
  liveDesk: { mr: 'थेट आडत डेस्क', en: 'Live Mandi Desk' },
  welcome: { mr: 'स्वागत आहे', en: 'Welcome' },

  // Bill & Voucher
  invoiceBill: { mr: 'खरेदी पावती', en: 'INVOICE BILL' },
  invoiceNo: { mr: 'पावती क्र.', en: 'Invoice No' },
  date: { mr: 'तारीख', en: 'Date' },
  farmerName: { mr: 'शेतकरी नाव', en: 'Farmer Name' },
  village: { mr: 'गाव', en: 'Village' },
  mobile: { mr: 'मोबाईल', en: 'Mobile' },
  commodity: { mr: 'शेतमाल / धान्य', en: 'Commodity / Crop' },
  quantity: { mr: 'वजन / प्रमाण (क्विं.)', en: 'Quantity (Qtl)' },
  rate: { mr: 'दर प्रति क्विंटल (₹)', en: 'Rate / Qtl (₹)' },
  amount: { mr: 'एकूण रक्कम (₹)', en: 'Total Amount (₹)' },
  grossTotal: { mr: 'एकूण खरेदी रक्कम', en: 'Gross Total' },
  advancePaid: { mr: 'दिलेली उचल / रक्कम', en: 'Advance Paid' },
  remainingAmount: { mr: 'शिल्लक बाकी', en: 'Remaining Balance' },
  amountInWords: { mr: 'अक्षरी रक्कम', en: 'Amount in Words' },
  printBill: { mr: 'पावती छापा', en: 'Print Bill' },
  sharePdfOnWhatsApp: { mr: 'व्हॉट्सॲपवर PDF पाठवा', en: 'Send PDF on WhatsApp' },
  payBalance: { mr: 'शिल्लक जमा करा', en: 'Pay Balance' },
  authorizedSignatory: { mr: 'अधिकृत स्वाक्षरी', en: 'Authorized Signatory' },

  // Commodity Dropdown & Custom
  selectCommodity: { mr: 'धान्य निवडा...', en: 'Select Commodity...' },
  otherGrain: { mr: '🌾 इतर धान्य (Custom धान्य नाव टाका)...', en: '🌾 Other Grain (Enter Custom Name)...' },
  enterGrainName: { mr: 'धान्याचे नाव टाका (उदा. हरभरा, उडीद, मका)', en: 'Enter Grain Name (e.g. Gram, Urad, Maize)' },

  // Status
  paid: { mr: 'अदा', en: 'Paid' },
  partial: { mr: 'अंशतः अदा', en: 'Partial' },
  pending: { mr: 'बाकी', en: 'Pending' },

  // Common
  save: { mr: 'जतन करा', en: 'Save' },
  saving: { mr: 'जतन करत आहे...', en: 'Saving...' },
  cancel: { mr: 'रद्द करा', en: 'Cancel' },
  search: { mr: 'शोधा...', en: 'Search...' },
  actions: { mr: 'कृती', en: 'Actions' },
  view: { mr: 'पहा', en: 'View' },
  add: { mr: 'जोडा', en: 'Add' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('adatya_lang');
    return saved === 'en' ? 'en' : 'mr'; // Marathi by default for authentic Mandi experience
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('adatya_lang', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'mr' ? 'en' : 'mr');
  };

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language] || translations[key].en || key;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
