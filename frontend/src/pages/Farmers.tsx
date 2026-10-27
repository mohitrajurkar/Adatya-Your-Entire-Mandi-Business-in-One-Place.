import { useLanguage } from '../context/LanguageContext';
import { MobileInput, useToast } from '../components/ui';
import React, { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { formatCurrency } from '../lib/utils';
import { Plus, Search, MapPin, Phone, Users } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';


export default function Farmers() {
  const { t } = useLanguage();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFarmer, setNewFarmer] = useState({ name: '', village: '', mobile: '' });

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      const res = await apiFetch(`/farmers`);
      const data = await res.json();
      if (Array.isArray(data)) setFarmers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Name and village together are what identify a farmer in the ledger:
    // several farmers in one mandi commonly share a name.
    if (!newFarmer.name.trim()) {
      setFormError('Please enter the farmer name');
      return;
    }
    if (!newFarmer.village.trim()) {
      setFormError('Please enter the village');
      return;
    }
    if (newFarmer.mobile && newFarmer.mobile.length !== 10) {
      setFormError('Mobile number must be exactly 10 digits, or left blank');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/farmers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFarmer.name.trim(),
          village: newFarmer.village.trim(),
          mobile: newFarmer.mobile,
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(data?.error || 'Could not save this farmer. Please check the details.');
        return;
      }
      setIsAdding(false);
      setNewFarmer({ name: '', village: '', mobile: '' });
      toast.success(`${data?.name || 'Farmer'} added.`);
      fetchFarmers();
    } catch (err: any) {
      setFormError(err?.message || 'Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredFarmers = farmers.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.village?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Farmers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage registered farmers and balances</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-2 h-4 w-4" /> Add Farmer
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-emerald-200 bg-emerald-50/50 mb-6 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Register New Farmer</CardTitle>
              </CardHeader>
              <CardContent>
                {formError && (
                  <p className="mb-3 rounded-control bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" role="alert">
                    {formError}
                  </p>
                )}
                <form onSubmit={handleAddFarmer} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name <span className="text-rose-600">*</span></label>
                    <Input required autoFocus value={newFarmer.name} onChange={e => setNewFarmer({...newFarmer, name: e.target.value})} placeholder={t('e_g_gajanan_pawar')} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Village <span className="text-rose-600">*</span></label>
                    <Input required value={newFarmer.village} onChange={e => setNewFarmer({...newFarmer, village: e.target.value})} placeholder={t('e_g_maregaon')} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mobile Number <span className="text-xs font-normal text-slate-500">(optional)</span></label>
                    <MobileInput value={newFarmer.mobile} onValueChange={v => setNewFarmer({ ...newFarmer, mobile: v })} placeholder="10-digit number (optional)" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50 rounded-t-2xl">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="search" 
                placeholder="Search farmers..." 
                className="pl-9 bg-white border-slate-200 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {/* Mobile Optimized Card View (< md) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredFarmers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t('no_farmers_found')}
              </div>
            ) : (
              filteredFarmers.map(farmer => (
                <div key={farmer.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{farmer.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        {farmer.village && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" /> {farmer.village}
                          </span>
                        )}
                        <span>· {format(new Date(farmer.createdAt), 'dd MMM yyyy')}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">{t('outstanding_balance')}</div>
                      <span className={`inline-block font-bold text-xs px-2 py-0.5 rounded-lg mt-0.5 ${
                        farmer.outstandingBalance > 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {formatCurrency(farmer.outstandingBalance)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    {farmer.mobile ? (
                      <a
                        href={`tel:${farmer.mobile}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200"
                      >
                        <Phone className="h-3.5 w-3.5 text-emerald-700" />
                        <span>{farmer.mobile}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">{t('no_mobile_on_record')}</span>
                    )}

                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200 text-slate-700">
                      {t('ledger')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Farmer Name</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Contact Details</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Joined Date</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-right">Outstanding Bal.</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFarmers.map(farmer => (
                  <tr key={farmer.id} className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {farmer.name}
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center text-slate-600">
                        <MapPin className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> {farmer.village || 'N/A'}
                      </div>
                      {farmer.mobile && (
                        <div className="flex items-center text-slate-500 text-xs">
                          <Phone className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> {farmer.mobile}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(farmer.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={farmer.outstandingBalance > 0 ? "text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded-md" : "text-slate-500"}>
                        {formatCurrency(farmer.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">View Ledger</Button>
                    </td>
                  </tr>
                ))}
                {filteredFarmers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Users className="h-8 w-8 text-slate-300" />
                        <p>No farmers found matching your search.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
