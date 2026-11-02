import React, { useState } from 'react';
import { MessageSquare, Download, X, Smartphone, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { formatCurrency } from '../lib/utils';
import {
  generateBillPdfDoc,
  shareBillPdfToWhatsApp,
  buildBillFileName,
  shareBillImageToWhatsApp,
  buildBillImageFileName
} from '../lib/pdfGenerator';
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

  const { language, t } = useLanguage();
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
  const farmerVillage = data.farmer?.village || data.farmerVillage || '';

  const handleShareImage = async () => {
    setIsSharing(true);
    setShareSuccess(null);

    try {
      let imageBlob: Blob | null = null;

      // 1. If printable bill is in the DOM, capture it directly as a high-res JPEG
      const billEl = document.getElementById('printable-bill');
      if (billEl) {
        const html2canvas = (await import('html2canvas-pro')).default;

        for (const scale of [2, 1.5, 1]) {
          try {
            const canvas = await html2canvas(billEl, {
              scale,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              windowWidth: 900,
              width: 900,
            });

            if (!canvas.width || !canvas.height) {
              throw new Error(`empty canvas at scale ${scale}`);
            }

            imageBlob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
            });

            if (imageBlob && imageBlob.size > 2000) {
              break;
            }
          } catch (err) {
            console.warn(`Capture error at scale ${scale}`, err);
          }
        }
      }

      // 2. If canvas image exists, share as JPEG photocopy
      if (imageBlob) {
        const fileName = buildBillImageFileName(data);
        const result = await shareBillImageToWhatsApp(imageBlob, fileName, phoneNumber);

        if (result.method === 'native-share') {
          setShareSuccess('Bill photo ready to share on WhatsApp!');
        } else {
          setShareSuccess('Bill photo downloaded & WhatsApp opened!');
        }
      } else {
        // Fallback to PDF if image capture wasn't possible (e.g. from Dashboard without bill DOM)
        const doc = generateBillPdfDoc(data, profile);
        const pdfBlob = doc.output('blob');
        const result = await shareBillPdfToWhatsApp(pdfBlob, buildBillFileName(data), phoneNumber);

        if (result.method === 'native-share') {
          setShareSuccess('Bill ready to share on WhatsApp!');
        } else {
          setShareSuccess('Bill downloaded & WhatsApp opened!');
        }
      }

      setTimeout(() => {
        setIsSharing(false);
      }, 1500);
    } catch (err) {
      console.error('Share image error:', err);
      setIsSharing(false);
    }
  };

  const handleDownloadOnly = async () => {
    try {
      const billEl = document.getElementById('printable-bill');
      if (billEl) {
        const html2canvas = (await import('html2canvas-pro')).default;
        const canvas = await html2canvas(billEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 900,
          width: 900,
        });
        const url = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildBillImageFileName(data);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setShareSuccess('Bill photo downloaded successfully!');
      } else {
        const doc = generateBillPdfDoc(data, profile);
        doc.save(buildBillFileName(data));
        setShareSuccess(t('bill_pdf_downloaded_successfully'));
      }
    } catch (err) {
      console.error('Download error:', err);
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
                Share Bill Photocopy on WhatsApp
              </h3>
              <p className="text-xs text-emerald-200">
                Shares exact on-screen bill photo (.jpeg) directly into WhatsApp
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
          {/* Bill Preview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-slate-50 to-amber-50/40 border border-emerald-200/80 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center shadow-xs">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {buildBillImageFileName(data)}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Exact Bill Photocopy / Voucher Image
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                JPEG Photo
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
              {t('farmer_whatsapp_number')}
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
            📸 <strong>Photocopy:</strong> Shares the exact bill you see on screen as a clear <strong>.jpeg</strong> photo with your signature and paid stamp without sending clutter text.
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
            Download Photo
          </Button>

          <Button
            type="button"
            onClick={handleShareImage}
            disabled={isSharing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing Photo...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 fill-white" />
                Share Photo on WhatsApp
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
