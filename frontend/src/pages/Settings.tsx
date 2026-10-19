import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'motion/react';
import {
  Building2,
  PenTool,
  CheckCircle2,
  Phone,
  MapPin,
  Eye,
  Palette,
  Check,
  User,
  Sparkles,
  Database,
  Download,
  Upload,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import ThemeSelectorModal from '../components/ThemeSelectorModal';
import { Link } from 'react-router-dom';
import { useTheme, THEMES, AppThemeId, BillStyleId } from '../context/ThemeContext';
import { OFFICIAL_LOGO_SRC, OFFICIAL_LOGO_DETAILS } from '../config/logos';
import { apiFetch } from '../lib/api';


export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    themeId,
    setThemeId,
    billStyle,
    setBillStyle,
    isThemeModalOpen,
    setIsThemeModalOpen
  } = useTheme();

  const [formData, setFormData] = useState({
    businessName: '',
    proprietorName: '',
    address: '',
    mobile1: '',
    mobile2: '',
    signatureData: null as string | null,
    signatureType: 'upload',
    signatureName: '',
  });

  const [backupStats, setBackupStats] = useState<any>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBackupStats = () => {
    apiFetch(`/backup/stats`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setBackupStats(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBackupStats();
  }, []);

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupMsg(null);
      const res = await apiFetch(`/backup/export`);
      if (!res.ok) throw new Error('Backup download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adatya_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setBackupMsg({ type: 'success', text: 'बॅकअप फाईल सुरक्षितपणे डाऊनलोड झाली! (Backup exported successfully)' });
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message || 'Error exporting backup' });
    } finally {
      setBackupLoading(false);
    }
  };

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setIsRestoreConfirmOpen(true);
    e.target.value = '';
  };

  const confirmRestoreBackup = async () => {
    if (!pendingFile) return;
    setIsRestoreConfirmOpen(false);
    try {
      setBackupLoading(true);
      setBackupMsg(null);
      const text = await pendingFile.text();
      const json = JSON.parse(text);

      const res = await apiFetch(`/backup/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The server requires this phrase before it will replace live records.
        body: JSON.stringify({ ...json, confirm: 'RESTORE' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBackupMsg({ type: 'success', text: 'बॅकअप यशस्वीरीत्या रिस्टोअर झाला! सर्व जुना डेटा पूर्ववत झाला.' });
        fetchBackupStats();
      } else {
        throw new Error(data.error || 'Failed to restore backup');
      }
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: 'बॅकअप रिस्टोअर त्रुटी: ' + (err.message || String(err)) });
    } finally {
      setBackupLoading(false);
      setPendingFile(null);
    }
  };

  useEffect(() => {
    apiFetch(`/profile`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setFormData(prev => ({
            ...prev,
            businessName: data.businessName || '',
            proprietorName: data.proprietorName || '',
            address: data.address || '',
            mobile1: data.mobile1 || '',
            mobile2: data.mobile2 || '',
            signatureData: data.signatureData || null,
            signatureType: 'upload',
            signatureName: data.signatureName || '',
          }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSignature = (sigData: string, type: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      signatureData: sigData,
      signatureType: 'upload',
      signatureName: name
    }));
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await apiFetch(`/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSaveSuccess(true);
        // Sync local storage user
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const u = JSON.parse(userStr);
            u.businessName = formData.businessName;
            u.name = formData.proprietorName;
            u.apmcLocation = formData.address;
            localStorage.setItem('user', JSON.stringify(u));
          }
        } catch {}
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage('Failed to save profile. Please check your network.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Error connecting to server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 font-serif">Settings & Profile</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage business profile, signature, and theme options</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/profile">
            <Button variant="outline" size="sm" className="bg-white border-slate-300 text-slate-800 text-xs">
              <User className="w-3.5 h-3.5 mr-1.5 text-emerald-700" /> Edit Profile
            </Button>
          </Link>
          <Button
            onClick={() => setIsThemeModalOpen(true)}
            variant="outline"
            size="sm"
            className="border-slate-300 text-slate-800 bg-white hover:bg-slate-50 text-xs"
          >
            <Palette className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Themes
          </Button>
          <Link to="/purchases">
            <Button variant="outline" size="sm" className="bg-white border-slate-300 text-slate-800 text-xs">
              <Eye className="w-3.5 h-3.5 mr-1.5" /> Bills
            </Button>
          </Link>
          <Button
            onClick={() => handleSaveProfile()}
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          Settings and signature saved successfully!
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* SECTION 1: THEME & BILL LAYOUT */}
      <Card className="border border-slate-200/90 shadow-xs bg-white rounded-2xl">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Palette className="h-4 w-4 text-amber-600" />
              Theme & Bill Layout (रंग व पावती पर्याय)
            </CardTitle>
            <Button
              onClick={() => setIsThemeModalOpen(true)}
              size="sm"
              variant="ghost"
              className="text-xs text-amber-800 hover:text-amber-900 h-7"
            >
              Open Switcher
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Color Themes Grid */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              Color Theme (रंग निवडा)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(THEMES) as AppThemeId[]).map((tid) => {
                const t = THEMES[tid];
                const isSelected = themeId === tid;
                return (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => setThemeId(tid)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/40 font-bold'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-900">{t.name.split('&')[0]}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                    </div>
                    <div className="text-[11px] text-amber-800 font-medium mb-2">{t.nameMr}</div>
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                      <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: t.swatches.primary }} />
                      <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: t.swatches.accent }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bill Layout Options - ONLY 2 Options: Royal Frame & Vyapari Patrika */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              Bill Voucher Layout (पावती प्रकार)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'royal-framed', title: 'Royal Mandi Double Frame', mr: 'शाही दुहेरी फ्रेम' },
                { id: 'traditional-patrika', title: 'Traditional Vyapari Patrika', mr: 'पारंपरिक व्यापारी पावती' },
              ].map((style) => {
                const isSelected = billStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setBillStyle(style.id as BillStyleId)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/30 ring-1 ring-emerald-600/30 font-bold'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{style.title}</div>
                      <div className="text-[11px] text-emerald-800 font-medium">{style.mr}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION: OFFICIAL BRAND LOGO (अधिकृत मूळ लोगो - Transparent & Royal Theme Compatible) */}
      <Card className="border border-slate-200/90 shadow-xs bg-white rounded-2xl">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Adatya Official Brand Logo (अधिकृत लोगो)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Original luxury emerald & gold emblem with transparent background, active across all invoices, bills, and navigation headers.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-800 self-start sm:self-auto">
              <span>✓ Active Official Logo</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-2xl bg-slate-50/70 border border-slate-200 rounded-2xl p-5">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Dual Theme Mockups: Light Mode & Dark Mode */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Light Theme Mockup */}
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-slate-200 p-2 flex items-center justify-center shadow-xs">
                    <img
                      src={OFFICIAL_LOGO_SRC}
                      alt="Adatya Logo on Light"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain filter drop-shadow-sm"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-1.5 uppercase tracking-wider">
                    Light Theme
                  </span>
                </div>

                {/* Dark / Royal Theme Mockup */}
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-2xl bg-[#04251a] border-2 border-emerald-900/60 p-2 flex items-center justify-center shadow-sm">
                    <img
                      src={OFFICIAL_LOGO_SRC}
                      alt="Adatya Logo on Dark Royal"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain filter drop-shadow"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 mt-1.5 uppercase tracking-wider">
                    Royal Theme
                  </span>
                </div>
              </div>

              {/* Details & Info */}
              <div className="space-y-2 text-center md:text-left">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  Official Luxury Mandi Emblem
                </div>
                <h4 className="text-base font-serif font-black text-slate-900">
                  {OFFICIAL_LOGO_DETAILS.name}
                </h4>
                <div className="text-xs font-semibold text-emerald-800">
                  {OFFICIAL_LOGO_DETAILS.nameMr}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {OFFICIAL_LOGO_DETAILS.description}
                </p>
                <div className="pt-2 text-[11px] font-bold text-slate-500 flex items-center gap-1 justify-center md:justify-start">
                  <span className="text-emerald-600 font-black">✓</span> Automatically embedded on every printed invoice, WhatsApp PDF bill, and voucher.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: OFFICIAL SIGNATURE (ONLY UPLOAD & NAME) */}
      <Card className="border border-slate-200/90 shadow-xs bg-white rounded-2xl">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <PenTool className="h-4 w-4 text-emerald-600" />
            Official Bill Signature (स्वाक्षरी)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <SignaturePad
            initialSignature={formData.signatureData}
            initialName={formData.signatureName}
            onSave={(sigData, type, name) => {
              handleSaveSignature(sigData, type, name);
              setTimeout(() => {
                handleSaveProfile();
              }, 50);
            }}
          />
        </CardContent>
      </Card>

      {/* SECTION 3: BUSINESS DETAILS */}
      <form onSubmit={handleSaveProfile}>
        <Card className="border border-slate-200/90 shadow-xs bg-white rounded-2xl">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-700" />
              Business Details (व्यापार तपशील)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Business Name (नाव)
                </label>
                <Input
                  value={formData.businessName}
                  onChange={e => handleInputChange('businessName', e.target.value)}
                  placeholder="e.g. Shree Ganesh Agro Traders"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Proprietor / Owner Name (मालक)
                </label>
                <Input
                  value={formData.proprietorName}
                  onChange={e => handleInputChange('proprietorName', e.target.value)}
                  placeholder="e.g. Ramesh Patil"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Address (पत्ता)
              </label>
              <Input
                value={formData.address}
                onChange={e => handleInputChange('address', e.target.value)}
                placeholder="e.g. APMC Yard, Latur - 413512"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> Primary Mobile
                </label>
                <Input
                  value={formData.mobile1}
                  onChange={e => handleInputChange('mobile1', e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> Secondary Mobile
                </label>
                <Input
                  value={formData.mobile2}
                  onChange={e => handleInputChange('mobile2', e.target.value)}
                  placeholder="Alternate mobile (optional)"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 shadow-xs"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Production-Grade Data Safety & Backup Management */}
      <Card className="rounded-2xl border-emerald-200/90 bg-gradient-to-br from-white via-emerald-50/20 to-white shadow-xs overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-emerald-100 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center shadow-2xs">
              <Database className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-950 flex items-center gap-2">
                डेटा सुरक्षा व संपूर्ण बॅकअप (Data Safety & Backups)
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 inline" /> कायमस्वरूपी सुरक्षित (Persistent)
                </span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                सर्व खरेदी नोंदी, शेतकरी हिशोब आणि मंडी व्यवहार सुरक्षित ठेवा व कधीही डाऊनलोड करा.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchBackupStats}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline self-start sm:self-auto"
          >
            रिफ्रेश आकडेवारी
          </button>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Status Message */}
          {backupMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${
              backupMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              {backupMsg.text}
            </div>
          )}

          {/* Assurance Banner */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              भविष्यातील अपडेट्स किंवा बदलांनंतरही डेटा कधीही गमावला जाणार नाही
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed pl-5.5">
              अ‍ॅप्लिकेशनमध्ये नवीन फीचर्स जोडताना किंवा कोड बदलताना तुमचा स्थानिक डेटाबेस (SQLite) अखंडित राहतो. अतिरिक्त सुरक्षिततेसाठी तुम्ही कधीही संपूर्ण डेटाचा JSON बॅकअप डाऊनलोड करून ठेवू शकता.
            </p>
          </div>

          {/* Current Database Summary Grid */}
          {backupStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">खरेदी पावत्या</div>
                <div className="text-lg font-black text-slate-900 font-serif mt-0.5">{backupStats.counts?.purchases || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">नोंदणीकृत शेतकरी</div>
                <div className="text-lg font-black text-slate-900 font-serif mt-0.5">{backupStats.counts?.farmers || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">मंडी विक्री नोंदी</div>
                <div className="text-lg font-black text-slate-900 font-serif mt-0.5">{backupStats.counts?.mandiSales || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">पेमेंट नोंदी</div>
                <div className="text-lg font-black text-slate-900 font-serif mt-0.5">{backupStats.counts?.payments || 0}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              type="button"
              disabled={backupLoading}
              onClick={handleDownloadBackup}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              {backupLoading ? 'डाऊनलोड करत आहे...' : 'डाऊनलोड बॅकअप फाईल (Export JSON)'}
            </Button>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                disabled={backupLoading}
                onChange={handleFileSelected}
                className="hidden"
              />
              <div className="h-10 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs flex items-center justify-center gap-2 transition-colors">
                <Upload className="w-4 h-4 text-slate-600 stroke-[2.5]" />
                {backupLoading ? 'प्रक्रिया सुरू आहे...' : 'बॅकअप रिस्टोअर करा (Restore JSON)'}
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* In-App Safe Restore Confirmation Dialog */}
      {isRestoreConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-bold text-center text-slate-900">
              बॅकअप रिस्टोअर करायचा आहे का?
            </h3>
            <p className="text-xs text-center text-slate-500 mt-1.5 leading-relaxed">
              तुम्ही निवडलेली फाईल: <strong className="text-slate-800">{pendingFile?.name}</strong>. या फाईलनुसार जुना डेटाबेस रिस्टोअर केला जाईल.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsRestoreConfirmOpen(false);
                  setPendingFile(null);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={confirmRestoreBackup}
                className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                हो, रिस्टोअर करा
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
