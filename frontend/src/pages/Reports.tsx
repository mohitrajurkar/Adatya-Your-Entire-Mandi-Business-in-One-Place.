import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCurrency } from '../lib/utils';
import { FileText, Download, TrendingUp, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion } from 'motion/react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/dashboard`)
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const res = await fetch(`${API_URL}/backup/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adatya_business_report_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (!stats || stats.error) return (
    <div className="flex h-[400px] items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Loading reports...</p>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-slate-900">
            व्यवसाय अहवाल (Business Reports)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            व्यापार, शेतकरी हिशोब आणि आर्थिक ताळेबंद अहवाल
          </p>
        </div>
        <Button
          variant="outline"
          disabled={exporting}
          onClick={handleExportAll}
          className="bg-white border-slate-300 text-xs font-bold h-10 px-4 self-start sm:self-auto shadow-2xs"
        >
          <Download className="mr-2 h-4 w-4" /> {exporting ? 'डाऊनलोड होत आहे...' : 'Export All Data'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center space-y-0 bg-blue-50/50 rounded-t-2xl pb-4 border-b border-blue-100">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-slate-600 font-medium">Total Purchase Value</span>
              <span className="font-bold text-lg text-slate-900">{formatCurrency(stats.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-slate-600 font-medium">Total Advance Paid</span>
              <span className="font-bold text-lg text-emerald-600">{formatCurrency(stats.totalAmount - stats.pendingPayments)}</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-slate-600 font-medium">Total Outstanding</span>
              <span className="font-bold text-xl text-orange-600">{formatCurrency(stats.pendingPayments)}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center space-y-0 bg-purple-50/50 rounded-t-2xl pb-4 border-b border-purple-100">
            <div className="bg-purple-100 p-2 rounded-lg mr-3">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Operational Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-slate-600 font-medium">Total Transactions</span>
              <span className="font-bold text-lg text-slate-900">{stats.totalPurchases}</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-slate-600 font-medium">Active Farmers</span>
              <span className="font-bold text-lg text-slate-900">{stats.activeFarmers}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
