import React, { useState } from 'react';
import { MessageSquare, Download, X, Smartphone, FileText, CheckCircle2, Loader2, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { formatCurrency } from '../lib/utils';
import { generateBillPdfDoc, shareBillPdfToWhatsApp } from '../lib/pdfGenerator';
import { useLanguage } from '../context/LanguageContext';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  profile?: any;
}

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  data,
  profile
}: WhatsAppShareModalProps) {
  if (!isOpen || !data) return null;

  const { language } = useLanguage();
  const rawMobile = data.farmer?.mobile || data.farmerMobile || '';
  const cleanPhoneDigits = rawMobile.replace(/\D/g, '');
  const initialPhone = cleanPhoneDigits.length === 10
    ? cleanPhoneDigits
    : cleanPhoneDigits.length > 10
    ? cleanPhoneDigits.slice(-10)
    : cleanPhoneDigits;

  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  const farmerName = data.farmer?.name || data.farmerName || 'Farmer';
  const farmerVillage = data.farmer?.village || data.farmerVillage || 'Mardi';

  const handleSharePdf = async () => {
    setIsSharing(true);
    setShareSuccess(null);

    try {
      // 1. Generate clean official PDF document of the bill
      const doc = generateBillPdfDoc(data, profile);
      const pdfBlob = doc.output('blob');

      // 2. Share PDF directly via Web Share API or download & open WhatsApp with NO text
      const result = await shareBillPdfToWhatsApp(pdfBlob, data.purchaseNumber, phoneNumber);

      if (result.method === 'native-share') {
        setShareSuccess(
          language === 'mr'
            ? 'पावती PDF व्हॉट्सॲपवर पाठवण्यासाठी तयार!'
            : 'Bill PDF ready to share on WhatsApp!'
        );
      } else {
        setShareSuccess(
          language === 'mr'
            ? '📄 पावती PDF डाउनलोड झाली व व्हॉट्सॲप चॅट उघडले!'
            : '📄 Bill PDF downloaded & WhatsApp opened! Attach PDF to send.'
        );
      }

      setTimeout(() => {
        setIsSharing(false);
      }, 1500);
    } catch (err) {
      console.error('Share PDF error:', err);
      setIsSharing(false);
    }
  };

  const handleDownloadOnly = () => {
    try {
      const doc = generateBillPdfDoc(data, profile);
      doc.save(`Adatya_Bill_${data.purchaseNumber}.pdf`);
      setShareSuccess(
        language === 'mr'
          ? '📄 पावती PDF डाऊनलोड झाली!'
          : '📄 Bill PDF downloaded successfully!'
      );
    } catch (err) {
      console.error('Download PDF error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 px-6 py-4 text-white flex items-center justify-between border-b border-emerald-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <MessageSquare className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h3 className="font-serif font-black text-base leading-tight text-amber-300">
                {language === 'mr' ? 'पावती PDF व्हॉट्सॲपवर पाठवा' : 'Share Bill PDF on WhatsApp'}
              </h3>
              <p className="text-xs text-emerald-200">
                {language === 'mr' ? 'केवळ अधिकृत PDF दस्तऐवज शेअर होईल' : 'Shares official PDF document directly (No text)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Bill PDF Preview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-slate-50 to-amber-50/40 border border-emerald-200/80 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Adatya_Bill_{data.purchaseNumber}.pdf
                  </h4>
                  <p className="text-xs text-slate-500">
                    {language === 'mr' ? 'अधिकृत डिजिटल पावती PDF' : 'Official Mandi Purchase Voucher'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                PDF
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Farmer:</span>{' '}
                <strong className="text-slate-900 font-bold">{farmerName}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium">Amount:</span>{' '}
                <strong className="text-emerald-800 font-black">{formatCurrency(data.totalAmount)}</strong>
              </div>
            </div>
          </div>

          {/* Recipient Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
              {language === 'mr' ? 'शेतकऱ्याचा मोबाईल नंबर' : 'Farmer WhatsApp Number'}
            </label>
            <div className="flex rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-emerald-600 overflow-hidden bg-white shadow-2xs">
              <span className="bg-slate-100 text-slate-700 px-3 py-2 text-xs font-bold border-r border-slate-300 flex items-center">
                +91 (IND)
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="10-digit mobile number"
                className="flex-1 px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Recipient: <span className="font-semibold text-slate-800">{farmerName}</span> ({farmerVillage})
            </p>
          </div>

          {shareSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{shareSuccess}</span>
            </div>
          )}

          {/* Guarantee Note */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-600">
            💡 <strong>Note:</strong> Shares the complete printable <strong>.pdf</strong> voucher directly with rates, bags, advance, and signature without sending clutter text.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadOnly}
            className="text-xs font-semibold border-slate-300 hover:bg-white"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-600" />
            {language === 'mr' ? 'PDF डाउनलोड' : 'Download PDF'}
          </Button>

          <Button
            type="button"
            onClick={handleSharePdf}
            disabled={isSharing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === 'mr' ? 'PDF तयार होत आहे...' : 'Sharing PDF...'}
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 fill-white" />
                {language === 'mr' ? 'व्हॉट्सॲपवर PDF पाठवा' : 'Share PDF on WhatsApp'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
