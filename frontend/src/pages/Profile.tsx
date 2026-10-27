import React, { useState, useEffect, FormEvent } from 'react';
import { MobileInput } from '../components/ui';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  User,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  Lock,
  FileBadge,
  QrCode,
  Save,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { apiFetch, clearSession } from '../lib/api';


export default function Profile() {
  const { currentTheme } = useTheme();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleLogout = () => {
    clearSession();
    window.dispatchEvent(new Event('storage'));
    navigate('/login', { replace: true });
    setTimeout(() => {
      window.location.href = '/login';
    }, 50);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your current password to confirm deletion.');
      return;
    }
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE exactly to confirm.');
      return;
    }

    setDeletingAccount(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`/account/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No userId is sent: the server deletes the account the token belongs to.
        body: JSON.stringify({ password: deletePassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      } else {
        setDeleteError(data.error || 'Failed to delete account. Please try again.');
      }
    } catch {
      setDeleteError('Network error. Please check your connection.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    businessName: '',
    proprietorName: '',
    address: '',
    mobile1: '',
    mobile2: '',
    mandiLicense: '',
    gstin: '',
    upiId: '',
    tagline: 'Your ledger, your control.',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    let localUser: any = null;
    try {
      if (userStr) localUser = JSON.parse(userStr);
    } catch {}

    apiFetch(`/profile`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setProfileData(prev => ({
            ...prev,
            businessName: localUser?.businessName || data.businessName || 'Adatya Trader',
            proprietorName: localUser?.name || data.proprietorName || 'Broker',
            address: localUser?.apmcLocation || data.address || 'APMC Mandi Yard',
            mobile1: localUser?.mobile || data.mobile1 || '',
            mobile2: data.mobile2 || '',
            mandiLicense: data.mandiLicense || 'APMC/REG/2024',
            gstin: data.gstin || '',
            upiId: data.upiId || '',
            tagline: data.tagline || 'Your ledger, your control.',
          }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (profileData.newPassword) {
      if (!profileData.currentPassword) {
        setErrorMessage('Enter your current password to set a new one');
        setSaving(false);
        return;
      }
      if (profileData.newPassword.length < 8) {
        setErrorMessage('New password must be at least 8 characters and include a letter and a number');
        setSaving(false);
        return;
      }
      if (profileData.newPassword !== profileData.confirmPassword) {
        setErrorMessage('Passwords do not match');
        setSaving(false);
        return;
      }
    }

    try {
      const userStr = localStorage.getItem('user');
      let localUser: any = null;
      try {
        if (userStr) localUser = JSON.parse(userStr);
      } catch {}

      const res = await apiFetch(`/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No userId: the server updates the account the token belongs to.
        body: JSON.stringify({
          mobile: profileData.mobile1,
          name: profileData.proprietorName,
          businessName: profileData.businessName,
          address: profileData.address,
          mobile2: profileData.mobile2,
          mandiLicense: profileData.mandiLicense,
          gstin: profileData.gstin,
          upiId: profileData.upiId,
          newPassword: profileData.newPassword || undefined,
          currentPassword: profileData.currentPassword || undefined,
        })
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        // Sync local storage user
        if (localUser) {
          localUser.businessName = profileData.businessName;
          localUser.name = profileData.proprietorName;
          localUser.apmcLocation = profileData.address;
          localStorage.setItem('user', JSON.stringify(localUser));
        }

        setSuccessMessage('Profile and business details updated successfully!');
        setProfileData(prev => ({ ...prev, newPassword: '', confirmPassword: '', currentPassword: '' }));
        setTimeout(() => setSuccessMessage(null), 3500);
      } else {
        setErrorMessage(resData.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error while saving profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="w-9 h-9 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg border border-amber-300/40 shrink-0">
            {profileData.businessName?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-white truncate">
                {profileData.businessName || 'My Mandi Firm'}
              </h1>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full shrink-0">
                Adatya Desk
              </span>
            </div>
            <p className="text-xs text-amber-200/90 font-medium mt-0.5 truncate">
              {profileData.proprietorName} · {profileData.address || 'APMC Yard'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 px-4 shadow-md flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Firm & Broker Identity */}
        <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-700" />
              {t('firm_broker_identity')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              This firm name appears on the dashboard, purchase vouchers, and farmer bills.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  {t('firm_business_name')} <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  value={profileData.businessName}
                  onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                  placeholder={t('e_g_shree_ganesh_agro_traders_2')}
                  className="h-10 text-xs font-bold bg-slate-50 border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  {t('broker_proprietor_name')} <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  value={profileData.proprietorName}
                  onChange={(e) => setProfileData({ ...profileData, proprietorName: e.target.value })}
                  placeholder={t('e_g_maroti_v_bodhale')}
                  className="h-10 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {t('business_tagline_subtitle')}
              </label>
              <Input
                type="text"
                value={profileData.tagline}
                onChange={(e) => setProfileData({ ...profileData, tagline: e.target.value })}
                placeholder="Authorised Agricultural Commodity Purchaser & Mandi Commission Agent"
                className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Mandi Location & APMC License */}
        <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-700" />
              {t('mandi_yard_apmc_location')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Address and APMC yard printed at the bottom and header of the farmer bill.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {t('apmc_mandi_market_yard_address')}
              </label>
              <Input
                type="text"
                value={profileData.address}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                placeholder={t('e_g_apmc_yard_latur_413512')}
                className="h-10 text-xs font-medium bg-slate-50 border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileBadge className="w-3.5 h-3.5 text-slate-500" />
                  {t('mandi_license_no')}
                </label>
                <Input
                  type="text"
                  value={profileData.mandiLicense}
                  onChange={(e) => setProfileData({ ...profileData, mandiLicense: e.target.value })}
                  placeholder={t('e_g_apmc_xxx_2026_00')}
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t('gstin')}
                </label>
                <Input
                  type="text"
                  value={profileData.gstin}
                  onChange={(e) => setProfileData({ ...profileData, gstin: e.target.value.toUpperCase() })}
                  placeholder="27AAAAA0000A1Z5"
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300 uppercase"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Contact & UPI Payment */}
        <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-700" />
              {t('contact_payment_details')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Numbers used for WhatsApp bill sending and UPI payment receipt.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t('primary_mobile')} <span className="text-rose-500">*</span>
                </label>
                <MobileInput
                  required
                  value={profileData.mobile1}
                  onValueChange={(v) => setProfileData({ ...profileData, mobile1: v })}
                  placeholder={t('k_10_digit_mobile_number')}
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t('alternate_mobile')}
                </label>
                <MobileInput
                  value={profileData.mobile2}
                  onValueChange={(v) => setProfileData({ ...profileData, mobile2: v })}
                  placeholder={t('alternate_mobile_optional')}
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-slate-500" />
                  {t('upi_id')}
                </label>
                <Input
                  type="text"
                  value={profileData.upiId}
                  onChange={(e) => setProfileData({ ...profileData, upiId: e.target.value })}
                  placeholder="yourname@upi"
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Security (Change Password) */}
        <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-700" />
              {t('security_password')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Leave empty if you do not wish to change your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t('current_password')}
                </label>
                <Input
                  type="password"
                  value={profileData.currentPassword}
                  onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                  placeholder="Required only when changing your password"
                  autoComplete="current-password"
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t('new_password')}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={profileData.newPassword}
                    onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                    placeholder="Min 8 chars, letter + number"
                    className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t('confirm_new_password')}
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={profileData.confirmPassword}
                  onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                  className="h-9.5 text-xs font-medium bg-slate-50 border-slate-300"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-6 shadow-md flex items-center gap-2"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            {saving ? 'Saving Profile...' : 'Save Profile Changes'}
          </Button>
        </div>
      </form>

      {/* Account Session & Logout Card */}
      <Card className="rounded-2xl border-rose-200/80 bg-rose-50/30 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-rose-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LogOut className="h-4 w-4 text-rose-600" />
              {t('account_session_sign_out')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Securely sign out of your Adatya account on this device.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            Current Active Session: <strong className="text-slate-900 font-bold">{profileData.proprietorName || profileData.businessName}</strong> ({profileData.mobile1})
          </div>
          <Button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs flex items-center gap-2 shrink-0 transition-transform active:scale-95"
          >
            <LogOut className="w-4 h-4 stroke-[2.5]" />
            {t('sign_out_logout')}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone — Delete Account Card */}
      <Card className="rounded-2xl border-red-300 bg-red-50/20 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-red-200">
          <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            {t('danger_zone_delete_account')}
          </CardTitle>
          <CardDescription className="text-xs text-red-700/80 mt-0.5 font-medium">
            This will permanently delete your account, all farmers, purchases, mandi sales, inventory, and business data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            ⚠️ All data will be <strong className="text-red-700">permanently erased</strong> from the database. You will be logged out immediately after deletion.
          </div>
          <Button
            type="button"
            onClick={() => { setIsDeleteModalOpen(true); setDeleteError(''); setDeletePassword(''); setDeleteConfirmText(''); }}
            variant="outline"
            className="border-red-400 text-red-700 hover:bg-red-100 font-bold text-xs h-9 px-5 rounded-xl flex items-center gap-2 shrink-0 transition-transform active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            {t('delete_my_account')}
          </Button>
        </CardContent>
      </Card>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-bold text-center text-slate-900">
              {t('confirm_logout')}
            </h3>
            <p className="text-xs text-center text-slate-500 mt-1.5 leading-relaxed">
              {t('you_will_be_securely_signed_out_of_your_adat_2')}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setIsLogoutModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5">
                <LogOut className="w-3.5 h-3.5" />
                {t('yes_log_out')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black text-center text-red-800">
              {t('permanently_delete_account')}
            </h3>
            <p className="text-xs text-center text-slate-600 mt-2 leading-relaxed">
              This will <strong className="text-red-700">permanently erase</strong> all your farmers, purchases, mandi sales, inventory, and account data from the database. <strong>This cannot be undone.</strong>
            </p>

            <div className="mt-5 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('current_password_2')}</label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="h-10 text-xs font-medium border-red-300 focus:ring-red-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Type <span className="font-black text-red-700">DELETE</span> to confirm
                </label>
                <Input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE here"
                  className="h-10 text-xs font-black tracking-widest border-red-300 focus:ring-red-400"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button type="button"
                onClick={() => { setIsDeleteModalOpen(false); setDeleteError(''); }}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors">
                Cancel
              </button>
              <button type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE' || !deletePassword}
                className="w-full py-2.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {deletingAccount ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
