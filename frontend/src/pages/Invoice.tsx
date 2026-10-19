import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatCurrency, numberToWordsINR } from '../lib/utils';
import { generateBillPdfDoc, shareBillPdfToWhatsApp } from '../lib/pdfGenerator';
import { format } from 'date-fns';
import {
  Printer,
  ArrowLeft,
  CreditCard,
  MessageSquare,
  Calendar,
  User,
  Phone,
  MapPin,
  PenTool,
  Palette,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import PaidStamp from '../components/PaidStamp';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import ThemeSelectorModal from '../components/ThemeSelectorModal';
import { OFFICIAL_LOGO_SRC } from '../config/logos';
import { useTheme, THEMES, AppThemeId, BillStyleId } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';


export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const { language } = useLanguage();

  const {
    currentTheme,
    themeId,
    setThemeId,
    billStyle,
    setBillStyle,
    isThemeModalOpen,
    setIsThemeModalOpen
  } = useTheme();

  const fetchInvoice = () => {
    apiFetch(`/purchases/${id}`)
      .then(res => res.json())
      .then(purchaseData => {
        setData(purchaseData);
        if (purchaseData.profile) {
          setProfile(purchaseData.profile);
        } else {
          apiFetch(`/profile`)
            .then(r => r.json())
            .then(setProfile)
            .catch(console.error);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  if (!data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-medium">Loading invoice bill...</p>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-4">
        <div className="text-red-700 font-bold text-lg">Invoice Not Found</div>
        <p className="text-slate-600 text-sm">{data.error}</p>
        <Button onClick={() => navigate('/purchases')}>Back to Purchases</Button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handlePayment = async () => {
    if (paymentAmount <= 0) {
      setPaymentStatusMessage('Please enter a valid payment amount');
      return;
    }
    setIsSubmittingPayment(true);
    setPaymentStatusMessage(null);
    try {
      const res = await apiFetch(`/purchases/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMode,
          paymentDate: format(new Date(), 'yyyy-MM-dd')
        })
      });
      if (res.ok) {
        setShowPaymentModal(false);
        fetchInvoice();
      } else {
        setPaymentStatusMessage('Failed to record payment. Please try again.');
      }
    } catch (error) {
      console.error(error);
      setPaymentStatusMessage('Network error while processing payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const userJson = localStorage.getItem('user');
  let user: any = null;
  try {
    if (userJson) user = JSON.parse(userJson);
  } catch {}

  const activeBusiness = {
    businessName: user?.businessName || profile?.businessName || '',
    proprietorName: user?.name || profile?.proprietorName || '',
    address: user?.apmcLocation || profile?.address || '',
    mobile1: profile?.mobile1 || user?.mobile || '',
    mobile2: profile?.mobile2 || '',
    mandiLicense: profile?.mandiLicense || '',
    gstin: profile?.gstin || '',
    upiId: profile?.upiId || '',
    signatureData: profile?.signatureData || null,
    signatureName: profile?.signatureName || user?.name || 'Authorized Signatory',
    tagline: profile?.tagline || 'Your ledger, your control.',
  };

  const handleSendPdfOnWhatsApp = async () => {
    setIsGeneratingPdf(true);
    setPdfToast(null);

    try {
      const rawMobile = data?.farmer?.mobile || '';
      const digits = rawMobile.replace(/\D/g, '');
      const cleanDigits = digits.length === 10 ? digits : digits.length > 10 ? digits.slice(-10) : '';

      let pdfBlob: Blob | null = null;
      const billEl = document.getElementById('printable-bill');

      if (billEl) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const { jsPDF } = await import('jspdf');

          const canvas = await html2canvas(billEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          pdfBlob = pdf.output('blob');
        } catch (canvasErr) {
          console.warn('Canvas capture fallback:', canvasErr);
        }
      }

      if (!pdfBlob) {
        const doc = generateBillPdfDoc(data, activeBusiness);
        pdfBlob = doc.output('blob');
      }

      // Share PDF directly to WhatsApp - NO TEXT
      const result = await shareBillPdfToWhatsApp(pdfBlob, data.purchaseNumber, cleanDigits);

      if (result.method === 'native-share') {
        setPdfToast(
          language === 'mr'
            ? '📄 पावती PDF व्हॉट्सॲपवर पाठवली!'
            : '📄 Bill PDF shared directly on WhatsApp!'
        );
      } else {
        setPdfToast(
          language === 'mr'
            ? '📄 पावती PDF डाउनलोड झाली व व्हॉट्सॲप चॅट उघडले! कृपया फाईल पाठवा.'
            : '📄 Bill PDF downloaded & WhatsApp opened! Attach PDF to send.'
        );
      }
      setTimeout(() => setPdfToast(null), 5000);
    } catch (err) {
      console.error('PDF error:', err);
      setShowWhatsAppModal(true);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const wordsInInr = numberToWordsINR(data.totalAmount);

  // Dynamic Theme Colors for the Bill
  const themeBorder = currentTheme.billBorderColor;
  const themeTableHead = currentTheme.billTableHeadBg;
  const themeRibbonBg = currentTheme.billRibbonBg;

  return (
    <div className={`min-h-screen py-8 px-3 sm:px-6 transition-colors duration-200 ${currentTheme.lightBg}`}>
      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* WhatsApp Modal */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        data={data}
        profile={activeBusiness}
      />

      {/* Payment Settlement Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> Record Farmer Payment
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {paymentStatusMessage && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg font-medium">
                {paymentStatusMessage}
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Current Outstanding Balance
              </div>
              <div className="text-2xl font-bold text-rose-600">
                {formatCurrency(data.remainingAmount)}
              </div>
              <div className="text-xs text-slate-500">
                Farmer: <span className="font-semibold text-slate-800">{data.farmer?.name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Payment Amount (₹)
              </label>
              <Input
                type="number"
                step="1"
                max={data.remainingAmount}
                value={paymentAmount || ''}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="text-lg font-bold"
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Payment Mode
              </label>
              <select
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash (रोख)</option>
                <option value="UPI">UPI / PhonePe / GPay</option>
                <option value="Bank Transfer">NEFT / RTGS / Bank Transfer</option>
                <option value="Cheque">Cheque (धनादेश)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={isSubmittingPayment}>
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isSubmittingPayment}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              >
                {isSubmittingPayment ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-4">
        {/* PDF Toast Notification */}
        {pdfToast && (
          <div className="p-3.5 bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in">
            <span>{pdfToast}</span>
            <button onClick={() => setPdfToast(null)} className="text-white/80 hover:text-white text-xs font-mono ml-3">✕</button>
          </div>
        )}

        {/* Top Action Toolbar (Hidden during Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/purchases')} className="text-slate-600 hover:text-slate-900">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Purchases
            </Button>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bill #{data.purchaseNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Theme Selector Button */}
            <Button
              onClick={() => setIsThemeModalOpen(true)}
              variant="outline"
              size="sm"
              className="border-slate-300 text-slate-800 hover:border-amber-500 hover:bg-amber-50/50 flex items-center gap-1.5 font-semibold"
            >
              <Palette className="h-4 w-4 text-amber-600" />
              <span className="hidden md:inline">UI Themes:</span> {currentTheme.name.split(' ')[0]}
            </Button>

            {/* WhatsApp Send PDF Button */}
            <Button
              onClick={handleSendPdfOnWhatsApp}
              disabled={isGeneratingPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 text-xs px-3.5 shadow-sm"
              size="sm"
              title="Send bill PDF copy directly on WhatsApp"
            >
              <MessageSquare className="h-4 w-4" />
              {isGeneratingPdf
                ? (language === 'mr' ? 'PDF तयार होत आहे...' : 'Generating PDF...')
                : (language === 'mr' ? 'व्हॉट्सॲपवर PDF पाठवा' : 'Send PDF on WhatsApp')}
            </Button>

            {/* Pay Balance Button */}
            {data.remainingAmount > 0 && (
              <Button
                onClick={() => {
                  setPaymentAmount(data.remainingAmount);
                  setShowPaymentModal(true);
                }}
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-800 bg-slate-50 hover:bg-slate-100"
              >
                <CreditCard className="mr-1.5 h-4 w-4 text-slate-700" /> Pay Balance
              </Button>
            )}

            {/* Print Button */}
            <Button onClick={handlePrint} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
              <Printer className="mr-1.5 h-4 w-4" /> Print Bill
            </Button>

            {/* Link to Settings to change signature / profile */}
            <Link to="/settings">
              <Button variant="ghost" size="sm" title="Edit Signature / Profile" className="text-slate-500 hover:text-slate-800">
                <PenTool className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Interactive UI Options Bar for the User to Choose Layout Directly */}
        <div className="print:hidden bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Choose UI Style:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Color Theme Options Quick Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(Object.keys(THEMES) as AppThemeId[]).map((tid) => {
                const t = THEMES[tid];
                const isActive = themeId === tid;
                return (
                  <button
                    key={tid}
                    onClick={() => setThemeId(tid)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.swatches.primary }}
                    />
                    <span>{t.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Bill Layout Options Quick Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'royal-framed', label: '🏛️ Royal Frame' },
                { id: 'traditional-patrika', label: '📜 Vyapari Patrika' },
              ].map((style) => {
                const isActive = billStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setBillStyle(style.id as BillStyleId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white text-emerald-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* THE CLASSY & MODERN INVOICE BILL COPY                                     */}
        {/* ========================================================================= */}
        <div
          id="printable-bill"
          className={`p-3.5 sm:p-10 shadow-2xl rounded-2xl print:rounded-none print:shadow-none print:p-0 print:m-0 border print:border-none mx-auto max-w-[850px] relative transition-all overflow-x-auto sm:overflow-x-visible ${
            billStyle === 'traditional-patrika'
              ? 'bg-[#faf7f2] border-amber-900/30'
              : 'bg-white border-slate-300'
          }`}
        >
          {/* Outer Frame according to chosen Bill Style */}
          <div
            className={`p-1.5 rounded-xl print:rounded-none ${
              billStyle === 'royal-framed'
                ? `border-[3px] ${themeBorder}`
                : billStyle === 'traditional-patrika'
                ? `border-4 border-double ${themeBorder}`
                : 'border border-slate-300'
            }`}
          >
            <div
              className={`p-6 sm:p-8 flex flex-col min-h-[920px] relative rounded-lg print:rounded-none ${
                billStyle === 'traditional-patrika'
                  ? 'border border-amber-900/40 bg-[#fffdfa]'
                  : billStyle === 'royal-framed'
                  ? `border ${themeBorder} bg-white`
                  : 'bg-white border border-slate-200'
              }`}
            >
              {/* Optional Auspicious Traditional Invocation for Vyapari Patrika */}
              {billStyle === 'traditional-patrika' && (
                <div className="text-center text-xs font-serif font-bold text-amber-900 tracking-[0.2em] mb-2 select-none">
                  ॥ श्री गणेशाय नमः ॥
                </div>
              )}

              {/* Classy Header */}
              <div className={`relative z-10 pb-5 mb-6 border-b-2 ${themeBorder}`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Logo & Business Name */}
                  <div className="flex items-center gap-4 text-center sm:text-left">
                    <img
                      src={OFFICIAL_LOGO_SRC}
                      alt="Adatya Logo"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0 filter drop-shadow-sm"
                    />
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-wider text-slate-950 uppercase leading-none">
                        {activeBusiness.businessName}
                      </h1>
                      <div className="text-xs sm:text-sm font-semibold text-slate-700 mt-1.5">
                        Proprietor: <strong className="text-slate-950 font-bold">{activeBusiness.proprietorName}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Mandi Address & Mobile */}
                  <div className="text-center sm:text-right shrink-0 text-xs text-slate-700 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center justify-center sm:justify-end gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-600" /> {activeBusiness.address}
                    </div>
                    <div className="font-semibold text-slate-900 flex items-center justify-center sm:justify-end gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-600" /> Mobile: {activeBusiness.mobile1}
                      {activeBusiness.mobile2 && ` / ${activeBusiness.mobile2}`}
                    </div>
                  </div>
                </div>

                {/* Classy Center Banner Pill */}
                <div className="mt-5 flex items-center justify-center">
                  <div className="relative inline-flex items-center gap-3">
                    <span className="text-slate-400 font-serif text-sm">✦ ✦ ✦</span>
                    <div className={`${themeRibbonBg} text-white px-8 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] shadow-xs rounded-sm`}>
                      INVOICE BILL / खरेदी पावती
                    </div>
                    <span className="text-slate-400 font-serif text-sm">✦ ✦ ✦</span>
                  </div>
                </div>
              </div>

              {/* Farmer & Bill Metadata Grid */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 border border-slate-300 rounded-lg p-4 mb-6 text-sm">
                {/* Farmer Info */}
                <div className="space-y-1">
                  <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
                    Customer / Farmer Details (शेतकरी तपशील)
                  </div>
                  <div className="font-bold text-base text-slate-950 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-700 shrink-0" />
                    {data.farmer?.name}
                  </div>
                  <div className="text-xs text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Village: <strong className="text-slate-900">{data.farmer?.village || '—'}</strong>
                  </div>
                  {data.farmer?.mobile && (
                    <div className="text-xs text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      Mobile: <strong className="text-slate-900">+91 {data.farmer.mobile}</strong>
                    </div>
                  )}
                </div>

                {/* Invoice & Date Info */}
                <div className="space-y-1 sm:text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
                  <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
                    Bill Voucher Details (पावती तपशील)
                  </div>
                  <div className="font-mono font-bold text-base text-slate-950">
                    Invoice No: <span className="text-slate-900">{data.purchaseNumber}</span>
                  </div>
                  <div className="text-xs text-slate-700 flex sm:justify-end items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Date: <strong className="text-slate-900">{format(new Date(data.date), 'dd/MM/yyyy')}</strong>
                  </div>
                  <div className="text-xs text-slate-600">
                    Status:{' '}
                    <span className="font-bold uppercase tracking-wider text-slate-900">
                      {data.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Procurement Table */}
              <div className="relative z-10 mb-6">
                <table className={`w-full text-sm border-collapse border ${themeBorder}`}>
                  <thead>
                    <tr className={`${themeTableHead} text-white text-xs uppercase tracking-wider`}>
                      <th className={`border ${themeBorder} py-2.5 px-3 text-center w-14 font-bold`}>Sr. No.</th>
                      <th className={`border ${themeBorder} py-2.5 px-4 text-left font-bold`}>
                        Commodity / Crop (शेतमाल)
                      </th>
                      <th className={`border ${themeBorder} py-2.5 px-3 text-center w-28 font-bold`}>
                        Quantity (Qtl)
                      </th>
                      <th className={`border ${themeBorder} py-2.5 px-4 text-right w-32 font-bold`}>
                        Rate / Qtl (₹)
                      </th>
                      <th className={`border ${themeBorder} py-2.5 px-4 text-right w-36 font-bold`}>
                        Total Amount (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.items?.map((item: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className={`border-x ${themeBorder} py-3 px-3 text-center font-semibold text-slate-700`}>
                          {idx + 1}
                        </td>
                        <td className={`border-x ${themeBorder} py-3 px-4 font-bold text-slate-900`}>
                          {item.commodityName}
                        </td>
                        <td className={`border-x ${themeBorder} py-3 px-3 text-center font-bold text-slate-900`}>
                          {Number(item.quantity).toFixed(2)} Qtl
                        </td>
                        <td className={`border-x ${themeBorder} py-3 px-4 text-right font-medium text-slate-800`}>
                          ₹{Number(item.rate).toLocaleString('en-IN')}
                        </td>
                        <td className={`border-x ${themeBorder} py-3 px-4 text-right font-bold text-slate-950`}>
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}

                    {/* Filler rows for consistent classy voucher height */}
                    {Array.from({ length: Math.max(0, 3 - (data.items?.length || 0)) }).map((_, i) => (
                      <tr key={`fill-${i}`} className="opacity-0 select-none">
                        <td className={`border-x ${themeBorder} py-2`}>.</td>
                        <td className={`border-x ${themeBorder} py-2`}>.</td>
                        <td className={`border-x ${themeBorder} py-2`}>.</td>
                        <td className={`border-x ${themeBorder} py-2`}>.</td>
                        <td className={`border-x ${themeBorder} py-2`}>.</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`bg-slate-100 border-t-2 ${themeBorder} font-bold`}>
                      <td colSpan={2} className={`border ${themeBorder} py-3 px-4 text-left uppercase text-xs tracking-wider text-slate-800`}>
                        Total Procurement Value (एकूण रक्कम)
                      </td>
                      <td className={`border ${themeBorder} py-3 px-3 text-center text-slate-900 font-bold`}>
                        {data.items?.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0).toFixed(2)} Qtl
                      </td>
                      <td className={`border ${themeBorder} py-3 px-4 text-right text-xs uppercase text-slate-600 font-medium`}>
                        Gross Total
                      </td>
                      <td className={`border ${themeBorder} py-3 px-4 text-right text-slate-950 text-base font-black bg-slate-200/60`}>
                        {formatCurrency(data.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="relative z-10 bg-slate-50 border border-slate-300 rounded-md px-4 py-2 mb-6 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700 uppercase tracking-wider mr-2">Amount in Words:</span>
                  <span className="font-serif italic font-bold text-slate-900 text-sm">{wordsInInr}</span>
                </div>
              </div>

              {/* Settlement Summary Box */}
              <div className={`relative z-10 border-2 ${themeBorder} rounded-lg p-4 bg-slate-50 mb-8 space-y-2 text-sm font-semibold max-w-md ml-auto`}>
                <div className="flex justify-between items-center text-slate-800">
                  <span>Total Amount (एकूण रक्कम):</span>
                  <span className="font-bold text-slate-950">{formatCurrency(data.totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-800 border-t border-slate-200 pt-1.5">
                  <span>Total Paid / Advance (दिलेली रक्कम):</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(data.advancePaid)}</span>
                </div>
                <div className="flex justify-between items-center text-rose-800 border-t-2 border-slate-300 pt-1.5 text-base">
                  <span>Remaining Amount (शिल्लक रक्कम):</span>
                  <span className="font-black text-rose-700">{formatCurrency(data.remainingAmount)}</span>
                </div>
              </div>

              {/* Bottom Section: Clean Paid Stamp & Authorized Signatory */}
              <div className={`relative z-10 mt-auto pt-8 border-t-2 ${themeBorder} flex flex-col sm:flex-row justify-between items-end gap-6`}>
                
                {/* Left Column: Simple Red Paid Stamp (No Due) */}
                <div className="flex flex-col items-center sm:items-start justify-center min-w-[160px]">
                  <PaidStamp
                    status={data.status}
                    date={data.date}
                    amount={data.totalAmount}
                    remainingAmount={data.remainingAmount}
                  />
                </div>

                {/* Right Column: Dynamic Authorized Signatory */}
                <div className="text-center sm:text-right flex flex-col items-center sm:items-end justify-end w-56">
                  <div className="text-xs font-bold text-slate-900 mb-1">
                    For {activeBusiness.businessName}
                  </div>

                  {/* Dynamic Signature Display (uploaded signature image or clean signatory line) */}
                  <div className="h-16 w-48 flex items-center justify-center sm:justify-end border-b border-slate-800 pb-1 mb-1">
                    {activeBusiness.signatureData ? (
                      <img
                        src={activeBusiness.signatureData}
                        alt="Authorized Signature"
                        className="max-h-14 max-w-full object-contain filter contrast-125"
                      />
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Authorized Signature
                      </span>
                    )}
                  </div>

                  <div className="font-bold text-sm text-slate-950">
                    {activeBusiness.signatureName || activeBusiness.proprietorName}
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    Authorized Signatory
                  </div>
                </div>
              </div>

              {/* Bottom Mandi Text in Marathi as explicitly requested */}
              <div className="mt-8 pt-4 border-t border-slate-300 text-center">
                <p className="font-serif font-bold text-sm text-slate-900 tracking-wide">
                  कृषी उत्पन्न बाजार समिती मार्डी, मारेगाव
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
