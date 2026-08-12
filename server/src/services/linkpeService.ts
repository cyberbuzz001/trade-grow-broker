/**
 * LinkPe UPI Payment Service
 * Integrates PtPrashantTripathi/linkpe URL schema and UPI deep links
 */
import { queryOne } from '../db/schema';

export interface LinkPePayload {
  upiId: string;
  merchantName: string;
  amount: number;
  note: string;
  linkpeUrl: string;
  upiDeepLink: string;
  qrCodeUrl: string;
}

export class LinkPeService {
  /**
   * Get LinkPe UPI payment links and QR code for a requested deposit amount
   */
  public static async generatePaymentLink(
    amount: number,
    userId: string,
    customNote?: string
  ): Promise<LinkPePayload> {
    const safeAmount = Math.max(1, amount);

    // Fetch configured UPI ID & Merchant Name from database or environment
    const upiSetting = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'LINKPE_UPI_ID'`);
    const nameSetting = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'LINKPE_MERCHANT_NAME'`);

    const upiId = upiSetting?.value || process.env.LINKPE_UPI_ID || 'tradegrow@upi';
    const merchantName = nameSetting?.value || process.env.LINKPE_MERCHANT_NAME || 'Trade Grow Brokerage';
    const note = customNote || `TradeGrow_Deposit_${userId.slice(0, 8)}`;

    const pa = encodeURIComponent(upiId);
    const pn = encodeURIComponent(merchantName);
    const tn = encodeURIComponent(note);

    // LinkPe Web Payment Link
    const linkpeUrl = `https://ptprashanttripathi.github.io/linkpe/?pa=${pa}&pn=${pn}&amt=${safeAmount}&tn=${tn}`;

    // Direct UPI Mobile Deep Link (GPay, PhonePe, Paytm, BHIM)
    const upiDeepLink = `upi://pay?pa=${pa}&pn=${pn}&am=${safeAmount}&tn=${tn}&cu=INR`;

    // Dynamic QR Code Image URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiDeepLink)}`;

    return {
      upiId,
      merchantName,
      amount: safeAmount,
      note,
      linkpeUrl,
      upiDeepLink,
      qrCodeUrl
    };
  }
}
