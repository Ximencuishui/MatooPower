import { z } from 'zod';

export const activateWarrantySchema = z.object({
  skuId: z.string().min(1),
  serial: z.string().min(1).max(64),
  batch: z.string().min(1).max(64),
  /** HMAC of `SKUId:serial:sr:batch` encoded in qrId format. */
  qrSignature: z.string().regex(/^[a-f0-9]{64}$/, 'qrSignature must be 64-hex (HMAC-SHA256)'),

  country: z.string().length(2),                  // ISO-3166-1 alpha-2
  city: z.string().min(1).max(64),
  dealer: z.string().min(1).max(128),

  invoiceNo: z.string().min(1).max(64),
  invoiceDate: z.string().datetime().or(z.string().date()),
  invoiceAmt: z.number().nonnegative(),
  invoiceCurrency: z.string().length(3),          // ISO-4217

  policyAccepted: z.literal(true),
});
export type ActivateWarrantyDto = z.infer<typeof activateWarrantySchema>;