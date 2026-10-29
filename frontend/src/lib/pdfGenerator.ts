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
 * Name the bill file after what it is about: the grain, the farmer and the
 * date, in that order, so a trader scrolling a WhatsApp thread or a phone's
 * Downloads folder can tell two bills apart without opening either.
 *
 * "Adatya_Bill_INV-719018.pdf" told them nothing useful, since the voucher
 * number is the one thing a farmer never quotes.
 *
 * Kept deliberately short: WhatsApp and most file pickers truncate in the
 * middle, so a long name hides exactly the part that distinguishes it. Each
 * part is capped, several commodities collapse to "Cotton+2", and anything a
 * filesystem would object to is stripped.
 *
 *   Cotton_MandarWararkar_30-10-2026.pdf
 */
export function buildBillFileName(data: BillPdfData): string {
  const clean = (value: string, max: number) => {
    const stripped = value
      // Spaces out, so the name survives being pasted into a shell or a URL.
      .replace(/\s+/g, '')
      // Keep letters and digits from any script: a Marathi commodity name
      // should stay readable rather than be reduced to nothing.
      .replace(/[^\p{L}\p{N}]/gu, '');
    return stripped.slice(0, max);
  };

  const items = data.items ?? [];
  const firstCommodity =
    items[0]?.customCommodityName?.trim() || items[0]?.commodityName?.trim() || '';
  const grain = firstCommodity
    ? clean(firstCommodity, 14) + (items.length > 1 ? `+${items.length - 1}` : '')
    : 'Bill';

  const farmer = clean(data.farmer?.name || data.farmerName || '', 18) || 'Farmer';

  // The stored date is ISO (2026-10-30); show it the way an Indian trader
  // reads one. Anything unparseable falls back to today rather than putting
  // "Invalid Date" or "NaN" in a filename.
  const parsed = new Date(data.date);
  const d = isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

  return `${grain}_${farmer}_${date}.pdf`;
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

  const bName = profile?.businessName || '';
  const propName = profile?.proprietorName || '';
  const address = profile?.address || '';
  const mobile1 = profile?.mobile1 || '';
  const mobile2 = profile?.mobile2 || '';
  const license = profile?.mandiLicense || '';
  const gstin = profile?.gstin || '';
  const tagline = profile?.tagline || 'Your ledger, your control.';

  const fName = data.farmer?.name || data.farmerName || 'Farmer';
  const fMobile = data.farmer?.mobile || data.farmerMobile || '-';
  const fVillage = data.farmer?.village || data.farmerVillage || '';

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
  const propLine = [
    propName ? `Prop: ${propName}` : '',
    license ? `Lic No: ${license}` : '',
  ].filter(Boolean).join(' | ');
  if (propLine) {
    doc.text(propLine, margin + 6, margin + 24);
  }
  if (address) {
    doc.text(`APMC Yard: ${address}`, margin + 6, margin + 29);
  }

  // Contact Info on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 222, 120);
  if (mobile1 || mobile2) {
    const mobiles = [mobile1, mobile2].filter(Boolean).join(' / ');
    doc.text(`Mob: ${mobiles}`, pageWidth - margin - 6, margin + 12, { align: 'right' });
  }
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

  // 7b. Payment status stamp.
  //
  // The on-screen bill carries this stamp, so the PDF carries the same one.
  // A trader who looks at the bill in the app and then sends it on WhatsApp
  // should not end up with two documents that say different things about
  // whether the money has been paid.
  //
  // The rule matches PaidStamp.tsx exactly: the outstanding balance decides,
  // not the status string, with a small tolerance so rounding cannot leave a
  // settled bill looking unpaid.
  const dueAmount = Number(data.remainingAmount || 0);
  const billTotal = Number(data.totalAmount || 0);
  const settledInFull = dueAmount <= 0.009;
  const untouched = dueAmount >= billTotal - 0.009;

  const stamp = settledInFull
    ? { label: 'PAID', note: 'Amount Paid', rgb: [16, 133, 94] }
    : untouched
      ? { label: 'UNPAID', note: `Balance Due: Rs ${dueAmount.toLocaleString('en-IN')}`, rgb: [200, 40, 40] }
      : { label: 'PART PAID', note: `Balance Due: Rs ${dueAmount.toLocaleString('en-IN')}`, rgb: [190, 110, 10] };

  // Sits under the amount-in-words block on the left, but never low enough to
  // collide with the signature line when a long item list pushes things down.
  const stampWidth = 52;
  const stampHeight = 16;
  const stampX = margin + 6;
  const stampY = Math.min(summaryY + 26, sigY - stampHeight - 6);

  doc.setDrawColor(stamp.rgb[0], stamp.rgb[1], stamp.rgb[2]);
  doc.setLineWidth(1);
  doc.roundedRect(stampX, stampY, stampWidth, stampHeight, 1.5, 1.5);

  doc.setTextColor(stamp.rgb[0], stamp.rgb[1], stamp.rgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(stamp.label, stampX + stampWidth / 2, stampY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(stamp.note, stampX + stampWidth / 2, stampY + 12.5, { align: 'center' });
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
  fileName: string,
  farmerMobile?: string
): Promise<{ success: boolean; method: 'native-share' | 'download' }> {
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
