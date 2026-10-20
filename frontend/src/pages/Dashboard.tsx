import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCurrency } from '../lib/utils';
import {
  Users,
  ShoppingBag,
  Banknote,
  IndianRupee,
  Plus,
  ArrowRight,
  MessageSquare,
  Eye,
  TrendingUp,
  Building2,
  User,
  Boxes,
  Scale,
  ShieldCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';


export default function Dashboard() {
  const { language, t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [selectedForWhatsApp, setSelectedForWhatsApp] = useState<any | null>(null);
  const [inventoryStock, setInventoryStock] = useState<{ stock: any[]; summary: any } | null>(null);

  useEffect(() => {
    apiFetch(`/dashboard`)
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);

    apiFetch(`/profile`)
      .then(res => res.json())
      .then(setProfile)
      .catch(console.error);

    apiFetch(`/inventory/stock`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setInventoryStock({ stock: data.stock || [], summary: data.summary || null });
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenWhatsApp = async (purchase: any) => {
    try {
      const res = await apiFetch(`/purchases/${purchase.id}`);
      const full = await res.json();
      setSelectedForWhatsApp(full);
    } catch {
      setSelectedForWhatsApp(purchase);
    }
  };

  if (!stats || stats.error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Loading procurement metrics...</p>
        </div>
      </div>
    );
  }

  const chartData = stats.chartData && stats.chartData.length > 0
    ? stats.chartData
    : [
        { name: 'Mon', value: 0 },
        { name: 'Tue', value: 0 },
        { name: 'Wed', value: 0 },
        { name: 'Thu', value: 0 },
        { name: 'Fri', value: 0 },
        { name: 'Sat', value: 0 },
        { name: 'Sun', value: 0 },
      ];

  const totalProcured = stats.totalAmount || 0;
  const pendingPayments = stats.pendingPayments || 0;
  const totalPaid = totalProcured - pendingPayments;

  const userJson = localStorage.getItem('user');
  let user: any = null;
  try {
    if (userJson) user = JSON.parse(userJson);
  } catch {}

  const activeBusinessName = user?.businessName || profile?.businessName || 'Adatya Desk';
  const activeLocation = user?.apmcLocation || profile?.address || 'APMC Mandi Yard';
  const activeProprietor = user?.name || profile?.proprietorName || 'Broker';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 pb-16">
      {/* WhatsApp Modal */}
      {selectedForWhatsApp && (
        <WhatsAppShareModal
          isOpen={!!selectedForWhatsApp}
          onClose={() => setSelectedForWhatsApp(null)}
          data={selectedForWhatsApp}
          profile={profile}
        />
      )}

      {/* Hero Broker Business Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-emerald-900/40 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{activeLocation}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400">Adatya Mandi Desk</span>
            {isSuperAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300">
                Super Admin
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white truncate" title={activeBusinessName}>
            {activeBusinessName}
          </h1>
          <p className="text-xs text-slate-300">
            Welcome, <span className="font-semibold text-amber-200">{activeProprietor}</span> · Real-time crop procurement & farmer ledger
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isSuperAdmin && (
            <Link to="/admin">
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black shadow-lg text-xs px-4 h-10 border border-amber-300">
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                {t('super_admin_portal')}
              </Button>
            </Link>
          )}
          <Link to="/inventory">
            <Button className="bg-emerald-800 hover:bg-emerald-700 text-amber-200 border border-amber-400/40 font-bold shadow-md text-xs px-3.5 h-10">
              <Boxes className="w-4 h-4 mr-1.5" />
              {t('grain_stock_sales_2')}
            </Button>
          </Link>
          <Link to="/purchases/new">
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md text-xs px-4 h-10">
              <Plus className="w-4 h-4 mr-1.5 stroke-[3]" />
              {t('new_purchase_slip_2')}
            </Button>
          </Link>
          <Link to="/profile">
            <Button variant="outline" className="border-slate-700 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-3.5 h-10">
              <User className="w-4 h-4 mr-1.5" />
              {t('profile')}
            </Button>
          </Link>
          <Link to="/purchases">
            <Button variant="outline" className="border-slate-700 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-3.5 h-10">
              <Eye className="w-4 h-4 mr-1.5" />
              {t('all_bills')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="hover:shadow-md transition-shadow border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                {t('total_purchased')}
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-slate-100 rounded-lg text-slate-800 shrink-0">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-black text-slate-950 font-serif leading-tight">{formatCurrency(totalProcured)}</div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium truncate">
                {stats.totalPurchases} {t('vouchers')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="hover:shadow-md transition-shadow border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                {t('amount_paid')}
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg text-emerald-700 shrink-0">
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-black text-emerald-700 font-serif leading-tight">{formatCurrency(totalPaid)}</div>
              <p className="text-[10px] sm:text-xs text-emerald-600 mt-1 font-medium truncate">
                {t('disbursed')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="hover:shadow-md transition-shadow border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                {t('due_balance')}
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-rose-50 rounded-lg text-rose-700 shrink-0">
                <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-black text-rose-700 font-serif leading-tight">{formatCurrency(pendingPayments)}</div>
              <p className="text-[10px] sm:text-xs text-rose-600 mt-1 font-medium truncate">
                {t('to_settle')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="hover:shadow-md transition-shadow border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                {t('active_farmers')}
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg text-blue-700 shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-black text-slate-950 font-serif leading-tight">{stats.activeFarmers || 0}</div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium truncate">
                {t('registered')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Live Grain Godown Stock Tracker Banner */}
      {inventoryStock && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white rounded-2xl border border-emerald-900/20 shadow-xs p-4 sm:p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{t('live_godown_grain_stock')}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {inventoryStock.summary?.totalStockQuintals ?? 0} Qtl Available
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('real_time_commodity_balances_updated_on_farm')}
                </p>
              </div>
            </div>

            <Link to="/inventory">
              <Button size="sm" variant="outline" className="text-xs h-8 font-bold text-emerald-900 border-emerald-300 hover:bg-emerald-50">
                <Boxes className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                {t('manage_stock_sell')}
              </Button>
            </Link>
          </div>

          {/* Grain Stock Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {inventoryStock.stock.map((grain: any) => {
              const isOut = grain.availableQuintals <= 0;
              return (
                <div
                  key={grain.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isOut
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : 'bg-gradient-to-b from-white to-emerald-50/30 border-emerald-200/80 shadow-2xs hover:border-emerald-500'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-800 truncate" title={grain.name}>
                    {grain.name}
                  </div>
                  <div className="text-base font-black text-slate-950 font-serif mt-0.5">
                    {grain.availableQuintals}{' '}
                    <span className="text-[10px] font-semibold text-slate-500">Qtl</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                    <span>{grain.availableBags} {t('bags_unit')}</span>
                    <span className={`font-bold ${isOut ? 'text-slate-400' : 'text-emerald-700'}`}>
                      {isOut ? t('nil') : t('available')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Main Grid: Real Chart & Recent Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Dynamic Chart */}
        <motion.div
          className="lg:col-span-4"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="h-full border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Procurement Value Trends</CardTitle>
                <p className="text-xs text-slate-500">Live purchase volume by date</p>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-700" />
            </CardHeader>
            <CardContent className="h-[300px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Total Purchase']}
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Purchases with Farmer & Quick WhatsApp */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full border-slate-200 bg-white shadow-xs flex flex-col">
            <CardHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Recent Purchase Slips</CardTitle>
                <p className="text-xs text-slate-500">Latest farmer transactions</p>
              </div>
              <Link to="/purchases" className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-y-auto max-h-[340px]">
              <div className="divide-y divide-slate-100">
                {stats.recentPurchases?.map((purchase: any) => (
                  <div
                    key={purchase.id}
                    className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/invoice/${purchase.id}`}
                          className="font-mono text-xs font-bold text-slate-950 group-hover:text-amber-800 hover:underline"
                        >
                          {purchase.purchaseNumber}
                        </Link>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            purchase.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : purchase.status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {purchase.status}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        {purchase.farmerName || 'Farmer'}
                        {purchase.farmerVillage && (
                          <span className="font-normal text-slate-400"> ({purchase.farmerVillage})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {purchase.date ? format(new Date(purchase.date), 'dd MMM yyyy') : '-'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-950">{formatCurrency(purchase.totalAmount)}</div>
                        {purchase.remainingAmount > 0 ? (
                          <div className="text-[10px] font-semibold text-rose-600">
                            Due {formatCurrency(purchase.remainingAmount)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold text-emerald-600">Paid</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(purchase)}
                          title="Share on WhatsApp"
                          className="p-1 rounded text-emerald-700 hover:bg-emerald-50"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <Link to={`/invoice/${purchase.id}`}>
                          <button
                            type="button"
                            title="View Invoice"
                            className="p-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {(!stats.recentPurchases || stats.recentPurchases.length === 0) && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No purchase vouchers recorded yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
