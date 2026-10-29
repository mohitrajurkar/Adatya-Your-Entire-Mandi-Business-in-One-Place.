import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Card,
  Button,
  DataTable,
  MoneyText,
  StatusBadge,
} from '../components/ui';
import type { Column, PaymentStatus } from '../components/ui';
import { generateBillPdfDoc, shareBillPdfToWhatsApp } from '../lib/pdfGenerator';
import {
  Plus,
  FileText,
  MessageSquare,
  Eye,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import { apiFetch } from '../lib/api';


export default function Purchases() {
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Pending'>('All');
  const [selectedForWhatsApp, setSelectedForWhatsApp] = useState<any | null>(null);
  const [sharingPurchaseId, setSharingPurchaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    totalPurchases: number;
    totalValue: number;
    totalPaid: number;
    totalOutstanding: number;
  } | null>(null);

  useEffect(() => {
    fetchPurchases();
    // Server-computed totals, so every screen quotes the same figures.
    apiFetch(`/purchases/summary`)
      .then(res => res.json())
      .then(data => { if (data && !data.error) setSummary(data); })
      .catch(() => {});
    apiFetch(`/profile`)
      .then(res => res.json())
      .then(setProfile)
      .catch(console.error);
  }, []);

  const fetchPurchases = async () => {
    try {
      const res = await apiFetch(`/purchases`);
      const data = await res.json();
      if (Array.isArray(data)) setPurchases(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectWhatsApp = async (purchase: any) => {
    try {
      setSharingPurchaseId(purchase.id);
      const res = await apiFetch(`/purchases/${purchase.id}`);
      const fullData = await res.json();

      const userJson = localStorage.getItem('user');
      let user: any = null;
      try {
        if (userJson) user = JSON.parse(userJson);
      } catch {}

      const activeBusiness = {
        businessName: user?.businessName || profile?.businessName || '',
        proprietorName: user?.name || profile?.proprietorName || '',
        address: user?.apmcLocation || profile?.address || 'APMC Mandi Yard',
        mobile1: profile?.mobile1 || user?.mobile || '',
        mobile2: profile?.mobile2 || '',
        mandiLicense: profile?.mandiLicense || '',
        signatureName: profile?.signatureName || user?.name || '',
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
      const res = await apiFetch(`/purchases/${purchase.id}`);
      const fullData = await res.json();
      setSelectedForWhatsApp(fullData);
    } catch (e) {
      console.error(e);
      // Fallback
      setSelectedForWhatsApp(purchase);
    }
  };

  // The status tabs narrow the rows; search, sorting and paging belong to the
  // table itself.
  const visiblePurchases =
    statusFilter === 'All' ? purchases : purchases.filter(p => p.status === statusFilter);

  const columns: Column<any>[] = [
    {
      key: 'purchaseNumber',
      header: 'Bill No.',
      value: row => row.purchaseNumber ?? '',
      render: row => (
        <span className="font-semibold text-ink">{row.purchaseNumber}</span>
      ),
    },
    {
      key: 'farmer',
      header: 'Farmer',
      value: row => `${row.farmerName ?? ''} ${row.farmerVillage ?? ''} ${row.farmerMobile ?? ''}`,
      render: row => (
        <div>
          <div className="text-ink">{row.farmerName}</div>
          {row.farmerVillage && (
            <div className="text-2xs text-ink-subtle">{row.farmerVillage}</div>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      value: row => row.date ?? '',
      render: row => (
        <span className="text-ink-muted">
          {row.date ? format(new Date(row.date), 'dd MMM yyyy') : '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      value: row => Number(row.totalAmount ?? 0),
      render: row => <MoneyText value={row.totalAmount} className="font-semibold text-ink" />,
    },
    {
      key: 'advancePaid',
      header: 'Paid',
      align: 'right',
      value: row => Number(row.advancePaid ?? 0),
      render: row => <MoneyText value={row.advancePaid} className="text-paid-fg" />,
      hideOnMobile: true,
    },
    {
      key: 'remainingAmount',
      header: 'Due',
      align: 'right',
      value: row => Number(row.remainingAmount ?? 0),
      render: row => (
        <MoneyText
          value={row.remainingAmount}
          className={Number(row.remainingAmount) > 0 ? 'font-semibold text-due-fg' : 'text-ink-subtle'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      value: row => row.status ?? '',
      render: row => <StatusBadge status={(row.status || 'Pending') as PaymentStatus} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: row => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleDirectWhatsApp(row); }}
            disabled={sharingPurchaseId === row.id}
            title="Share bill PDF on WhatsApp"
            className="inline-flex items-center gap-1.5 rounded-control border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-2xs font-semibold text-brand-800 transition-colors hover:bg-brand-100 disabled:opacity-60"
          >
            {sharingPurchaseId === row.id ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> PDF…</>
            ) : (
              <><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp</>
            )}
          </button>
          <Link to={`/invoice/${row.id}`} onClick={e => e.stopPropagation()}>
            <span className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-2xs font-semibold text-ink-muted transition-colors hover:text-ink">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t('view_bill')}
            </span>
          </Link>
        </div>
      ),
    },
  ];

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

      {/* Totals are the server's, so this page cannot disagree with the
          dashboard. They were previously summed from the loaded rows. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">Total Purchases</div>
          <MoneyText value={summary?.totalValue} className="mt-1 block text-2xl font-bold text-ink" />
          <div className="mt-0.5 text-2xs text-ink-subtle">
            {summary?.totalPurchases ?? purchases.length} transaction vouchers
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">Amount Paid</div>
          <MoneyText value={summary?.totalPaid} className="mt-1 block text-2xl font-bold text-paid-fg" />
          <div className="mt-0.5 text-2xs text-ink-subtle">Disbursed to farmers</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">Pending Dues</div>
          <MoneyText value={summary?.totalOutstanding} className="mt-1 block text-2xl font-bold text-due-fg" />
          <div className="mt-0.5 text-2xs text-ink-subtle">Outstanding balances</div>
        </Card>
      </div>

      <DataTable
        rows={visiblePurchases}
        columns={columns}
        rowKey={row => row.id}
        loading={loading}
        searchPlaceholder="Search bill number, farmer, village or mobile…"
        caption="Crop purchase bills"
        toolbar={
          <div className="flex items-center gap-1 rounded-control bg-surface-sunken p-1">
            {(['All', 'Paid', 'Partial', 'Pending'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                aria-pressed={statusFilter === tab}
                className={
                  'rounded px-3 py-1.5 text-2xs font-semibold transition-colors ' +
                  (statusFilter === tab
                    ? 'bg-surface text-ink shadow-card'
                    : 'text-ink-muted hover:text-ink')
                }
              >
                {tab}
              </button>
            ))}
          </div>
        }
        emptyIcon={<FileText className="h-5 w-5" aria-hidden="true" />}
        emptyTitle={statusFilter === 'All' ? t('no_purchases_found') : `No ${statusFilter.toLowerCase()} bills`}
        emptyDescription={
          statusFilter === 'All'
            ? 'Record your first purchase from a farmer and the bill will appear here, ready to print or share.'
            : 'Try a different status filter to see other bills.'
        }
        emptyAction={
          statusFilter === 'All' ? (
            <Link to="/purchases/new">
              <Button>
                <Plus className="h-4 w-4" /> Record a purchase
              </Button>
            </Link>
          ) : undefined
        }
      />

    </div>
  );
}
