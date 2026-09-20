import type { SkuId } from './sku.js';
import type { UserId } from './user.js';

export type WarrantyId = string & { readonly __brand: 'WarrantyId' };
export type BatchCode = string & { readonly __brand: 'BatchCode' };

export type WarrantyStatus = 'active' | 'pending' | 'expired' | 'revoked';

export type Coverage = 'whole' | 'cell' | 'bms' | 'parts';

export interface Warranty {
  id: WarrantyId;
  userId: UserId;
  skuId: SkuId;
  serial: string;
  batch: BatchCode;
  status: WarrantyStatus;
  startAt: string; // ISO-8601
  endAt: string;   // ISO-8601
  dealer?: string;
  region?: string;
  coverages: Coverage[];
  invoiceNo?: string;
  invoiceDate?: string;
}