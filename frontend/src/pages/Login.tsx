import React, { useState, FormEvent } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Phone, Eye, EyeOff, ShieldCheck, ArrowRight, Wheat, Loader2, User, UserPlus, LogIn, Building2 } from 'lucide-react';
import { publicPost, setSession } from '../lib/api';
import { MobileInput } from '../components/ui';

export default function Login() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login Form State
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Form State (clean & minimal: firm name, owner name, mobile, password)
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { ok, data } = await publicPost('/auth/login', {
        mobile: loginMobile.trim(),
        password: loginPassword
      });

      if (ok && data?.success && data.token && data.user) {
        setSession(data.token, data.user);
        window.location.href = '/';
        return;
      }

      setError(data?.error || 'Invalid credentials. Please verify and try again.');
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!regBusinessName.trim()) {
      setError('Please enter your Firm / Business Name');
      setLoading(false);
      return;
    }

    if (regMobile.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      setLoading(false);
      return;
    }

    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters and include a letter and a number');
      setLoading(false);
      return;
    }

    try {
      // "role" is no longer sent: the server assigns it. It used to be accepted
      // from this payload, which allowed self-promotion to SUPER_ADMIN.
      const { ok, data } = await publicPost('/auth/register', {
        businessName: regBusinessName.trim(),
        name: regName.trim() || regBusinessName.trim(),
        apmcLocation: 'APMC Mandi Yard',
        mobile: regMobile.trim(),
        password: regPassword
      });

      if (ok && data?.success && data.token && data.user) {
        setSuccessMessage('Broker account created! Logging you into Adatya...');
        setSession(data.token, data.user);
        setTimeout(() => {
          window.location.href = '/';
        }, 600);
        return;
      }

      setError(data?.error || 'Failed to create account. Mobile may already be registered.');
    } catch (err) {
      // There is no offline fallback any more. Registration previously wrote a
      // fabricated user into local storage and let the person in with no
      // server-side account at all.
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative px-4 py-8">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-900 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white rounded-3xl p-6 sm:p-9 shadow-2xl border border-slate-200">
          {/* Adatya Brand Header */}
          <div className="text-center mb-6">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-800 to-slate-950 rounded-2xl shadow-md p-2 flex items-center justify-center mb-3 text-amber-400 border border-emerald-700/50">
              <Wheat className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl font-serif font-black text-slate-950 tracking-tight">
              Adatya
            </h1>
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
              Your ledger, your control.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('mandi_procurement_invoicing_portal')}
            </p>
          </div>

          {/* Segment Tabs: Sign In / Create Account */}
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                tab === 'login'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> {t('sign_in')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                tab === 'register'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> {t('create_account')}
            </button>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium text-center">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 mb-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-medium text-center">
              {successMessage}
            </div>
          )}

          <AnimatePresence mode="wait">
            {tab === 'login' ? (
              /* SIGN IN FORM */
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile / Username
                  </label>
                  <MobileInput
                    required
                    value={loginMobile}
                    onValueChange={setLoginMobile}
                    placeholder="10-digit mobile number"
                    className="h-11 bg-slate-50 border-slate-300 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" /> Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-11 bg-slate-50 border-slate-300 pr-10 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* The rule used to surface only after a rejected submit. */}
                  <p className={`text-[11px] ${
                    regPassword && regPassword.length >= 8 && /[A-Za-z]/.test(regPassword) && /\d/.test(regPassword)
                      ? 'text-emerald-700 font-medium'
                      : 'text-slate-500'
                  }`}>
                    At least 8 characters, with one letter and one number
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded-xl text-sm shadow-md mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                    </>
                  ) : (
                    <>
                      Sign In to Adatya <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              /* CREATE ACCOUNT FORM (MINIMAL FOR BROKERS: FIRM NAME, OWNER NAME, MOBILE, STANDARD PASSWORD) */
              <motion.form
                key="register-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleRegister}
                className="space-y-3.5"
              >
                {/* 1. Firm / Business Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    {t('firm_business_name')} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    placeholder={t('e_g_shree_ganesh_agro_traders')}
                    className="h-10 bg-slate-50 border-slate-300 font-semibold text-xs"
                  />
                  <p className="text-[10px] text-slate-500">
                    This firm name appears on your dashboard, vouchers, and bills.
                  </p>
                </div>

                {/* 2. Broker / Owner Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {t('broker_proprietor_name')}
                  </label>
                  <Input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={t('e_g_rahul_deshmukh')}
                    className="h-10 bg-slate-50 border-slate-300 font-medium text-xs"
                  />
                </div>

                {/* 3. 10-Digit Mobile */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {t('mobile_number')} <span className="text-rose-500">*</span>
                  </label>
                  <MobileInput
                    required
                    value={regMobile}
                    onValueChange={setRegMobile}
                    placeholder="9876543210"
                    className="h-10 bg-slate-50 border-slate-300 font-medium text-xs"
                  />
                </div>

                {/* 4. Standard Password Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    {t('password')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Enter password"
                      className="h-10 bg-slate-50 border-slate-300 pr-10 font-medium text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-sm shadow-md mt-3 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Setting up Adatya Desk...
                    </>
                  ) : (
                    <>
                      Create Broker Account & Sign In <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Secure Badge */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 pt-3.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Adatya · Mandi Procurement & Invoicing Desk
          </div>
        </div>
      </motion.div>
    </div>
  );
}
