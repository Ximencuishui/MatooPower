export interface WarrantyEntity {
  id: string;
  skuId: string;
  userId: string;
  country: string;
  city: string;
  dealerName: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  invoiceAmount: number | null;
  invoicePhotoUrl: string | null;
  status: 'active' | 'pending' | 'expired' | 'rejected';
  startAt: string;
  endAtWhole: string;
  endAtCell: string | null;
  endAtBms: string | null;
  endAtParts: string | null;
  reviewNotes: string | null;
  createdAt: string;
  /** 策略来源标识：'INVOICE' = 发票日优先；'MFG_FALLBACK' = MFG+60 天兜底 */
  policy: 'INVOICE' | 'MFG_FALLBACK';
}