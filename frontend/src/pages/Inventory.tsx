import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { formatCurrency } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { OFFICIAL_LOGO_SRC } from '../config/logos';
import { apiFetch, newRequestKey } from '../lib/api';
import { ConfirmDialog, useToast } from '../components/ui';
import {
  Boxes,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Scale,
  Building2,
  Calendar,
  Truck,
  IndianRupee,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Trash2,
  Printer,
  X,
  Wheat,
  Layers,
  Sparkles
} from 'lucide-react';


/** One row of GET /api/inventory/stock. */
interface StockCommodity {
  id: number;
  commodityName: string;
  quintals: number;
  kg: number;
  bags: number;
  value: number;
  defaultRate: number;
  purchasedQuintals: number;
  purchasedAmount: number;
  avgPurchaseRate: number;
  soldQuintals: number;
  soldAmount: number;
  avgSaleRate: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lowStockThreshold: number;
}

/** Totals are flat on the response rather than nested under "summary". */
interface StockSummary {
  totalQuintals: number;
  totalBags: number;
  totalValue: number;
  totalSalesAmount: number;
  salesCount: number;
  commodityCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface MandiSale {
  id: number;
  saleNumber: string;
  date: string;
  commodityId: number;
  commodityName: string;
  buyerName: string;
  buyerMobile?: string;
  buyerLocation?: string;
  vehicleNumber?: string;
  bags: number;
  weightQuintals: number;
  saleRate: number;
  subtotal: number;
  hamali: number;
  transport: number;
  mandiCess: number;
  netAmount: number;
  paymentStatus: string;
  paymentMode: string;
  amountReceived: number;
  notes?: string;
  createdAt: string;
}

export default function Inventory() {
  const { language, t, tf } = useLanguage();
  const { currentTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [stockList, setStockList] = useState<StockCommodity[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [salesList, setSalesList] = useState<MandiSale[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'sales'>('stock');

  // Modals
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [viewingSaleSlip, setViewingSaleSlip] = useState<MandiSale | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommodityFilter, setSelectedCommodityFilter] = useState<string>('all');

  // Form State for Mandi Sale
  const [saleForm, setSaleForm] = useState({
    commodityId: '',
    buyerName: '',
    buyerMobile: '',
    buyerLocation: '',
    vehicleNumber: '',
    date: new Date().toISOString().slice(0, 10),
    bags: '',
    weightQuintals: '',
    saleRate: '',
    hamali: '0',
    transport: '0',
    mandiCess: '0',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    notes: '',
  });
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const saleKeyRef = useRef<string | null>(null);
  const [pendingSaleDelete, setPendingSaleDelete] = useState<number | null>(null);
  const toast = useToast();
  const [saleError, setSaleError] = useState<string | null>(null);

  // Form State for Opening Stock / Adjustment
  const [adjForm, setAdjForm] = useState({
    commodityId: '',
    type: 'opening',
    bags: '',
    weightQuintals: '',
    rate: '',
    reason: 'Initial Godown Opening Balance',
    date: new Date().toISOString().slice(0, 10),
  });
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  // Fetch Inventory & Mandi Sales
  const fetchData = async () => {
    setLoading(true);
    try {
      const [stockRes, salesRes, profileRes] = await Promise.all([
        apiFetch(`/inventory/stock`),
        apiFetch(`/mandi-sales`),
        apiFetch(`/profile`)
      ]);
      const stockData = await stockRes.json();
      const salesData = await salesRes.json();
      const profileData = await profileRes.json().catch(() => null);
      if (profileData && !profileData.error) {
        setBusinessProfile(profileData);
      }

      if (stockRes.ok && Array.isArray(stockData.items)) {
        setStockList(stockData.items);
        const { items, ...totals } = stockData;
        setSummary(totals as StockSummary);
      }
      if (Array.isArray(salesData)) {
        setSalesList(salesData);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Quick action: Open Sale modal with pre-selected commodity
  const handleOpenSaleForCommodity = (commodityId: number) => {
    const target = stockList.find(c => c.id === commodityId);
    setSaleForm({
      commodityId: String(commodityId),
      buyerName: '',
      buyerMobile: '',
      buyerLocation: '',
      vehicleNumber: '',
      date: new Date().toISOString().slice(0, 10),
      bags: target ? String(target.bags > 0 ? target.bags : '') : '',
      weightQuintals: target ? String(target.quintals > 0 ? target.quintals : '') : '',
      saleRate: target ? String(Math.round(target.avgPurchaseRate * 1.05)) : '',
      hamali: '0',
      transport: '0',
      mandiCess: '0',
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      notes: '',
    });
    setSaleError(null);
    setIsSaleModalOpen(true);
  };

  // Selected commodity in sale form for real-time stock feedback
  const selectedSaleCommodity = stockList.find(c => String(c.id) === String(saleForm.commodityId));

  // Compute live subtotal & net amount for Sale Form
  const calcSaleSubtotal = () => {
    const w = parseFloat(saleForm.weightQuintals) || 0;
    const r = parseFloat(saleForm.saleRate) || 0;
    return w * r;
  };

  const calcSaleNetAmount = () => {
    const sub = calcSaleSubtotal();
    const h = parseFloat(saleForm.hamali) || 0;
    const t = parseFloat(saleForm.transport) || 0;
    const c = parseFloat(saleForm.mandiCess) || 0;
    return Math.max(0, sub - h - t - c);
  };

  // Submit Mandi Sale
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError(null);

    const w = parseFloat(saleForm.weightQuintals);
    const r = parseFloat(saleForm.saleRate);

    if (!saleForm.commodityId) {
      setSaleError(t('please_select_a_grain_commodity'));
      return;
    }
    if (isNaN(w) || w <= 0) {
      setSaleError(t('please_enter_valid_weight_in_quintals'));
      return;
    }
    if (isNaN(r) || r <= 0) {
      setSaleError(t('please_enter_valid_sale_rate'));
      return;
    }
    if (!saleForm.buyerName.trim()) {
      setSaleError(t('please_enter_buyer_mill_name'));
      return;
    }

    // Stock is enforced by the server, so this is told as a fact rather than
    // offered as "proceed anyway" -- that prompt used to let the sale through
    // and drive inventory negative, and would now simply be rejected.
    if (selectedSaleCommodity && w > selectedSaleCommodity.quintals) {
      setSaleError(tf('only_qtl_in_stock_cannot_sell', { available: selectedSaleCommodity.quintals, asked: w }));
      return;
    }

    if (!saleKeyRef.current) {
      saleKeyRef.current = newRequestKey();
    }

    setSaleSubmitting(true);
    try {
      const res = await apiFetch(`/mandi-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...saleForm, clientRequestId: saleKeyRef.current }),
      });
      const data = await res.json();
      if (data.success) {
        saleKeyRef.current = null;
        setIsSaleModalOpen(false);
        // Refresh inventory and sales
        await fetchData();
        // Show printable voucher
        if (data.sale) {
          const matchedComm = stockList.find(c => c.id === Number(saleForm.commodityId));
          setViewingSaleSlip({
            ...data.sale,
            commodityName: matchedComm?.commodityName || 'Grain'
          });
        }
      } else {
        setSaleError(data.error || 'Failed to record sale');
      }
    } catch (err: any) {
      setSaleError(err.message || 'Error communicating with server');
    } finally {
      setSaleSubmitting(false);
    }
  };

  // Submit Opening Stock / Adjustment
  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError(null);

    const w = parseFloat(adjForm.weightQuintals);
    if (!adjForm.commodityId) {
      setAdjError(t('please_select_a_grain'));
      return;
    }
    if (isNaN(w) || w <= 0) {
      setAdjError(t('please_enter_valid_weight'));
      return;
    }

    setAdjSubmitting(true);
    try {
      const res = await apiFetch(`/stock-adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdjModalOpen(false);
        setAdjForm({
          commodityId: '',
          type: 'opening',
          bags: '',
          weightQuintals: '',
          rate: '',
          reason: 'Initial Godown Opening Balance',
          date: new Date().toISOString().slice(0, 10),
        });
        await fetchData();
      } else {
        setAdjError(data.error || 'Failed to add adjustment');
      }
    } catch (err: any) {
      setAdjError(err.message || 'Error adding adjustment');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // Delete a Mandi Sale (reverts stock)
  const handleDeleteSale = (id: number) => {
    setPendingSaleDelete(id);
  };

  const confirmDeleteSale = async () => {
    const id = pendingSaleDelete;
    if (id === null) return;
    try {
      const res = await apiFetch(`/mandi-sales/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPendingSaleDelete(null);
        await fetchData();
        toast.success(
          t('sale_cancelled_the_quantity_is_back_in_stock')
        );
      } else {
        toast.error(data.error || 'Could not cancel the sale.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not cancel the sale.');
    }
  };

  // Filtered lists
  const filteredStock = stockList.filter(item => {
    const matchesSearch = item.commodityName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesComm = selectedCommodityFilter === 'all' || String(item.id) === selectedCommodityFilter;
    return matchesSearch && matchesComm;
  });

  const filteredSales = salesList.filter(sale => {
    const matchesSearch =
      (sale.buyerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.saleNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.commodityName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesComm = selectedCommodityFilter === 'all' || String(sale.commodityId) === selectedCommodityFilter;
    return matchesSearch && matchesComm;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-300 flex items-center justify-center shadow-md border border-amber-400/30 shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-serif font-black text-slate-900 leading-tight">
                {t('grain_inventory_mandi_sales')}
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                Live Godown Stock
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t('track_available_godown_stock_by_grain_record')}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setAdjError(null);
              setIsAdjModalOpen(true);
            }}
            variant="outline"
            size="sm"
            className="text-xs h-9 border-slate-300 font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-slate-600" />
            {t('add_opening_stock')}
          </Button>

          <Button
            onClick={() => {
              setSaleError(null);
              setIsSaleModalOpen(true);
            }}
            size="sm"
            className="text-xs h-9 font-bold bg-emerald-800 hover:bg-emerald-900 text-amber-200 shadow-xs border border-amber-400/40"
          >
            <ArrowUpRight className="w-4 h-4 mr-1 text-amber-400" />
            {t('record_mandi_sale')}
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Available Quintals */}
        <Card className="border border-emerald-900/20 bg-gradient-to-br from-emerald-900 to-[#032015] text-white shadow-md rounded-2xl overflow-hidden relative">
          <div className="absolute right-2 -bottom-2 opacity-10 pointer-events-none">
            <Boxes className="w-28 h-28" />
          </div>
          <CardContent className="p-4 relative z-10">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
              <span>{t('total_godown_stock')}</span>
              <Scale className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-amber-300 font-serif">
                {summary?.totalQuintals ?? 0}
              </span>
              <span className="text-xs font-bold text-emerald-200">
                {t('quintals')}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-emerald-800/80 flex items-center justify-between text-xs text-emerald-100">
              <span>{t('est_total_bags')}:</span>
              <strong className="text-white font-bold">{summary?.totalBags ?? 0} {t('bags')}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Stock Value */}
        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              <span>{t('stock_valuation')}</span>
              <IndianRupee className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 font-serif">
              {formatCurrency(summary?.totalValue ?? 0)}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>{t('grain_types')}:</span>
              <strong className="text-slate-900 font-bold">{summary?.commodityCount ?? 0} {t('items')}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Total Mandi Sales Realized */}
        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              <span>{t('total_mandi_sales')}</span>
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-emerald-700 font-serif">
              {formatCurrency(summary?.totalSalesAmount ?? 0)}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>{t('total_sales')}:</span>
              <strong className="text-slate-900 font-bold">{summary?.salesCount ?? 0} {t('deals')}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Status Tracker */}
        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              <span>{t('godown_health')}</span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-slate-800">
                {stockList.filter(s => s.quintals > 0).length} / {stockList.length} {t('grains_in_stock')}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{t('nil_stock')}</span>
              <strong className="text-amber-700 font-bold">
                {stockList.filter(s => s.quintals <= 0).length} {t('types')}
              </strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs (Stock by Grain vs Mandi Sales History) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'stock'
                ? 'bg-emerald-900 text-amber-300 shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{t('stock_by_grain')}</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {stockList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'sales'
                ? 'bg-emerald-900 text-amber-300 shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{t('mandi_sales_history')}</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
              {salesList.length}
            </span>
          </button>
        </div>

        {/* Search & Commodity Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder={t('search_grain_or_buyer')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 w-48 sm:w-56 bg-white"
            />
          </div>

          <select
            value={selectedCommodityFilter}
            onChange={e => setSelectedCommodityFilter(e.target.value)}
            className="text-xs h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-medium text-slate-700"
          >
            <option value="all">{t('all_grains')}</option>
            {stockList.map(c => (
              <option key={c.id} value={String(c.id)}>{c.commodityName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: STOCK BY GRAIN */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStock.map((item) => {
              const isLow = item.isLowStock;
              const isOut = item.isOutOfStock;

              return (
                <Card
                  key={item.id}
                  className={`border transition-all hover:shadow-md rounded-2xl overflow-hidden bg-white ${
                    isOut
                      ? 'border-slate-200 opacity-90'
                      : isLow
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-emerald-600/30'
                  }`}
                >
                  <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-2 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold shrink-0">
                        <Wheat className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-serif font-black text-slate-900">
                          {item.commodityName}
                        </CardTitle>
                        <span className="text-[11px] text-slate-500">
                          MSP/Def Rate: ₹{item.defaultRate}/Qtl
                        </span>
                      </div>
                    </div>

                    {/* Stock Status Badge */}
                    <div>
                      {isOut ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600">
                          {t('out_of_stock')}
                        </span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800">
                          {t('low_stock')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800">
                          {t('in_stock')}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    {/* Primary Available Balance Spotlight */}
                    <div className="bg-gradient-to-r from-emerald-50 to-amber-50/40 p-3 rounded-xl border border-emerald-200/60 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                          {t('available_balance')}
                        </div>
                        <div className="text-2xl font-black text-slate-950 font-serif mt-0.5">
                          {item.quintals}{' '}
                          <span className="text-xs font-bold text-slate-600">
                            {t('qtl')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold">
                          {tf('kg_approx_bags', { kg: item.kg, bags: item.bags })}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {t('book_value')}
                        </div>
                        <div className="text-sm font-bold text-emerald-800 font-serif">
                          {formatCurrency(item.value)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          @ ₹{item.avgPurchaseRate}/Qtl
                        </div>
                      </div>
                    </div>

                    {/* Breakdown: Inward vs Outward */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      {/* Total Inward Purchased */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                          <span>{t('total_inward')}</span>
                        </div>
                        <div className="font-bold text-slate-900 mt-1">
                          {item.purchasedQuintals} Qtl
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatCurrency(item.purchasedAmount)}
                        </div>
                      </div>

                      {/* Total Outward Sold to Mandi */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3 text-amber-600" />
                          <span>{t('total_outward')}</span>
                        </div>
                        <div className="font-bold text-slate-900 mt-1">
                          {item.soldQuintals} Qtl
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatCurrency(item.soldAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Action Button: Sell this commodity directly */}
                    <Button
                      onClick={() => handleOpenSaleForCommodity(item.id)}
                      disabled={item.quintals <= 0}
                      className={`w-full text-xs h-9 font-bold transition-all ${
                        item.quintals <= 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-800 hover:bg-emerald-900 text-amber-200'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                      {t('sell_to_mandi')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredStock.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <Boxes className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No commodities match your filter</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANDI SALES HISTORY & LOG */}
      {activeTab === 'sales' && (
        <Card className="border border-slate-200/90 shadow-xs bg-white rounded-2xl overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/60">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                {t('mandi_outward_sales_register')}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('outward_deliveries_to_mandi_buyers_dal_mills')}
              </p>
            </div>
            <div className="text-xs font-bold text-slate-700">
              {filteredSales.length} {t('sales_records')}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredSales.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <ArrowUpRight className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">
                  {t('no_mandi_sales_recorded_yet')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {t('click_record_mandi_sale_above_to_sell_godown')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">{t('sale_no')}</th>
                      <th className="py-3 px-4">{t('date_3')}</th>
                      <th className="py-3 px-4">{t('buyer_trader_mill')}</th>
                      <th className="py-3 px-4">{t('commodity')}</th>
                      <th className="py-3 px-4 text-right">{t('bags_3')}</th>
                      <th className="py-3 px-4 text-right">{t('weight_qtl_2')}</th>
                      <th className="py-3 px-4 text-right">{t('qtl_3')}</th>
                      <th className="py-3 px-4 text-right">{t('net')}</th>
                      <th className="py-3 px-4 text-center">{t('status_2')}</th>
                      <th className="py-3 px-4 text-center">{t('actions_2')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                          {sale.saleNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {sale.date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div>{sale.buyerName}</div>
                          {sale.buyerLocation && (
                            <span className="text-[10px] text-slate-500 font-normal">
                              📍 {sale.buyerLocation}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {sale.commodityName}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {sale.bags || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-950">
                          {sale.weightQuintals} Qtl
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          ₹{sale.saleRate}
                        </td>
                        <td className="py-3 px-4 text-right font-black font-serif text-emerald-800 text-sm">
                          {formatCurrency(sale.netAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sale.paymentStatus === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sale.paymentStatus === 'Partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sale.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingSaleSlip(sale)}
                              title="View / Print Sale Slip"
                              className="p-1.5 rounded-md text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              title="Delete sale (revert stock)"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD MANDI SALE (मंडी विक्री नोंदणी फॉर्म)                      */}
      {/* ========================================================================= */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 p-4 text-white flex items-center justify-between border-b border-amber-400/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base text-amber-300">
                    {t('record_mandi_grain_sale')}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    {t('outward_sale_automatically_deducts_available')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {saleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{saleError}</span>
                </div>
              )}

              {/* 1. Grain Selection & Live Available Stock Indicator */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {t('select_commodity_grain')}
                </label>
                <select
                  required
                  value={saleForm.commodityId}
                  onChange={e => setSaleForm({ ...saleForm, commodityId: e.target.value })}
                  className="w-full text-xs h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-semibold text-slate-900 focus:bg-white"
                >
                  <option value="">{t('select_grain')}</option>
                  {stockList.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {tf('commodity_available_stock', { name: c.commodityName, qtl: c.quintals, bags: c.bags })}
                    </option>
                  ))}
                </select>

                {selectedSaleCommodity && (
                  <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                    <span className="text-emerald-900 font-bold">
                      {selectedSaleCommodity.commodityName} {t('in_godown')}
                    </span>
                    <strong className="text-emerald-800 font-serif font-black">
                      {selectedSaleCommodity.quintals} Qtl / {selectedSaleCommodity.bags} {t('bags')}
                    </strong>
                  </div>
                )}
              </div>

              {/* 2. Buyer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('buyer_mill_name')}
                  </label>
                  <Input
                    required
                    type="text"
                    placeholder={t('e_g_rathi_oil_mill_gupta_traders')}
                    value={saleForm.buyerName}
                    onChange={e => setSaleForm({ ...saleForm, buyerName: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('buyer_mobile_mandi')}
                  </label>
                  <Input
                    type="text"
                    placeholder={t('e_g_9823000000_washim_mandi')}
                    value={saleForm.buyerLocation}
                    onChange={e => setSaleForm({ ...saleForm, buyerLocation: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* 3. Date & Vehicle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('sale_date')}
                  </label>
                  <Input
                    type="date"
                    value={saleForm.date}
                    onChange={e => setSaleForm({ ...saleForm, date: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('vehicle_truck_no')}
                  </label>
                  <Input
                    type="text"
                    placeholder={t('e_g_mh_29_ay_4512')}
                    value={saleForm.vehicleNumber}
                    onChange={e => setSaleForm({ ...saleForm, vehicleNumber: e.target.value })}
                    className="text-xs h-9 uppercase font-mono"
                  />
                </div>
              </div>

              {/* 4. Weight & Rate */}
              <div className="grid grid-cols-3 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    {t('bags_2')}
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    placeholder={t('e_g_50')}
                    value={saleForm.bags}
                    onChange={e => setSaleForm({ ...saleForm, bags: e.target.value })}
                    className="text-xs h-9 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    {t('weight_qtl')}
                  </label>
                  <Input
                    required
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder={t('e_g_25_50')}
                    value={saleForm.weightQuintals}
                    onChange={e => setSaleForm({ ...saleForm, weightQuintals: e.target.value })}
                    className="text-xs h-9 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    {t('rate_qtl')}
                  </label>
                  <Input
                    required
                    type="number"
                    inputMode="decimal"
                    step="1"
                    placeholder={t('e_g_5200')}
                    value={saleForm.saleRate}
                    onChange={e => setSaleForm({ ...saleForm, saleRate: e.target.value })}
                    className="text-xs h-9 bg-white font-bold"
                  />
                </div>
              </div>

              {/* 5. Deductions (Hamali, Transport, Cess) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    {t('hamali')}
                  </label>
                  <Input
                    type="number"
                    step="1"
                    value={saleForm.hamali}
                    onChange={e => setSaleForm({ ...saleForm, hamali: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    {t('transport')}
                  </label>
                  <Input
                    type="number"
                    step="1"
                    value={saleForm.transport}
                    onChange={e => setSaleForm({ ...saleForm, transport: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    {t('mandi_cess')}
                  </label>
                  <Input
                    type="number"
                    step="1"
                    value={saleForm.mandiCess}
                    onChange={e => setSaleForm({ ...saleForm, mandiCess: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
              </div>

              {/* Live Calculation Spotlight */}
              <div className="bg-emerald-950 text-white p-3.5 rounded-xl border border-amber-400/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                    {t('net_sale_amount')}
                  </span>
                  <div className="text-xl font-black font-serif text-amber-300">
                    {formatCurrency(calcSaleNetAmount())}
                  </div>
                </div>

                <div className="text-right text-[11px] text-emerald-200">
                  <div>{t('subtotal')}{calcSaleSubtotal().toFixed(0)}</div>
                  {selectedSaleCommodity && (
                    <div className="text-[10px] text-amber-300 mt-0.5">
                      {t('expected_profit')}{Math.max(0, calcSaleSubtotal() - (parseFloat(saleForm.weightQuintals) || 0) * selectedSaleCommodity.avgPurchaseRate).toFixed(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t('payment_status')}
                  </label>
                  <select
                    value={saleForm.paymentStatus}
                    onChange={e => setSaleForm({ ...saleForm, paymentStatus: e.target.value })}
                    className="w-full text-xs h-9 bg-white border border-slate-300 rounded-lg px-2"
                  >
                    <option value="Paid">{t('paid')}</option>
                    <option value="Partial">{t('partial')}</option>
                    <option value="Pending">{t('credit_pending')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t('payment_mode')}
                  </label>
                  <select
                    value={saleForm.paymentMode}
                    onChange={e => setSaleForm({ ...saleForm, paymentMode: e.target.value })}
                    className="w-full text-xs h-9 bg-white border border-slate-300 rounded-lg px-2"
                  >
                    <option value="Cash">{t('cash_2')}</option>
                    <option value="Bank Transfer">Bank Transfer (RTGS/NEFT)</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="text-xs h-9"
                >
                  {t('cancel_2')}
                </Button>
                <Button
                  type="submit"
                  disabled={saleSubmitting}
                  size="sm"
                  className="text-xs h-9 bg-emerald-800 hover:bg-emerald-900 text-amber-200 font-bold px-5"
                >
                  {saleSubmitting
                    ? t('recording')
                    : t('record_sale_deduct_stock')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: OPENING GODOWN STOCK / ADJUSTMENT (सुरुवातीचा साठा)                */}
      {/* ========================================================================= */}
      {isAdjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif font-black text-sm text-white">
                  {t('opening_stock_adjustment')}
                </h3>
              </div>
              <button onClick={() => setIsAdjModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {adjError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {adjError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {t('select_commodity')}
                </label>
                <select
                  required
                  value={adjForm.commodityId}
                  onChange={e => setAdjForm({ ...adjForm, commodityId: e.target.value })}
                  className="w-full text-xs h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-medium"
                >
                  <option value="">{t('select')}</option>
                  {stockList.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.commodityName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('weight_qtl')}
                  </label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    placeholder={t('e_g_50_00')}
                    value={adjForm.weightQuintals}
                    onChange={e => setAdjForm({ ...adjForm, weightQuintals: e.target.value })}
                    className="text-xs h-9 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('bags_count')}
                  </label>
                  <Input
                    type="number"
                    step="1"
                    placeholder={t('e_g_100')}
                    value={adjForm.bags}
                    onChange={e => setAdjForm({ ...adjForm, bags: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {t('book_rate_qtl')}
                </label>
                <Input
                  type="number"
                  step="1"
                  placeholder={t('e_g_4800')}
                  value={adjForm.rate}
                  onChange={e => setAdjForm({ ...adjForm, rate: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {t('reason_note')}
                </label>
                <Input
                  type="text"
                  value={adjForm.reason}
                  onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdjModalOpen(false)}
                  className="text-xs h-9"
                >
                  {t('cancel_2')}
                </Button>
                <Button
                  type="submit"
                  disabled={adjSubmitting}
                  size="sm"
                  className="text-xs h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  {adjSubmitting ? t('adding') : t('add_to_godown_stock')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW / PRINT MANDI SALE SLIP (मंडी विक्री पावती)                */}
      {/* ========================================================================= */}
      {viewingSaleSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header Toolbar */}
            <div className="bg-slate-900 p-3 text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-amber-300">
                {t('mandi_delivery_slip')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  <Printer className="w-3 h-3 mr-1" />
                  {t('print')}
                </Button>
                <button
                  onClick={() => setViewingSaleSlip(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Slip */}
            <div className="p-6 space-y-4 print:p-0">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={OFFICIAL_LOGO_SRC}
                    alt="Logo"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 object-contain filter drop-shadow-xs"
                  />
                  <div>
                    <h3 className="font-serif font-black text-lg text-slate-950 uppercase">
                      {businessProfile?.businessName || ''}
                    </h3>
                    <p className="text-[10px] text-slate-600 font-semibold">
                      {businessProfile?.address
                        || 'Authorised Mandi Commission Agent'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                    {t('outward_slip')}
                  </span>
                  <div className="font-mono font-bold text-xs text-slate-900 mt-1">
                    {viewingSaleSlip.saleNumber}
                  </div>
                  <div className="text-[10px] text-slate-500">{viewingSaleSlip.date}</div>
                </div>
              </div>

              {/* Buyer info */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{t('buyer_2')}</span>
                  <div className="font-bold text-slate-950">{viewingSaleSlip.buyerName}</div>
                  {viewingSaleSlip.buyerLocation && (
                    <div className="text-slate-600 text-[11px]">📍 {viewingSaleSlip.buyerLocation}</div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{t('vehicle_number')}</span>
                  <div className="font-mono font-bold text-slate-900">
                    {viewingSaleSlip.vehicleNumber || t('hand_sale_tempo')}
                  </div>
                </div>
              </div>

              {/* Commodity & Weight table */}
              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2 border">{t('commodity')}</th>
                    <th className="p-2 border text-right">{t('bags_4')}</th>
                    <th className="p-2 border text-right">{t('qtl_2')}</th>
                    <th className="p-2 border text-right">{t('qtl_3')}</th>
                    <th className="p-2 border text-right">{t('amount_2')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border font-bold text-slate-900">{viewingSaleSlip.commodityName}</td>
                    <td className="p-2 border text-right">{viewingSaleSlip.bags || '-'}</td>
                    <td className="p-2 border text-right font-bold">{viewingSaleSlip.weightQuintals}</td>
                    <td className="p-2 border text-right">₹{viewingSaleSlip.saleRate}</td>
                    <td className="p-2 border text-right font-bold">{formatCurrency(viewingSaleSlip.subtotal)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Deductions & Total */}
              <div className="flex justify-end text-xs">
                <div className="w-56 space-y-1">
                  {(viewingSaleSlip.hamali > 0 || viewingSaleSlip.transport > 0) && (
                    <>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>{t('hamali_2')}</span>
                        <span>- ₹{viewingSaleSlip.hamali}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>{t('transport_2')}</span>
                        <span>- ₹{viewingSaleSlip.transport}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-black text-slate-950 border-t-2 border-slate-900 pt-1 text-sm font-serif">
                    <span>{t('total_payable')}</span>
                    <span>{formatCurrency(viewingSaleSlip.netAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Signature stamp area */}
              <div className="pt-6 flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200">
                <div className="text-center">
                  <div className="h-8"></div>
                  <div>{t('buyer_signature')}</div>
                </div>
                <div className="text-center">
                  <div className="h-8"></div>
                  <div className="font-bold text-slate-950">{t('authorised_broker_signature')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingSaleDelete !== null}
        tone="danger"
        title={t('cancel_this_sale')}
        message={
          t('the_sale_record_will_be_removed_and_the_quan')
        }
        confirmLabel={t('yes_cancel_it')}
        cancelLabel={t('keep_it')}
        onConfirm={confirmDeleteSale}
        onCancel={() => setPendingSaleDelete(null)}
      />

    </div>
  );
}
