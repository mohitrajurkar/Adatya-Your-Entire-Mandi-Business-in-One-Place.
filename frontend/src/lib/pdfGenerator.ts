import { jsPDF } from 'jspdf';
import { formatCurrency, numberToWordsINR } from './utils';

export interface BillPdfData {
  purchaseNumber: string;
  date: string;
  totalAmount: number;
  advancePaid: number;
  remainingAmount: number;
  status?: string;
  farmer?: {
    name: string;
    mobile?: string;
    village?: string;
  };
  farmerName?: string;
  farmerMobile?: string;
  farmerVillage?: string;
  items?: Array<{
    id?: number | string;
    commodityName?: string;
    customCommodityName?: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
}

export interface BusinessProfileData {
  businessName?: string;
  proprietorName?: string;
  address?: string;
  mobile1?: string;
  mobile2?: string;
  mandiLicense?: string;
  gstin?: string;
  tagline?: string;
  signatureName?: string;
}

/**
 * Generate a standalone high-quality Mandi Bill PDF document
 */
export function generateBillPdfDoc(data: BillPdfData, profile?: BusinessProfileData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const bName = profile?.businessName || 'Bodhale Purchaser';
  const propName = profile?.proprietorName || 'Maroti V Bodhale';
  const address = profile?.address || 'Mardi, Maregaon, Wani, Yavatmal - 445304';
  const mobile1 = profile?.mobile1 || '8805978780';
  const mobile2 = profile?.mobile2 || '9604655124';
  const license = profile?.mandiLicense || 'APMC/MRG/2024-88';
  const gstin = profile?.gstin || '';
  const tagline = profile?.tagline || 'Your ledger, your control.';

  const fName = data.farmer?.name || data.farmerName || 'Farmer';
  const fMobile = data.farmer?.mobile || data.farmerMobile || '-';
  const fVillage = data.farmer?.village || data.farmerVillage || 'Mardi';

  // 1. Outer Border Frame (Double border)
  doc.setDrawColor(4, 39, 24); // Deep Emerald
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);
  doc.setLineWidth(0.3);
  doc.rect(margin + 1.5, margin + 1.5, contentWidth - 3, pageHeight - margin * 2 - 3);

  // 2. Top Header Banner
  doc.setFillColor(4, 39, 24);
  doc.rect(margin + 2, margin + 2, contentWidth - 4, 32, 'F');

  // Business Name in Gold/White
  doc.setTextColor(245, 222, 120); // Warm Gold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(bName.toUpperCase(), margin + 6, margin + 12);

  // Slogan
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(`"${tagline}"`, margin + 6, margin + 18);

  // Mandi / License info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`Prop: ${propName} | Lic No: ${license}`, margin + 6, margin + 24);
  doc.text(`APMC Yard: ${address}`, margin + 6, margin + 29);

  // Contact Info on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 222, 120);
  doc.text(`Mob: ${mobile1}${mobile2 ? ` / ${mobile2}` : ''}`, pageWidth - margin - 6, margin + 12, { align: 'right' });
  if (gstin) {
    doc.setTextColor(220, 220, 220);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`GSTIN: ${gstin}`, pageWidth - margin - 6, margin + 18, { align: 'right' });
  }

  // 3. Bill Title Bar
  let y = margin + 38;
  doc.setFillColor(245, 247, 245);
  doc.setDrawColor(200, 210, 200);
  doc.setLineWidth(0.4);
  doc.rect(margin + 4, y, contentWidth - 8, 12, 'FD');

  doc.setTextColor(4, 39, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`OFFICIAL PURCHASE VOUCHER / MANDI BILL`, margin + 8, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(180, 83, 9); // Amber
  doc.text(`BILL #${data.purchaseNumber}`, pageWidth - margin - 8, y + 8, { align: 'right' });

  // 4. Farmer & Voucher Details Grid
  y += 16;
  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 4, y, contentWidth - 8, 24, 'FD');

  // Left column: Farmer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 100);
  doc.text('FARMER (SELLER) DETAILS:', margin + 8, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(fName, margin + 8, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 80, 90);
  doc.text(`Village: ${fVillage}  |  Mobile: ${fMobile}`, margin + 8, y + 18);

  // Right column: Date & Status
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 100);
  doc.text('VOUCHER METADATA:', rightColX, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 80, 90);
  doc.text(`Date: ${data.date ? new Date(data.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, rightColX, y + 12);
  
  const status = data.status || (data.remainingAmount <= 0 ? 'Paid' : data.advancePaid > 0 ? 'Partial' : 'Pending');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(status === 'Paid' ? 22 : 180, status === 'Paid' ? 101 : 83, status === 'Paid' ? 52 : 9);
  doc.text(`Payment Status: ${status}`, rightColX, y + 18);

  // 5. Items Table Header
  y += 28;
  const colX = {
    sr: margin + 6,
    commodity: margin + 20,
    qty: margin + 85,
    rate: margin + 120,
    amount: pageWidth - margin - 8,
  };

  doc.setFillColor(4, 39, 24);
  doc.rect(margin + 4, y, contentWidth - 8, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.text('#', colX.sr, y + 6);
  doc.text('COMMODITY / GRAIN', colX.commodity, y + 6);
  doc.text('WEIGHT (QTL)', colX.qty, y + 6, { align: 'right' });
  doc.text('RATE (Rs/QTL)', colX.rate, y + 6, { align: 'right' });
  doc.text('AMOUNT (Rs)', colX.amount, y + 6, { align: 'right' });

  // 6. Items Table Rows
  y += 9;
  const items = data.items && data.items.length > 0 ? data.items : [
    {
      commodityName: 'Cotton (Kapus)',
      quantity: 10,
      rate: 7000,
      amount: data.totalAmount || 70000,
    }
  ];

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 248);
    doc.rect(margin + 4, y, contentWidth - 8, 8, 'F');

    doc.setDrawColor(230, 235, 230);
    doc.setLineWidth(0.2);
    doc.line(margin + 4, y + 8, pageWidth - margin - 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 40, 50);

    const commName = item.commodityName || item.customCommodityName || 'Grain Item';
    doc.text(String(index + 1), colX.sr, y + 5.5);
    doc.text(commName, colX.commodity, y + 5.5);
    doc.text(`${Number(item.quantity).toFixed(2)} Qtl`, colX.qty, y + 5.5, { align: 'right' });
    doc.text(`Rs ${Number(item.rate).toLocaleString('en-IN')}`, colX.rate, y + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs ${Number(item.amount).toLocaleString('en-IN')}`, colX.amount, y + 5.5, { align: 'right' });

    y += 8;
  });

  // 7. Payment Summary Box
  y += 6;
  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - margin - 4 - summaryBoxWidth;
  const summaryY = y;

  doc.setFillColor(252, 253, 252);
  doc.setDrawColor(200, 215, 200);
  doc.setLineWidth(0.4);
  doc.rect(summaryBoxX, summaryY, summaryBoxWidth, 34, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 80, 90);

  // Total Amount
  doc.text('Total Amount (Gross):', summaryBoxX + 4, summaryY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs ${Number(data.totalAmount).toLocaleString('en-IN')}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 8, { align: 'right' });

  // Advance Paid
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 80, 90);
  doc.text('Advance Paid (Rokhad):', summaryBoxX + 4, summaryY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // Emerald
  doc.text(`Rs ${Number(data.advancePaid || 0).toLocaleString('en-IN')}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 16, { align: 'right' });

  // Balance Due
  doc.setDrawColor(210, 220, 210);
  doc.line(summaryBoxX + 4, summaryY + 21, summaryBoxX + summaryBoxWidth - 4, summaryY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 30, 30); // Rose
  doc.text('Balance Due (Shillak):', summaryBoxX + 4, summaryY + 28);
  doc.setFontSize(10.5);
  doc.text(`Rs ${Number(data.remainingAmount || 0).toLocaleString('en-IN')}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 28, { align: 'right' });

  // Left Note: Words INR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 110, 100);
  doc.text('AMOUNT IN WORDS (RUPEES):', margin + 6, summaryY + 8);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const words = numberToWordsINR(data.totalAmount);
  doc.text(words, margin + 6, summaryY + 15, { maxWidth: summaryBoxX - margin - 12 });

  // 8. Signatures & Mandi Stamp Area
  const sigY = pageHeight - margin - 35;
  doc.setDrawColor(220, 225, 220);
  doc.setLineWidth(0.3);
  doc.line(margin + 6, sigY, pageWidth - margin - 6, sigY);

  // Left: Farmer Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 120);
  doc.text('Farmer / Seller Signature', margin + 12, sigY + 22);
  doc.setDrawColor(180, 190, 180);
  doc.line(margin + 8, sigY + 17, margin + 55, sigY + 17);

  // Center: Mandi Seal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 39, 24);
  doc.text(`[ APMC MANDI AUTHORIZED ]`, pageWidth / 2, sigY + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 120);
  doc.text('Computer Generated Invoice', pageWidth / 2, sigY + 18, { align: 'center' });

  // Right: Purchaser Signature
  const rightSigX = pageWidth - margin - 55;
  doc.setDrawColor(180, 190, 180);
  doc.line(rightSigX, sigY + 17, pageWidth - margin - 8, sigY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(profile?.signatureName || propName, pageWidth - margin - 10, sigY + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 120);
  doc.text('Authorized Signatory / Adatya', pageWidth - margin - 10, sigY + 22, { align: 'right' });

  // 9. Bottom Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 150, 140);
  doc.text(
    `Adatya Mandi Ledger · ${bName} · Your ledger, your control.`,
    pageWidth / 2,
    pageHeight - margin - 4,
    { align: 'center' }
  );

  return doc;
}

/**
 * Share PDF of the bill directly to WhatsApp:
 * - NO TEXT is shared.
 * - On Mobile (Android & iOS): uses Web Share API Level 2 to pass the .pdf file directly into WhatsApp.
 * - On Desktop/Restricted: downloads the .pdf directly and opens WhatsApp with the recipient contact.
 */
export async function shareBillPdfToWhatsApp(
  pdfBlob: Blob,
  purchaseNumber: string,
  farmerMobile?: string
): Promise<{ success: boolean; method: 'native-share' | 'download' }> {
  const fileName = `Adatya_Bill_${purchaseNumber}.pdf`;
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

  // Mobile Web Share API: Android Chrome & iOS Safari support sharing files directly
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: fileName,
        // CRITICAL: No text property passed! It only shares the PDF file.
      });
      return { success: true, method: 'native-share' };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // User closed the share sheet
        return { success: true, method: 'native-share' };
      }
      console.warn('Native file share failed, switching to download fallback:', e);
    }
  }

  // Fallback: Download PDF to device and open WhatsApp with recipient phone number
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  // Open WhatsApp without ANY text parameter
  const rawMobile = farmerMobile || '';
  const digits = rawMobile.replace(/\D/g, '');
  const cleanDigits = digits.length === 10 ? digits : digits.length > 10 ? digits.slice(-10) : '';

  if (cleanDigits) {
    window.open(`https://wa.me/91${cleanDigits}`, '_blank');
  } else {
    window.open('https://web.whatsapp.com', '_blank');
  }

  return { success: true, method: 'download' };
}
