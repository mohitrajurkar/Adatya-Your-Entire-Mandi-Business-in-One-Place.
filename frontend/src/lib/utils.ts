import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function numberToWordsINR(num: number | null | undefined): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const rounded = Math.floor(num);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  }

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const remaining = rounded % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertLessThanThousand(crore) + ' Crore');
  if (lakh > 0) parts.push(convertLessThanThousand(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertLessThanThousand(thousand) + ' Thousand');
  if (remaining > 0) parts.push(convertLessThanThousand(remaining));

  return (parts.join(' ') + ' Rupees Only').trim();
}

export function generateWhatsAppBillMessage(data: any, profile?: any): string {
  const business = profile?.businessName || '';
  const proprietor = profile?.proprietorName || '';
  const address = profile?.address || '';
  const phone = profile?.mobile1 || '';
  const farmerName = data?.farmer?.name || 'Farmer';
  const farmerVillage = data?.farmer?.village ? ` (${data.farmer.village})` : '';
  const invoiceNum = data?.purchaseNumber || 'INV-000';
  const dateFormatted = data?.date ? new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  
  let itemsText = '';
  if (data?.items && Array.isArray(data.items)) {
    itemsText = data.items.map((it: any, idx: number) => {
      const name = it.commodityName || 'Commodity';
      const qty = it.quantity || 0;
      const rate = it.rate ? `₹${it.rate.toLocaleString('en-IN')}` : '₹0';
      const amt = it.amount ? `₹${it.amount.toLocaleString('en-IN')}` : '₹0';
      return `${idx + 1}. *${name}*: ${qty} Qtl @ ${rate}/Qtl = *${amt}*`;
    }).join('\n');
  }

  const totalFormatted = formatCurrency(data?.totalAmount || 0);
  const paidFormatted = formatCurrency(data?.advancePaid || 0);
  const remainingFormatted = formatCurrency(data?.remainingAmount || 0);
  const statusEmoji = data?.status === 'Paid' ? '✅ *PAID*' : data?.status === 'Partial' ? '⏳ *PARTIALLY PAID*' : '⚠️ *PAYMENT PENDING*';

  return `🌾 *${business.toUpperCase()} - CROP PURCHASE BILL* 🌾
━━━━━━━━━━━━━━━━━━━━
📄 *Invoice / बिल क्र.:* ${invoiceNum}
📅 *Date / तारीख:* ${dateFormatted}
👨‍🌾 *Farmer / शेतकरी:* ${farmerName}${farmerVillage}
━━━━━━━━━━━━━━━━━━━━
📦 *PROCUREMENT DETAILS (माल तपशील):*
${itemsText || '• Goods purchased'}
━━━━━━━━━━━━━━━━━━━━
💵 *Total Amount (एकूण रक्कम):* ${totalFormatted}
💰 *Advance Paid (दिलेली उचल):* ${paidFormatted}
📌 *Remaining Balance (शिल्लक बाकी):* ${remainingFormatted}
📊 *Status (स्थिती):* ${statusEmoji}
━━━━━━━━━━━━━━━━━━━━
🏢 *${business}*
👤 *Prop:* ${proprietor}
📍 *APMC:* ${address}
📞 *Mobile:* ${phone}
🙏 *आपल्या विश्वासाबद्दल धन्यवाद! (Thank you for your trust!)*`;
}

