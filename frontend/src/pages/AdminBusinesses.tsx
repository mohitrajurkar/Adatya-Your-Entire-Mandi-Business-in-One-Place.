import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ConfirmDialog, useToast } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import {
  Building2,
  Users,
  ShoppingCart,
  TrendingUp,
  ShieldCheck,
  Search,
  Eye,
  Trash2,
  RefreshCw,
  Boxes,
  MapPin,
  Phone,
  Calendar,
  IndianRupee,
  CheckCircle2,
  X,
  FileSpreadsheet,
  BadgeAlert,
  ArrowRight,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';


export default function AdminBusinesses() {
  const { t, tf } = useLanguage();
  const [overview, setOverview] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [businessFullData, setBusinessFullData] = useState<any | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'purchases' | 'farmers' | 'sales' | 'inventory' | 'profile'>('purchases');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();
  const [deleteError, setDeleteError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, businessesRes] = await Promise.all([
        apiFetch(`/admin/overview`),
        apiFetch(`/admin/businesses`)
      ]);
      if (overviewRes.ok) {
        setOverview(await overviewRes.json());
      }
      if (businessesRes.ok) {
        setBusinesses(await businessesRes.json());
      }
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openBusinessDetails = async (business: any) => {
    setSelectedBusiness(business);
    setLoadingData(true);
    setActiveTab('purchases');
    try {
      const res = await apiFetch(`/admin/businesses/${business.id}/data`);
      if (res.ok) {
        setBusinessFullData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load business details:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteBusiness = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const business = businesses.find(b => b.id === id);
    setPendingDelete({ id, name: business?.businessName || business?.name || `#${id}` });
  };

  const confirmDeleteBusiness = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeletingId(id);
    setDeleteError('');
    try {
      const res = await apiFetch(`/admin/businesses/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBusinesses(prev => prev.filter(b => b.id !== id));
        if (selectedBusiness?.id === id) {
          setSelectedBusiness(null);
        }
        setPendingDelete(null);
        toast.success(`Removed ${pendingDelete.name}.`);
      } else {
        setDeleteError(data.error || 'Failed to delete business.');
      }
    } catch (err) {
      setDeleteError('Connection error while deleting business.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBusinesses = businesses.filter(b => {
    const q = searchQuery.toLowerCase();
    return (
      (b.businessName && b.businessName.toLowerCase().includes(q)) ||
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.mobile && b.mobile.includes(q)) ||
      (b.apmcLocation && b.apmcLocation.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wider uppercase border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" /> Super Admin Control Center
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-serif tracking-tight text-white">
              {t('all_registered_businesses_and_trader_data')}
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Signed in as platform administrator. Monitor all business accounts, farmer ledgers, and transactions platform-wide.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={loadData}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold h-10 px-4 rounded-xl backdrop-blur"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> {t('refresh')}
            </Button>
          </div>
        </div>
      </div>

      {deleteError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-sm">
          <BadgeAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="border-slate-200/80 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('total_businesses')}
            </CardTitle>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {overview?.totalBusinesses ?? businesses.length}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Platform Accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('total_procurement')}
            </CardTitle>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
              {formatCurrency(overview?.totalProcurementValue || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {tf('purchase_bills_count_qtl', { bills: overview?.totalPurchases || 0, qtl: Math.round(overview?.totalPurchasedQuintals || 0) })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('total_farmers')}
            </CardTitle>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {overview?.totalFarmers || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Across all APMC mandi locations
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('mandi_sales')}
            </CardTitle>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-purple-700 font-mono">
              {formatCurrency(overview?.totalSalesRevenue || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {overview?.totalMandiSales || 0} {t('total_sale_deals')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Directory Section */}
      <Card className="border-slate-200/80 shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-900">
              {t('businesses_directory')}
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Click on any business to inspect their complete ledger, purchases, farmers, and transactions.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by firm, owner, mobile, APMC..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-sm font-medium">Loading registered businesses...</p>
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-base font-bold text-slate-700">{t('no_businesses_found')}</p>
              <p className="text-xs text-slate-400">Try searching with a different term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-6">{t('business_name')}</th>
                    <th className="py-3.5 px-4">{t('owner')}</th>
                    <th className="py-3.5 px-4">{t('mobile')}</th>
                    <th className="py-3.5 px-4">{t('apmc_location')}</th>
                    <th className="py-3.5 px-4">{t('reg_date')}</th>
                    <th className="py-3.5 px-4 text-right">{t('volume')}</th>
                    <th className="py-3.5 px-6 text-center">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {filteredBusinesses.map(b => {
                    const isMaster = b.isSuperAdmin === true || b.role === 'SUPER_ADMIN';
                    return (
                      <tr
                        key={b.id}
                        onClick={() => openBusinessDetails(b)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shadow-2xs ${
                              isMaster ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {b.businessName?.[0]?.toUpperCase() || 'B'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                {b.businessName}
                                {isMaster && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                    Master Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-normal">ID #{b.id} • {b.role || 'Admin'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-slate-700">
                          {b.name}
                        </td>

                        <td className="py-4 px-4 font-mono text-slate-800 font-bold">
                          {b.mobile}
                        </td>

                        <td className="py-4 px-4 text-slate-600">
                          <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 px-2.5 py-1 rounded-lg">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {b.apmcLocation || 'APMC Yard'}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-xs text-slate-500 font-mono">
                          {b.createdAt ? format(new Date(b.createdAt), 'dd MMM yyyy') : 'Recently'}
                        </td>

                        <td className="py-4 px-4 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(b.totalProcurementAmount || 0)}
                        </td>

                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openBusinessDetails(b)}
                              className="h-8 px-3 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View Full Data
                            </Button>
                            {!isMaster && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deletingId === b.id}
                                onClick={e => handleDeleteBusiness(b.id, e)}
                                className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Business Data Inspector Modal */}
      <AnimatePresence>
        {selectedBusiness && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xl">
                    {selectedBusiness.businessName?.[0]?.toUpperCase() || 'B'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {selectedBusiness.businessName}
                      {selectedBusiness.role === 'SUPER_ADMIN' && (
                        <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                          Master Admin
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Proprietor: <span className="text-white font-bold">{selectedBusiness.name}</span> • Mobile: <span className="font-mono text-emerald-400 font-bold">{selectedBusiness.mobile}</span> • APMC: <span className="text-slate-200">{selectedBusiness.apmcLocation}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 bg-slate-50/50 overflow-x-auto text-xs font-bold">
                <button
                  onClick={() => setActiveTab('purchases')}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'purchases'
                      ? 'border-emerald-600 text-emerald-700 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" /> {t('purchases_bills')}
                </button>
                <button
                  onClick={() => setActiveTab('farmers')}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'farmers'
                      ? 'border-emerald-600 text-emerald-700 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" /> {t('farmers_ledger')}
                </button>
                <button
                  onClick={() => setActiveTab('sales')}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'sales'
                      ? 'border-emerald-600 text-emerald-700 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Boxes className="w-4 h-4" /> {t('mandi_sales_2')}
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'inventory'
                      ? 'border-emerald-600 text-emerald-700 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Scale className="w-4 h-4" /> {t('grain_inventory')}
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'profile'
                      ? 'border-emerald-600 text-emerald-700 font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 className="w-4 h-4" /> {t('business_profile')}
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                {loadingData ? (
                  <div className="py-24 text-center text-slate-500 space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                    <p className="text-sm font-medium">Fetching complete operational ledger...</p>
                  </div>
                ) : !businessFullData ? (
                  <div className="py-16 text-center text-slate-400">No data found for this business.</div>
                ) : (
                  <div>
                    {/* Tab 1: Purchases */}
                    {activeTab === 'purchases' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-800">
                            {tf('purchase_records_total', { n: businessFullData.purchases?.length || 0 })}
                          </h3>
                        </div>
                        {(!businessFullData.purchases || businessFullData.purchases.length === 0) ? (
                          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
                            {t('this_firm_has_not_recorded_any_purchases_yet')}
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                                <tr>
                                  <th className="py-3 px-4">{t('bill')}</th>
                                  <th className="py-3 px-4">{t('date_2')}</th>
                                  <th className="py-3 px-4 text-right">{t('total_2')}</th>
                                  <th className="py-3 px-4 text-right">{t('advance')}</th>
                                  <th className="py-3 px-4 text-right">{t('due')}</th>
                                  <th className="py-3 px-4 text-center">{t('status')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {businessFullData.purchases.map((p: any) => (
                                  <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.purchaseNumber}</td>
                                    <td className="py-3 px-4 text-slate-600 font-mono">{p.date}</td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatCurrency(p.totalAmount || 0)}</td>
                                    <td className="py-3 px-4 text-right font-mono text-emerald-700">{formatCurrency(p.advancePaid || 0)}</td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">{formatCurrency(p.remainingAmount || 0)}</td>
                                    <td className="py-3 px-4 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        p.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {p.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Farmers */}
                    {activeTab === 'farmers' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-800">
                          {tf('registered_farmers_total', { n: businessFullData.farmers?.length || 0 })}
                        </h3>
                        {(!businessFullData.farmers || businessFullData.farmers.length === 0) ? (
                          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
                            {t('no_farmers_registered_yet')}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {businessFullData.farmers.map((f: any) => (
                              <div key={f.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-slate-900 text-sm">{f.name}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">{f.village || t('no_village')} • {f.mobile || t('no_mobile')}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-slate-400">{t('remaining_due_2')}</div>
                                  <div className={`font-mono font-bold text-sm ${f.currentBalance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {formatCurrency(f.currentBalance || 0)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Mandi Sales */}
                    {activeTab === 'sales' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-800">
                          {tf('mandi_sale_deals_total', { n: businessFullData.mandiSales?.length || 0 })}
                        </h3>
                        {(!businessFullData.mandiSales || businessFullData.mandiSales.length === 0) ? (
                          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
                            {t('no_mandi_dispatch_sales_found')}
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                                <tr>
                                  <th className="py-3 px-4">{t('date_2')}</th>
                                  <th className="py-3 px-4">{t('buyer')}</th>
                                  <th className="py-3 px-4">{t('vehicle')}</th>
                                  <th className="py-3 px-4 text-right">{t('bags_3')}</th>
                                  <th className="py-3 px-4 text-right">{t('net_amount')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {businessFullData.mandiSales.map((s: any) => (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="py-3 px-4 font-mono text-slate-700">{s.saleDate}</td>
                                    <td className="py-3 px-4 font-bold text-slate-900">{s.buyerName}</td>
                                    <td className="py-3 px-4 font-mono text-slate-600">{s.vehicleNumber || '—'}</td>
                                    <td className="py-3 px-4 text-right font-mono">{s.totalBags || 0}</td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">{formatCurrency(s.netAmount || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 4: Grain Inventory */}
                    {activeTab === 'inventory' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-800">
                          {t('active_commodities')}
                        </h3>
                        {(!businessFullData.commodities || businessFullData.commodities.length === 0) ? (
                          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
                            {t('no_commodities_found')}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {businessFullData.commodities.map((c: any) => (
                              <div key={c.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                                <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                                <div className="text-xs text-slate-500 mt-1">Default Rate: ₹{c.defaultRate}/qtl</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 5: Profile */}
                    {activeTab === 'profile' && (
                      <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-4 text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs text-slate-400 block">Business / Firm Name</span>
                            <span className="font-bold text-slate-900">{selectedBusiness.businessName}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 block">Owner / Proprietor</span>
                            <span className="font-bold text-slate-900">{selectedBusiness.name}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 block">Mobile Number</span>
                            <span className="font-mono font-bold text-slate-900">{selectedBusiness.mobile}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 block">Mandi Yard / Location</span>
                            <span className="font-bold text-slate-900">{selectedBusiness.apmcLocation}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end">
                <Button
                  onClick={() => setSelectedBusiness(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 h-9 rounded-xl"
                >
                  {t('close')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="Remove this business account?"
        message={`The account for ${pendingDelete?.name ?? ''} will be removed and its owner will no longer be able to sign in. This cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Remove account"
        busy={deletingId !== null}
        onConfirm={confirmDeleteBusiness}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
  );
}
