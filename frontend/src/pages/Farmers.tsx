import React, { useEffect, useState } from 'react';
import { Plus, MapPin, Phone, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  MobileInput,
  DataTable,
  MoneyText,
  useToast,
} from '../components/ui';
import type { Column } from '../components/ui';

interface Farmer {
  id: number;
  name: string;
  village?: string;
  mobile?: string;
  outstandingBalance: number;
  createdAt?: string;
}

/**
 * The farmer register.
 *
 * The list was previously two hand-written blocks: a card list for phones and
 * a separate table for desktop, duplicating every field, with a search box
 * that filtered in place and no sorting, paging or empty state. Both are now
 * one DataTable, which brings sortable columns, paging and a proper empty
 * state, and keeps the stacked card layout on a phone.
 */
export default function Farmers() {
  const { t } = useLanguage();
  const toast = useToast();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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
        }),
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

  const columns: Column<Farmer>[] = [
    {
      key: 'name',
      header: 'Farmer',
      value: row => row.name,
      render: row => (
        <div>
          <div className="font-semibold text-ink">{row.name}</div>
          {row.village && (
            <div className="mt-0.5 flex items-center gap-1 text-2xs text-ink-subtle">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {row.village}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'village',
      header: 'Village',
      value: row => row.village ?? '',
      render: row => <span className="text-ink-muted">{row.village || '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'mobile',
      header: 'Mobile',
      value: row => row.mobile ?? '',
      // A tap-to-call link is the single most used control on this page.
      render: row =>
        row.mobile ? (
          <a
            href={`tel:${row.mobile}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-control border border-brand-200 bg-brand-50 px-2.5 py-1 text-2xs font-semibold text-brand-800 hover:bg-brand-100"
          >
            <Phone className="h-3 w-3" aria-hidden="true" />
            {row.mobile}
          </a>
        ) : (
          <span className="text-2xs text-ink-subtle">{t('no_mobile_on_record')}</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      value: row => row.createdAt ?? '',
      render: row => (
        <span className="text-ink-muted">
          {row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy') : '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'outstandingBalance',
      header: t('outstanding_balance'),
      align: 'right',
      value: row => Number(row.outstandingBalance ?? 0),
      render: row => (
        <MoneyText
          value={row.outstandingBalance}
          className={
            Number(row.outstandingBalance) > 0 ? 'font-semibold text-due-fg' : 'text-ink-muted'
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Farmers</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Manage registered farmers and their outstanding balances
          </p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="h-4 w-4" /> Add Farmer
        </Button>
      </div>

      {isAdding && (
        <Card className="border-brand-200">
          <CardHeader>
            <CardTitle>Register New Farmer</CardTitle>
          </CardHeader>
          <CardContent>
            {formError && (
              <p
                className="mb-3 rounded-control bg-due-bg px-3 py-2 text-xs font-medium text-due-fg"
                role="alert"
              >
                {formError}
              </p>
            )}
            <form onSubmit={handleAddFarmer} className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="farmer-name" className="block text-2xs font-semibold tracking-wide text-ink uppercase">
                  Full Name <span className="text-due-fg">*</span>
                </label>
                <Input
                  id="farmer-name"
                  required
                  autoFocus
                  value={newFarmer.name}
                  onChange={e => setNewFarmer({ ...newFarmer, name: e.target.value })}
                  placeholder={t('e_g_gajanan_pawar')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="farmer-village" className="block text-2xs font-semibold tracking-wide text-ink uppercase">
                  Village <span className="text-due-fg">*</span>
                </label>
                <Input
                  id="farmer-village"
                  required
                  value={newFarmer.village}
                  onChange={e => setNewFarmer({ ...newFarmer, village: e.target.value })}
                  placeholder={t('e_g_maregaon')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="farmer-mobile" className="block text-2xs font-semibold tracking-wide text-ink uppercase">
                  Mobile <span className="font-normal text-ink-subtle">(optional)</span>
                </label>
                <MobileInput
                  id="farmer-mobile"
                  value={newFarmer.mobile}
                  onValueChange={v => setNewFarmer({ ...newFarmer, mobile: v })}
                  placeholder="10-digit number"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable
        rows={farmers}
        columns={columns}
        rowKey={row => row.id}
        loading={loading}
        searchPlaceholder="Search by name, village or mobile…"
        caption="Registered farmers and their outstanding balances"
        emptyIcon={<Users className="h-5 w-5" aria-hidden="true" />}
        emptyTitle={t('no_farmers_found')}
        emptyDescription="Add the farmers you buy from, and their outstanding balances will build up here as you record purchases."
        emptyAction={
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" /> Add your first farmer
          </Button>
        }
      />
    </div>
  );
}
