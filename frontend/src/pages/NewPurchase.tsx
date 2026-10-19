import React, { useEffect, useRef, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { formatCurrency } from '../lib/utils';
import { Plus, Trash2, ArrowLeft, Wheat, User, Calendar, Tag, UserPlus, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch, newRequestKey } from '../lib/api';


export default function NewPurchase() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [commodities, setCommodities] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    farmerId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    purchaseNumber: `INV-${Date.now().toString().slice(-6)}`,
    advancePaid: 0,
    paymentMode: 'Cash'
  });

  const [items, setItems] = useState<any[]>([
    { id: Date.now(), commodityId: '', customCommodityName: '', quantity: 0, rate: 0, amount: 0 }
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestKeyRef = useRef<string | null>(null);

  // Quick Inline Farmer Creation Modal
  const [isNewFarmerModalOpen, setIsNewFarmerModalOpen] = useState(false);
  const [quickFarmer, setQuickFarmer] = useState({ name: '', village: '', mobile: '' });
  const [savingQuickFarmer, setSavingQuickFarmer] = useState(false);

  const handleQuickCreateFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFarmer.name.trim()) return;
    setSavingQuickFarmer(true);
    try {
      const res = await apiFetch(`/farmers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickFarmer)
      });
      const created = await res.json();
      if (res.ok) {
        setFarmers(prev => [created, ...prev]);
        setFormData(prev => ({ ...prev, farmerId: created.id.toString() }));
        setIsNewFarmerModalOpen(false);
        setQuickFarmer({ name: '', village: '', mobile: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingQuickFarmer(false);
    }
  };

  useEffect(() => {
    apiFetch(`/farmers`).then(res => res.json()).then(data => { if (Array.isArray(data)) setFarmers(data); });
    apiFetch(`/commodities`).then(res => res.json()).then(data => { if (Array.isArray(data)) setCommodities(data); });
  }, []);

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'commodityId') {
      if (value === 'other') {
        newItems[index].customCommodityName = newItems[index].customCommodityName || '';
      } else {
        const com = commodities.find(c => c.id.toString() === value.toString());
        if (com) {
          newItems[index].rate = com.defaultRate;
          newItems[index].customCommodityName = '';
        }
      }
    }

    if (field === 'quantity' || field === 'rate' || field === 'commodityId') {
      newItems[index].amount = (parseFloat(newItems[index].quantity || 0) * parseFloat(newItems[index].rate || 0));
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), commodityId: '', customCommodityName: '', quantity: 0, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const remainingAmount = totalAmount - (formData.advancePaid || 0);

  // Disable Add Item & Save if any row is missing commodity or valid quantity
  const hasIncompleteItem = items.some(it => !it.commodityId || !(parseFloat(it.quantity) > 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.farmerId) {
      setErrorMsg(language === 'mr' ? 'कृपया शेतकरी निवडा' : 'Please select a farmer');
      return;
    }

    // Check if any "other" commodity has empty custom name
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.commodityId === 'other' && !it.customCommodityName?.trim()) {
        setErrorMsg(language === 'mr' ? `कृपया आयटम #${i + 1} साठी धान्याचे नाव टाका` : `Please enter the grain name for item #${i + 1}`);
        return;
      }
      if (!it.commodityId) {
        setErrorMsg(language === 'mr' ? `कृपया आयटम #${i + 1} साठी धान्य निवडा` : `Please select commodity for item #${i + 1}`);
        return;
      }
      if (!it.quantity || it.quantity <= 0) {
        setErrorMsg(language === 'mr' ? `कृपया आयटम #${i + 1} साठी योग्य वजन टाका` : `Please enter valid quantity for item #${i + 1}`);
        return;
      }
    }

    // Kept across retries of this same bill, so a double tap after a slow
    // response returns the original rather than booking a second purchase.
    if (!requestKeyRef.current) {
      requestKeyRef.current = newRequestKey();
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          clientRequestId: requestKeyRef.current,
          items: items.map(it => ({
            commodityId: it.commodityId,
            customCommodityName: it.commodityId === 'other' ? it.customCommodityName?.trim() : undefined,
            quantity: Number(it.quantity),
            rate: Number(it.rate)
          }))
        })
      });
      if (res.ok) {
        const data = await res.json();
        requestKeyRef.current = null;
        navigate(`/invoice/${data.id}`);
      } else {
        setErrorMsg(language === 'mr' ? 'खरेदी नोंदवण्यात त्रुटी आली. कृपया तपासा.' : 'Failed to save purchase. Please check entered values.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(language === 'mr' ? 'सर्व्हर जोडणी त्रुटी.' : 'Network error while saving purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-slate-950">
            {language === 'mr' ? 'नवीन खरेदी पावती नोंदवा' : 'New Purchase Voucher'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'mr' ? 'शेतकऱ्याकडून शेतमाल खरेदीची नवीन पावती बनवा' : 'Record a new commodity purchase voucher from a farmer'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/purchases')} className="text-slate-600 hover:text-slate-900 self-start">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> {language === 'mr' ? 'खरेदी यादीकडे' : 'Back to Purchases'}
        </Button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Voucher Details */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/60">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              {language === 'mr' ? 'पावती तपशील (Basic Details)' : 'Basic Voucher Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {language === 'mr' ? 'पावती क्र. (Invoice No)' : 'Invoice Number'}
              </label>
              <Input
                required
                value={formData.purchaseNumber}
                onChange={e => setFormData({...formData, purchaseNumber: e.target.value})}
                className="h-10 text-xs font-mono font-bold bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {language === 'mr' ? 'तारीख (Date)' : 'Date'}
              </label>
              <Input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="h-10 text-xs font-semibold bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {language === 'mr' ? 'शेतकरी निवडा (Select Farmer)' : 'Select Farmer'} <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewFarmerModalOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300"
                >
                  <UserPlus className="w-3 h-3" />
                  {language === 'mr' ? '+ नवीन जोडा' : '+ New Farmer'}
                </button>
              </div>
              <select
                required
                className="flex h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={formData.farmerId}
                onChange={e => setFormData({...formData, farmerId: e.target.value})}
              >
                <option value="" disabled>
                  {language === 'mr' ? '-- शेतकरी निवडा --' : '-- Choose Farmer --'}
                </option>
                {farmers.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.village ? `(${f.village})` : ''} {f.mobile ? `- ${f.mobile}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Commodities (With Custom / Other Grain Support) */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/60">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-emerald-700" />
              {language === 'mr' ? 'शेतमाल / धान्य नोंदी (Commodities)' : 'Commodities / Crop Items'}
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}
              disabled={hasIncompleteItem}
              title={hasIncompleteItem ? 'Complete the current item row (commodity + quantity) before adding another' : ''}
              className="h-8 text-xs font-bold border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus className="h-3.5 w-3.5 mr-1 text-emerald-700" /> {language === 'mr' ? 'आणखी धान्य जोडा' : 'Add Item'}
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-end gap-3.5">
                    {/* Commodity Dropdown */}
                    <div className="flex-1 space-y-1.5 min-w-[220px]">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-slate-500" />
                        {language === 'mr' ? `धान्य #${index + 1}` : `Commodity #${index + 1}`}
                      </label>
                      <select 
                        required
                        className="flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        value={item.commodityId}
                        onChange={e => handleItemChange(index, 'commodityId', e.target.value)}
                      >
                        <option value="" disabled>{t('selectCommodity')}</option>
                        {commodities.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        <option value="other" className="font-bold text-emerald-800 bg-emerald-50">
                          {t('otherGrain')}
                        </option>
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-full md:w-32 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        {language === 'mr' ? 'वजन (क्विं.)' : 'Qty (Qtl)'}
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={item.quantity || ''}
                        onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                        className="h-10 text-xs font-bold bg-white"
                      />
                    </div>

                    {/* Rate — disabled until commodity + qty filled */}
                    <div className="w-full md:w-32 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        {language === 'mr' ? 'दर (₹/क्विं.)' : 'Rate (₹/Qtl)'}
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        required
                        placeholder="₹0"
                        value={item.rate || ''}
                        disabled={!item.commodityId || !(parseFloat(item.quantity) > 0)}
                        onChange={e => handleItemChange(index, 'rate', e.target.value)}
                        title={!(parseFloat(item.quantity) > 0) ? 'Enter quantity first to unlock rate' : ''}
                        className={`h-10 text-xs font-bold transition-opacity ${
                          !item.commodityId || !(parseFloat(item.quantity) > 0)
                            ? 'bg-slate-100 opacity-50 cursor-not-allowed'
                            : 'bg-white'
                        }`}
                      />
                    </div>

                    {/* Total Amount — computed read-only display */}
                    <div className="w-full md:w-36 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        {language === 'mr' ? 'रक्कम (Amount)' : 'Amount (₹)'}
                      </label>
                      <Input
                        readOnly
                        value={
                          item.quantity && item.rate
                            ? `₹${(item.amount || 0).toLocaleString('en-IN')}`
                            : '—'
                        }
                        className={`h-10 text-xs font-black border-transparent ${
                          item.quantity && item.rate
                            ? 'bg-emerald-100/70 text-emerald-900'
                            : 'bg-slate-200/70 text-slate-400'
                        }`}
                      />
                    </div>

                    {/* Remove Item Button */}
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 self-end h-10 w-10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* CUSTOM OTHER GRAIN INPUT (Appears when "other" is selected) */}
                  {item.commodityId === 'other' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-1 mt-2"
                    >
                      <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Wheat className="w-3.5 h-3.5 text-emerald-700" />
                        {language === 'mr'
                          ? 'इतर धान्याचे नाव टाका (उदा. हरभरा, उडीद, मका, ज्वारी, तीळ, धने, इत्यादी):'
                          : 'Enter Custom Grain Name (e.g. Gram, Urad, Maize, Sorghum, Sesame):'}
                        <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder={language === 'mr' ? 'उदा. हरभरा / मका' : 'e.g. Chickpeas / Maize'}
                        value={item.customCommodityName || ''}
                        onChange={e => handleItemChange(index, 'customCommodityName', e.target.value)}
                        className="h-9 text-xs font-bold bg-white border-emerald-400 focus:border-emerald-700"
                        autoFocus
                      />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Section 3: Settlement Summary */}
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-6">
            <div className="flex flex-col items-end space-y-4 w-full">
              <div className="flex justify-between items-center w-full max-w-sm text-sm">
                <span className="text-slate-700 font-bold">
                  {language === 'mr' ? 'एकूण खरेदी रक्कम (Gross Total):' : 'Gross Total:'}
                </span>
                <span className="font-black text-xl text-slate-950 font-serif">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center w-full max-w-sm text-sm">
                <span className="text-slate-700 font-bold">
                  {language === 'mr' ? 'दिलेली उचल / रक्कम (Advance Paid):' : 'Advance Paid:'}
                </span>
                <Input 
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="w-40 text-right font-black text-base bg-white h-10 border-slate-300" 
                  value={formData.advancePaid || ''} 
                  onChange={e => setFormData({...formData, advancePaid: parseFloat(e.target.value) || 0})} 
                  placeholder="₹0"
                />
              </div>

              <div className="flex justify-between items-center w-full max-w-sm text-sm border-t border-emerald-200 pt-2">
                <span className="text-rose-800 font-bold">
                  {language === 'mr' ? 'शिल्लक बाकी (Remaining Balance):' : 'Remaining Due:'}
                </span>
                <span className="font-black text-lg text-rose-700">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center w-full max-w-sm text-sm pt-1">
                <span className="text-slate-700 font-bold">
                  {language === 'mr' ? 'पेमेंट प्रकार (Payment Mode):' : 'Payment Mode:'}
                </span>
                <select 
                  className="flex h-9.5 w-40 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold"
                  value={formData.paymentMode}
                  onChange={e => setFormData({...formData, paymentMode: e.target.value})}
                >
                  <option value="Cash">{language === 'mr' ? 'रोख (Cash)' : 'Cash'}</option>
                  <option value="UPI / Online">{language === 'mr' ? 'UPI / ऑनलाइन' : 'UPI / Online'}</option>
                  <option value="Bank Transfer">{language === 'mr' ? 'बँक ट्रान्सफर' : 'Bank Transfer'}</option>
                  <option value="Cheque">{language === 'mr' ? 'धनादेश (Cheque)' : 'Cheque'}</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/purchases')}
            className="border-slate-300 text-xs font-semibold h-10 px-5"
          >
            {language === 'mr' ? 'रद्द करा' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            disabled={submitting || hasIncompleteItem}
            title={hasIncompleteItem ? 'Fill commodity and quantity for all rows before saving' : ''}
            className="bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs h-10 px-6 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? (language === 'mr' ? 'पावती तयार होत आहे...' : 'Generating Bill...')
              : (language === 'mr' ? 'पावती जतन करा व पहा' : 'Save & View Bill')}
          </Button>
        </div>

        {/* Mobile Sticky Bottom Summary & Instant Submit Action Bar */}
        <div className="md:hidden fixed bottom-14 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">एकूण (Gross Total)</div>
            <div className="text-base font-black text-slate-950 font-serif leading-tight">{formatCurrency(totalAmount)}</div>
            {remainingAmount > 0 && (
              <div className="text-[10px] font-bold text-rose-600">बाकी: {formatCurrency(remainingAmount)}</div>
            )}
          </div>
          <Button
            type="submit"
            disabled={submitting || hasIncompleteItem}
            title={hasIncompleteItem ? 'Fill commodity and quantity for all rows before saving' : ''}
            className="bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-md flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {language === 'mr' ? 'जतन करत आहे...' : 'Saving...'}
              </>
            ) : (
              <>{language === 'mr' ? 'पावती जतन करा' : 'Save Voucher'}</>
            )}
          </Button>
        </div>
      </form>

      {/* Quick Add Farmer Modal Dialog */}
      {isNewFarmerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'mr' ? 'नवीन शेतकरी नोंदणी' : 'Quick Register Farmer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFarmerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateFarmer} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  {language === 'mr' ? 'शेतकऱ्याचे पूर्ण नाव' : 'Farmer Name'} <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="उदा. गजानन पवार / Gajanan Pawar"
                  value={quickFarmer.name}
                  onChange={e => setQuickFarmer({ ...quickFarmer, name: e.target.value })}
                  className="h-10 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  {language === 'mr' ? 'गाव (Village)' : 'Village'}
                </label>
                <Input
                  placeholder="उदा. चालबर्डी / Chalberdi"
                  value={quickFarmer.village}
                  onChange={e => setQuickFarmer({ ...quickFarmer, village: e.target.value })}
                  className="h-10 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  {language === 'mr' ? '१० अंकी मोबाईल नंबर' : '10-Digit Mobile'}
                </label>
                <Input
                  type="tel"
                  maxLength={10}
                  placeholder="9823456789"
                  value={quickFarmer.mobile}
                  onChange={e => setQuickFarmer({ ...quickFarmer, mobile: e.target.value.replace(/\D/g, '') })}
                  className="h-10 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewFarmerModalOpen(false)}
                  className="text-xs font-bold h-10 rounded-xl"
                >
                  {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  disabled={savingQuickFarmer}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs h-10 rounded-xl shadow-xs"
                >
                  {savingQuickFarmer ? 'नोंदणी करत आहे...' : (language === 'mr' ? 'नोंदवा व निवडा' : 'Register & Select')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
