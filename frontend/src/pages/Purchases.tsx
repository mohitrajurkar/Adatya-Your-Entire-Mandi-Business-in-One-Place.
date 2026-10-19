import { useEffect, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { formatCurrency } from '../lib/utils';
import { generateBillPdfDoc, shareBillPdfToWhatsApp } from '../lib/pdfGenerator';
import {
  Plus,
  Search,
  FileText,
  MessageSquare,
  Eye,
  Filter,
  ArrowUpDown,
  Building2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import WhatsAppShareModal from '../components/WhatsAppShareModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Pending'>('All');
  const [selectedForWhatsApp, setSelectedForWhatsApp] = useState<any | null>(null);
  const [sharingPurchaseId, setSharingPurchaseId] = useState<number | null>(null);

  useEffect(() => {
    fetchPurchases();
    fetch(`${API_URL}/profile`)
      .then(res => res.json())
      .then(setProfile)
      .catch(console.error);
  }, []);

  const fetchPurchases = async () => {
    try {
      const res = await fetch(`${API_URL}/purchases`);
      const data = await res.json();
      if (Array.isArray(data)) setPurchases(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDirectWhatsApp = async (purchase: any) => {
    try {
      setSharingPurchaseId(purchase.id);
      const res = await fetch(`${API_URL}/purchases/${purchase.id}`);
      const fullData = await res.json();

      const userJson = localStorage.getItem('user');
      let user: any = null;
      try {
        if (userJson) user = JSON.parse(userJson);
      } catch {}

      const activeBusiness = {
        businessName: user?.businessName || profile?.businessName || 'Bodhale Purchaser',
        proprietorName: user?.name || profile?.proprietorName || 'Maroti V Bodhale',
        address: user?.apmcLocation || profile?.address || 'APMC Mandi Yard',
        mobile1: profile?.mobile1 || user?.mobile || '8805978780',
        mobile2: profile?.mobile2 || '9604655124',
        mandiLicense: profile?.mandiLicense || 'APMC/MRG/2024-88',
        signatureName: profile?.signatureName || user?.name || 'M. V. Bodhale',
        tagline: profile?.tagline || 'Your ledger, your control.'
      };

      const rawMobile = fullData?.farmer?.mobile || purchase?.farmerMobile || '';
      const digits = rawMobile.replace(/\D/g, '');
      const cleanDigits = digits.length === 10 ? digits : digits.length > 10 ? digits.slice(-10) : '';

      // Generate official Bill PDF
      const doc = generateBillPdfDoc(fullData, activeBusiness);
      const pdfBlob = doc.output('blob');

      // Share PDF directly to WhatsApp - NO text
      await shareBillPdfToWhatsApp(pdfBlob, fullData.purchaseNumber, cleanDigits);
    } catch (err) {
      console.error('Error generating and sharing WhatsApp PDF:', err);
      setSelectedForWhatsApp(purchase);
    } finally {
      setSharingPurchaseId(null);
    }
  };

  const handleOpenWhatsApp = async (purchase: any) => {
    try {
      // Fetch full purchase details with items for accurate WhatsApp message
      const res = await fetch(`${API_URL}/purchases/${purchase.id}`);
      const fullData = await res.json();
      setSelectedForWhatsApp(fullData);
    } catch (e) {
      console.error(e);
      // Fallback
      setSelectedForWhatsApp(purchase);
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch =
      p.purchaseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.farmerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.farmerVillage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.farmerMobile?.includes(searchTerm);

    const matchesStatus =
      statusFilter === 'All' ? true : p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalProcured = purchases.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const totalPaid = purchases.reduce((acc, curr) => acc + (curr.advancePaid || 0), 0);
  const totalPending = purchases.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-950">Crop Purchases & Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Record farmer commodity purchases, track payments, and share official bills
          </p>
        </div>
        <Link to="/purchases/new">
          <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm font-semibold border border-slate-700">
            <Plus className="mr-2 h-4 w-4" /> New Purchase Entry
          </Button>
        </Link>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchases</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalProcured)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{purchases.length} total transaction vouchers</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Paid</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Disbursed to farmers</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Dues</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalPending)}</div>
          <div className="text-xs text-rose-500 mt-0.5">Outstanding balances</div>
        </div>
      </div>

      {/* Main Table Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="overflow-hidden border border-slate-200/80 shadow-sm">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search invoice, farmer name, village..."
                className="pl-9 bg-white border-slate-200 shadow-2xs"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
              {(['All', 'Paid', 'Partial', 'Pending'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === tab
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Optimized Card View (< md) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredPurchases.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                कोणतीही पावती सापडली नाही (No purchase entries found)
              </div>
            ) : (
              filteredPurchases.map(purchase => (
                <div key={purchase.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/invoice/${purchase.id}`}
                      className="font-mono text-xs font-black text-slate-950 hover:text-emerald-700"
                    >
                      {purchase.purchaseNumber}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {purchase.date ? format(new Date(purchase.date), 'dd MMM yyyy') : '-'}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
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
                  </div>

                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {purchase.farmerName || 'Farmer'}
                    </div>
                    {purchase.farmerVillage && (
                      <div className="text-xs text-slate-500">
                        गाव: {purchase.farmerVillage}
                      </div>
                    )}
                  </div>

                  {/* 3-Col Metric Snapshot */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">एकूण रक्कम</div>
                      <div className="text-xs font-black text-slate-900 mt-0.5">{formatCurrency(purchase.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">अगाऊ (Advance)</div>
                      <div className="text-xs font-black text-emerald-700 mt-0.5">{formatCurrency(purchase.advancePaid)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">बाकी (Due)</div>
                      <div className={`text-xs font-black mt-0.5 ${purchase.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {formatCurrency(purchase.remainingAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDirectWhatsApp(purchase)}
                      disabled={sharingPurchaseId === purchase.id}
                      className="w-full py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-300 shadow-2xs"
                    >
                      {sharingPurchaseId === purchase.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> PDF...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-3.5 w-3.5 fill-emerald-700" /> WhatsApp PDF
                        </>
                      )}
                    </button>

                    <Link to={`/invoice/${purchase.id}`} className="w-full">
                      <button
                        type="button"
                        className="w-full py-2 rounded-xl text-slate-800 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1 border border-slate-300 bg-white shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5" /> पावती पहा
                      </button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-bold tracking-wider">Invoice No.</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider">Date</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider">Farmer</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-right">Total Amount</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-right">Advance Paid</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-right">Balance Due</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-center">Status</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No purchase entries found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(purchase => (
                    <tr key={purchase.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900 group-hover:text-emerald-700">
                        <Link to={`/invoice/${purchase.id}`} className="hover:underline">
                          {purchase.purchaseNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
                        {purchase.date ? format(new Date(purchase.date), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {purchase.farmerName || 'Farmer'}
                        </div>
                        {purchase.farmerVillage && (
                          <div className="text-[11px] text-slate-500">
                            {purchase.farmerVillage}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 text-right">
                        {formatCurrency(purchase.totalAmount)}
                      </td>
                      <td className="px-5 py-4 text-emerald-700 font-semibold text-right">
                        {formatCurrency(purchase.advancePaid)}
                      </td>
                      <td className="px-5 py-4 font-bold text-right">
                        <span className={purchase.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          {formatCurrency(purchase.remainingAmount)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            purchase.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : purchase.status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {purchase.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click WhatsApp PDF Share Button */}
                          <button
                            type="button"
                            onClick={() => handleDirectWhatsApp(purchase)}
                            disabled={sharingPurchaseId === purchase.id}
                            title="Share Bill PDF on WhatsApp (No text)"
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-emerald-300 hover:border-emerald-600 shadow-2xs"
                          >
                            {sharingPurchaseId === purchase.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> PDF...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-3.5 w-3.5 fill-emerald-700 hover:fill-white" /> WhatsApp PDF
                              </>
                            )}
                          </button>

                          {/* View Bill Button */}
                          <Link to={`/invoice/${purchase.id}`}>
                            <button
                              type="button"
                              title="View & Print Bill"
                              className="px-2 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-xs font-semibold flex items-center gap-1 border border-slate-200 bg-white"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
