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
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import FirstRunSetup, { hasCompletedSetup, wasSetupSkipped } from '../components/FirstRunSetup';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { DEFAULT_LOGO } from '../config/logos';
import { apiFetch, clearSession } from '../lib/api';


export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [businessProfileData, setBusinessProfileData] = useState<any>(null);
  const [showSetup, setShowSetup] = useState(false);

  const handleLogout = () => {
    clearSession();
    window.dispatchEvent(new Event('storage'));
    window.location.href = '/login';
  };
  // The logo is a bundled asset, not user data, so it is used directly rather
  // than cached in local storage. The old cache held the broken
  // '/src/assets/...' dev path and would have kept serving it after this fix.
  const brandLogo = DEFAULT_LOGO;

  useEffect(() => {
    try {
      localStorage.removeItem('adatya_logo');
    } catch {
      /* storage unavailable; nothing to clean up */
    }
  }, []);

  useEffect(() => {
    apiFetch(`/profile`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setBusinessProfileData(data);
          // First sign-in: no signatory name or signature yet, so bills would
          // print unsigned. Ask once, and respect a previous skip.
          if (!hasCompletedSetup(data) && !wasSetupSkipped()) {
            setShowSetup(true);
          }
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
    { to: '/', icon: LayoutDashboard, label: t('dashboard') },
    ...(isSuperAdmin ? [{ to: '/admin', icon: ShieldCheck, label: t('super_admin_portal') }] : []),
    { to: '/inventory', icon: Boxes, label: t('grain_stock_sales') },
    { to: '/purchases', icon: ShoppingCart, label: t('purchases') },
    { to: '/farmers', icon: Users, label: t('farmers') },
    { to: '/reports', icon: FileText, label: t('reports') },
    { to: '/profile', icon: User, label: t('profile') },
    { to: '/settings', icon: Settings, label: t('settings') },
  ];

  const location = useLocation();
  const currentPathName = navItems.find(item => item.to === location.pathname)?.label || (t('dashboard'));

  const activeBusinessName = user?.businessName || businessProfileData?.businessName || 'Adatya Trader';
  const activeLocation = user?.apmcLocation || businessProfileData?.address || 'APMC Mandi Yard';
  const userName = user?.name || user?.mobile || 'Broker';
  const userInitial = (activeBusinessName?.[0] || userName?.[0] || 'A').toUpperCase();

  return (
    <>
      {showSetup && (
        <FirstRunSetup profile={businessProfileData} onDone={() => setShowSetup(false)} />
      )}
    <div
      className={`flex h-screen font-sans text-slate-900 overflow-hidden transition-colors duration-200 ${currentTheme.lightBg}`}
    >
      {/* Theme Selector Modal */}

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
            {t('broker_navigation')}
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
            {t('logout_session')}
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

            {/* Marathi / Hindi / English. A real choice rather than a
                two-way toggle, now that three languages are supported. */}
            <div className="flex items-center gap-1 rounded-control border border-line bg-surface p-0.5">
              <Languages className="ml-1 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
              {LANGUAGES.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLanguage(option.id)}
                  aria-pressed={language === option.id}
                  aria-label={`Switch to ${option.englishLabel}`}
                  className={
                    'rounded px-2 py-1 text-2xs font-semibold transition-colors ' +
                    (language === option.id
                      ? 'bg-brand-700 text-ink-inverted'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink')
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>

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
                    {t('home')}
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
                    {t('stock')}
                  </span>
                </>
              )}
            </NavLink>

            {/* 3. Center Elevated + New Purchase Button */}
            <Link
              to="/purchases/new"
              className="flex flex-col items-center justify-center -mt-6 group"
              title={t('new_purchase_slip')}
            >
              <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-950 via-emerald-900 to-emerald-800 text-amber-300 p-0.5 shadow-lg border-2 border-amber-400/80 flex items-center justify-center active:scale-95 transition-transform">
                <Plus className="w-6 h-6 stroke-[3]" />
              </div>
              <span className="text-[10px] font-black text-emerald-950 mt-1 uppercase tracking-wider">
                {t('new_bill')}
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
                    {t('purchases_2')}
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
                    {t('farmers_2')}
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
                {t('confirm_logout')}
              </h3>
              <p className="text-xs text-center text-slate-500 mt-1.5">
                {t('you_will_be_securely_signed_out_of_your_adat')}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t('yes_log_out')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </>
  );
}
