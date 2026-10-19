import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Wheat,
  Boxes,
  Palette,
  Building2,
  User,
  Languages,
  Plus,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ThemeSelectorModal from '../components/ThemeSelectorModal';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { DEFAULT_LOGO } from '../config/logos';
import { apiFetch, clearSession } from '../lib/api';


export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentTheme, isThemeModalOpen, setIsThemeModalOpen } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [businessProfileData, setBusinessProfileData] = useState<{ businessName?: string; address?: string } | null>(null);

  const handleLogout = () => {
    clearSession();
    window.dispatchEvent(new Event('storage'));
    window.location.href = '/login';
  };
  const [brandLogo, setBrandLogo] = useState<string>(() => {
    const saved = localStorage.getItem('adatya_logo');
    if (!saved || saved.includes('.jpg')) {
      localStorage.setItem('adatya_logo', DEFAULT_LOGO);
      return DEFAULT_LOGO;
    }
    return saved;
  });

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('adatya_logo');
      setBrandLogo(saved && !saved.includes('.jpg') ? saved : DEFAULT_LOGO);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    apiFetch(`/profile`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setBusinessProfileData(data);
        }
      })
      .catch(() => {});
  }, []);

  const userJson = localStorage.getItem('user');
  let user: any = null;
  try {
    if (userJson) user = JSON.parse(userJson);
  } catch {}

  // Role only. A specific mobile number was hard-coded here as privileged;
  // the server is the authority and now returns a normalized role.
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: language === 'mr' ? 'डॅशबोर्ड' : 'Dashboard' },
    ...(isSuperAdmin ? [{ to: '/admin', icon: ShieldCheck, label: language === 'mr' ? '👑 सर्व व्यवसाय (Super Admin)' : '👑 Super Admin Portal' }] : []),
    { to: '/inventory', icon: Boxes, label: language === 'mr' ? 'धान्य साठा (स्टॉक)' : 'Grain Stock & Sales' },
    { to: '/purchases', icon: ShoppingCart, label: language === 'mr' ? 'खरेदी नोंदी' : 'Purchases' },
    { to: '/farmers', icon: Users, label: language === 'mr' ? 'शेतकरी यादी' : 'Farmers' },
    { to: '/reports', icon: FileText, label: language === 'mr' ? 'अहवाल' : 'Reports' },
    { to: '/profile', icon: User, label: language === 'mr' ? 'प्रोफाइल' : 'Profile' },
    { to: '/settings', icon: Settings, label: language === 'mr' ? 'सेटिंग्ज' : 'Settings' },
  ];

  const location = useLocation();
  const currentPathName = navItems.find(item => item.to === location.pathname)?.label || (language === 'mr' ? 'डॅशबोर्ड' : 'Dashboard');

  const activeBusinessName = user?.businessName || businessProfileData?.businessName || 'Adatya Trader';
  const activeLocation = user?.apmcLocation || businessProfileData?.address || 'APMC Mandi Yard';
  const userName = user?.name || user?.mobile || 'Broker';
  const userInitial = (activeBusinessName?.[0] || userName?.[0] || 'A').toUpperCase();

  return (
    <div
      className={`flex h-screen font-sans text-slate-900 overflow-hidden transition-colors duration-200 ${currentTheme.lightBg}`}
    >
      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-30 md:hidden backdrop-blur-2xs print:hidden"
        />
      )}

      {/* Dynamic Sidebar according to active theme */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 ${currentTheme.sidebarBg} ${currentTheme.sidebarText} flex flex-col h-full shrink-0 shadow-2xl md:shadow-xl transition-transform duration-200 ease-in-out border-r ${currentTheme.sidebarBorder} print:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Adatya Brand & Broker Header */}
        <div className={`p-4 border-b ${currentTheme.sidebarBorder} flex items-center justify-between`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 flex items-center justify-center shrink-0 drop-shadow-md">
              <img
                src={brandLogo}
                alt="Adatya Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <div className="min-w-0">
              <div className="font-serif font-black text-lg tracking-wide text-white leading-tight">
                Adatya
              </div>
              <p className="text-[10px] text-amber-300/90 font-medium tracking-normal truncate">
                Your ledger, your control.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400/80 font-bold mb-1">
            {language === 'mr' ? 'आडत व्यवहार' : 'Broker Navigation'}
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${
                  isActive
                    ? `${currentTheme.sidebarActiveBg} ${currentTheme.sidebarActiveText} font-semibold relative border border-white/10 shadow-xs`
                    : 'text-slate-300/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-amber-400 rounded-r-full" />
                  )}
                  <item.icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? currentTheme.sidebarAccent : 'text-slate-400'}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Profile Link */}
        <div className={`p-3 border-t ${currentTheme.sidebarBorder} space-y-2`}>
          <Link
            to="/profile"
            title="Edit Broker Profile"
            className="px-3 py-2 bg-black/25 hover:bg-black/40 rounded-xl border border-white/10 flex items-center justify-between transition-colors block group"
          >
            <div className="overflow-hidden pr-2">
              <div className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                {userName}
              </div>
              <div className={`text-[10px] ${currentTheme.sidebarAccent} font-semibold uppercase truncate`} title={activeLocation}>
                {activeLocation}
              </div>
            </div>
            <div className="h-7 w-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {userInitial}
            </div>
          </Link>

          <button
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition-colors border border-rose-500/20"
          >
            <LogOut className="h-4 w-4 shrink-0 text-rose-400" />
            {language === 'mr' ? 'सत्र बंद करा (Logout)' : 'Logout Session'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:bg-white print:overflow-visible">
        {/* Top Navbar */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-3 sm:px-8 shrink-0 sticky top-0 z-20 print:hidden shadow-xs pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0">
              <Link to="/profile" className="flex items-center gap-1.5 font-bold text-slate-900 hover:text-emerald-700 transition-colors truncate">
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0 hidden sm:inline" />
                <span className="truncate max-w-[120px] sm:max-w-xs">{activeBusinessName}</span>
              </Link>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-500 font-medium hidden sm:inline">{currentPathName}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Mobile PWA Install Button (Android & iOS) */}
            <PWAInstallButton />

            {/* Bilingual Marathi / English Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-300 hover:border-emerald-600 bg-emerald-50/60 hover:bg-emerald-100/70 text-xs font-bold text-emerald-950 transition-all shadow-2xs"
              title="मराठी / English भाषा बदला (Switch Language)"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-700" />
              <span>{language === 'mr' ? 'मराठी' : 'EN'}</span>
            </button>

            {/* UI Theme Switcher Button */}
            <button
              onClick={() => setIsThemeModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/40 text-xs font-bold text-slate-800 transition-all shadow-xs"
              title="Change UI Theme and Bill Layout"
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: currentTheme.swatches.primary }}
              />
              <Palette className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">{currentTheme.name.split(' ')[0]}</span>
            </button>

            <Link
              to="/profile"
              title="View & Edit Profile"
              className="hidden sm:flex flex-col items-end pl-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-xs font-bold text-slate-900">{userName}</span>
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider truncate max-w-[150px]">
                {activeBusinessName}
              </span>
            </Link>

            <Link
              to="/profile"
              title="View & Edit Profile"
              className="h-8 w-8 rounded-full bg-slate-950 text-amber-300 flex items-center justify-center font-bold text-xs shadow-2xs border border-amber-500/20 hover:scale-105 transition-transform"
            >
              {userInitial}
            </Link>
          </div>
        </header>

        {/* Page Content with safe padding for Mobile Bottom Navigation */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 pb-28 md:pb-8 print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar (Android & iOS Native Experience) */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 print:hidden"
          style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-around relative">
            {/* 1. Dashboard */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-w-[56px] ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-900 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard className={`w-5 h-5 ${isActive ? 'text-emerald-800 stroke-[2.5]' : 'text-slate-500'}`} />
                  <span className="text-[10px] mt-0.5 tracking-tight">
                    {language === 'mr' ? 'डॅशबोर्ड' : 'Home'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 2. Stock / Inventory */}
            <NavLink
              to="/inventory"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-w-[56px] ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-900 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Boxes className={`w-5 h-5 ${isActive ? 'text-emerald-800 stroke-[2.5]' : 'text-slate-500'}`} />
                  <span className="text-[10px] mt-0.5 tracking-tight">
                    {language === 'mr' ? 'धान्य साठा' : 'Stock'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 3. Center Elevated + New Purchase Button */}
            <Link
              to="/purchases/new"
              className="flex flex-col items-center justify-center -mt-6 group"
              title={language === 'mr' ? 'नवीन खरेदी पावती बनवा' : 'New Purchase Slip'}
            >
              <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-950 via-emerald-900 to-emerald-800 text-amber-300 p-0.5 shadow-lg border-2 border-amber-400/80 flex items-center justify-center active:scale-95 transition-transform">
                <Plus className="w-6 h-6 stroke-[3]" />
              </div>
              <span className="text-[10px] font-black text-emerald-950 mt-1 uppercase tracking-wider">
                {language === 'mr' ? 'नवीन पावती' : 'New Bill'}
              </span>
            </Link>

            {/* 4. Purchases */}
            <NavLink
              to="/purchases"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-w-[56px] ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-900 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <ShoppingCart className={`w-5 h-5 ${isActive ? 'text-emerald-800 stroke-[2.5]' : 'text-slate-500'}`} />
                  <span className="text-[10px] mt-0.5 tracking-tight">
                    {language === 'mr' ? 'खरेदी' : 'Purchases'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 5. Farmers */}
            <NavLink
              to="/farmers"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-w-[56px] ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-900 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Users className={`w-5 h-5 ${isActive ? 'text-emerald-800 stroke-[2.5]' : 'text-slate-500'}`} />
                  <span className="text-[10px] mt-0.5 tracking-tight">
                    {language === 'mr' ? 'शेतकरी' : 'Farmers'}
                  </span>
                </>
              )}
            </NavLink>
          </div>
        </nav>

        {/* Safe Logout Confirmation Modal Dialog */}
        {isLogoutConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-bold text-center text-slate-900">
                {language === 'mr' ? 'सत्र बंद (Logout) करायचे आहे का?' : 'Confirm Logout?'}
              </h3>
              <p className="text-xs text-center text-slate-500 mt-1.5">
                {language === 'mr'
                  ? 'तुम्ही सुरक्षितपणे सिस्टीममधून बाहेर पडाल. पुन्हा लॉग इन करण्यासाठी मोबाईल नंबर व पासवर्ड आवश्यक असेल.'
                  : 'You will be securely signed out of your Adatya account. You can log back in anytime with your mobile number.'}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                >
                  {language === 'mr' ? 'रद्द करा (Cancel)' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {language === 'mr' ? 'हो, लॉगआउट करा' : 'Yes, Log Out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
